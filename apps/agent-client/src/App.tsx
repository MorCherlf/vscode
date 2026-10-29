/* Copyright (c) Microsoft Corporation. All rights reserved. */
/* Licensed under the MIT License. See LICENSE.txt in the project root for license information. */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AgentClient, type SessionSummary } from '@morcherlf/agent-client-core';
import type { ClientRuntime } from './runtime';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { Transcript } from './Transcript';
import { labels as t } from './i18n';
import '@vscode/codicons/dist/codicon.css';
import './theme-colors.css';
import './style.css';

type Theme = 'system' | 'light' | 'dark';
function readTheme(): Theme {
	try { const value = localStorage.getItem('agent-client.appearance'); if (value === 'light' || value === 'dark') { return value; } } catch { /* Storage may be unavailable. */ }
	return 'system';
}
function directoryPath(uri: string): string {
	try { const url = new URL(uri); return url.protocol === 'file:' ? decodeURIComponent(url.pathname) : uri; } catch { return uri; }
}
function folderName(directory: string): string { return directory.replace(/\/$/, '').split('/').pop() || directory || t.noProject; }
function projectUri(directory: string): string {
	if (!directory.startsWith('/')) { throw new Error(t.invalidProject); }
	const uri = new URL('file:///'); uri.pathname = directory; return uri.href;
}
function moveSessionFocus(event: KeyboardEvent<HTMLElement>): void {
	const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-session]')];
	const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
	const offset = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
	if (offset || event.key === 'Home' || event.key === 'End') {
		event.preventDefault();
		buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + offset + buttons.length) % buttons.length]?.focus();
	}
}

/** Sessions surface; the same component runs against the native runtime and test-only bridge. */
export function App({ client, runtime }: { client: AgentClient; runtime: ClientRuntime }) {
	const [, render] = useState(0);
	const [directory, setDirectory] = useState('');
	const [session, setSession] = useState('');
	const [chat, setChat] = useState('');
	const [drafts, setDrafts] = useState<Record<string, string>>({});
	const [provider, setProvider] = useState('');
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	const [sidebar, setSidebar] = useState(true);
	const [query, setQuery] = useState('');
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
	const [projectDialog, setProjectDialog] = useState(false);
	const [settings, setSettings] = useState(false);
	const [quit, setQuit] = useState(false);
	const [wait, setWait] = useState(false);
	const [theme, setTheme] = useState<Theme>(readTheme);
	const composer = useRef<HTMLTextAreaElement>(null);
	const current = chat ? client.getChat(chat) : undefined;
	const currentSession = session ? client.getSession(session) : undefined;
	const draftKey = session || 'new';
	const draft = drafts[draftKey] ?? '';
	const agents = client.root?.agents ?? [];
	const selectedProvider = agents.find(agent => agent.provider === provider)?.provider ?? agents[0]?.provider ?? '';
	const currentDirectory = session ? directoryPath(currentSession?.workingDirectories?.[0] ?? '') : directory;
	const active = client.hasActiveTurns() || client.status === 'resync-required' || client.status === 'connecting';
	const run = async (action: () => Promise<void>) => {
		setBusy(true); setError('');
		try { await action(); } catch (failure) { setError(failure instanceof Error ? failure.message : t.error); }
		finally { setBusy(false); }
	};
	const newSession = () => { if (busy) { return; } setSession(''); setChat(''); setError(''); composer.current?.focus(); };
	useEffect(() => client.onChange(() => render(value => value + 1)), [client]);
	useEffect(() => {
		document.documentElement.dataset.theme = theme;
		try { localStorage.setItem('agent-client.appearance', theme); } catch { /* The preference is optional. */ }
	}, [theme]);
	useEffect(() => {
		let dispose: (() => void) | undefined; let alive = true;
		if (runtime.available) {
			void runtime.onQuit(() => setQuit(true)).then(unlisten => { if (alive) { dispose = unlisten; } else { unlisten(); } }).catch(() => setError(t.error));
		}
		return () => { alive = false; dispose?.(); };
	}, [runtime]);
	useEffect(() => {
		if (wait && !active && client.status === 'ready') { void runtime.quit().catch(() => { setWait(false); setError(t.error); }); }
	}, [wait, active, client.status, runtime]);
	useEffect(() => {
		const keydown = (event: globalThis.KeyboardEvent) => {
			if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.isComposing || document.querySelector('dialog[open]')) { return; }
			if (event.key.toLowerCase() === 'b') { event.preventDefault(); setSidebar(value => !value); }
			if (event.key.toLowerCase() === 'n' && !busy) { event.preventDefault(); newSession(); }
		};
		document.addEventListener('keydown', keydown);
		return () => document.removeEventListener('keydown', keydown);
	}, [busy]);
	useEffect(() => {
		const element = composer.current;
		if (element) { element.style.height = 'auto'; element.style.height = Math.min(element.scrollHeight, 240) + 'px'; }
	}, [draft]);

	const choose = (uri: string) => run(async () => {
		const nextChat = await client.selectSession(uri);
		setSession(uri); setChat(nextChat);
	});
	const send = () => {
		if (!draft.trim() || busy || client.status !== 'ready' || current?.activeTurn) { return; }
		if (!session && !directory) { setProjectDialog(true); return; }
		void run(async () => {
			let target = chat;
			let created: string | undefined;
			if (!target && session) { target = await client.selectSession(session); setChat(target); }
			if (!target) {
				if (!selectedProvider) { throw new Error(t.noProvider); }
				created = await client.createSession(selectedProvider, projectUri(directory));
				// Keep the submitted draft on the created session if subsequent selection fails.
				setDrafts(previous => ({ ...previous, [created!]: draft })); setSession(created);
				target = await client.selectSession(created); setChat(target);
			}
			client.send(target, draft.trim());
			setDrafts(previous => ({ ...previous, [draftKey]: '', ...(created ? { [created]: '' } : {}) }));
		});
	};
	const groups = new Map<string, SessionSummary[]>();
	for (const item of [...client.sessions].sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt))) {
		const project = item.workingDirectories?.[0] ?? '';
		if (!(item.title + ' ' + directoryPath(project)).toLocaleLowerCase().includes(query.toLocaleLowerCase())) { continue; }
		groups.set(project, [...(groups.get(project) ?? []), item]);
	}
	return <div className={'agent-sessions-workbench app' + (sidebar ? '' : ' sidebar-hidden') + (runtime.available && navigator.userAgent.includes('Mac') ? ' macos-native' : '')}>
		<header className="window-toolbar" data-tauri-drag-region>
			<div className="window-actions"><button className="icon-button" title={t.toggleSidebar} aria-label={t.toggleSidebar} aria-expanded={sidebar} onClick={() => setSidebar(value => !value)}><Icon name="layout-sidebar-left"/></button><span className="app-name">{t.app}</span></div>
			<span className="window-title" data-tauri-drag-region>{currentSession?.title || t.newSession}</span>
			<button className="icon-button" title={t.settings} aria-label={t.settings} onClick={() => setSettings(true)}><Icon name="gear"/></button>
		</header>
		{sidebar && <aside className="sessions-sidebar" aria-label={t.sessions}>
			<div className="sidebar-heading"><h2>{t.sessions}</h2><button className="compact-new" disabled={busy} onClick={newSession}><Icon name="plus"/>{t.newSession}</button></div>
			<div className="session-search"><Icon name="search"/><input aria-label={t.searchSessions} placeholder={t.searchSessions} value={query} onChange={event => setQuery(event.target.value)}/></div>
			<nav className="session-navigation" aria-label={t.sessions} onKeyDown={moveSessionFocus}>
				{[...groups].map(([project, items]) => <section className="session-group" key={project}>
					<button className="project-heading" aria-expanded={!collapsed.has(project)} title={directoryPath(project)} onClick={() => setCollapsed(previous => { const next = new Set(previous); if (next.has(project)) { next.delete(project); } else { next.add(project); } return next; })}><Icon name={collapsed.has(project) ? 'chevron-right' : 'chevron-down'}/><Icon name="folder"/><span>{project ? folderName(directoryPath(project)) : t.ungrouped}</span><span className="count">{items.length}</span></button>
					{!collapsed.has(project) && items.map(item => <button key={item.resource} data-session={item.resource} className={'session-row' + (session === item.resource ? ' selected' : '')} aria-current={session === item.resource ? 'page' : undefined} disabled={busy || client.status !== 'ready'} title={item.activity || item.title} onClick={() => void choose(item.resource)}><Icon name="comment-discussion"/><span>{item.title || t.newSession}</span>{session === item.resource && current?.activeTurn && <span className="activity-dot" aria-label={t.working}/>}</button>)}
				</section>)}
				{!groups.size && <p className="sidebar-empty">{query ? t.noResults : t.emptySessions}</p>}
			</nav>
			<footer className="sidebar-footer"><button disabled title={t.account}><Icon name="account"/>{t.signIn}</button><p>{t.account}</p><button onClick={() => setSettings(true)}><Icon name="settings-gear"/>{t.settings}</button></footer>
		</aside>}
		<main className="sessions-panel">
			<div className="session-header"><span className="session-heading"><Icon name="comment-discussion"/>{currentSession?.title || t.newSession}</span><div className="connection-actions"><span role="status" className={'status ' + client.status}><span className="status-dot"/>{t[client.status]}</span><button className="connection-button" disabled={!runtime.available || busy} onClick={() => void run(async () => client.connect(await runtime.connect()))}><Icon name="debug-disconnect"/>{client.status === 'offline' ? t.connect : t.reconnect}</button></div></div>
			{!runtime.available && <p className="notice">{t.desktop}</p>}
			{error && <p role="alert" className="notice error">{error}</p>}
			{wait && <p className="notice">{t.waiting}</p>}
			<div className={'chat-surface' + (!session ? ' new-chat-widget-container' : '')}>
				{session && <Transcript state={current} chat={chat} connected={client.status === 'ready'} client={client} onError={setError}/>}
				<div className={!session ? 'new-chat-widget-content' : 'session-composer'}>
					{!session && <div className="new-session-welcome-message"><h1 className="new-session-welcome-message-title">{t.welcome}</h1></div>}
					<form className="chat-input-container" onSubmit={event => { event.preventDefault(); send(); }}>
						<textarea ref={composer} aria-label={t.prompt} placeholder={t.prompt} value={draft} disabled={busy} rows={3} onChange={event => setDrafts(previous => ({ ...previous, [draftKey]: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); send(); } }}/>
						<div className="chat-input-toolbars"><div className="composer-context"><button type="button" className="context-button" aria-label={t.chooseProject} disabled={!!session || busy} onClick={() => setProjectDialog(true)} title={currentDirectory || t.chooseProject}><Icon name="folder-opened"/>{currentDirectory ? folderName(currentDirectory) : t.chooseProject}{!session && <Icon name="chevron-down"/>}</button><span className="mode-label"><Icon name="copilot"/>{t.agent}</span>{!session && agents.length > 1 && <select aria-label={t.provider} value={selectedProvider} onChange={event => setProvider(event.target.value)}>{agents.map(agent => <option key={agent.provider} value={agent.provider}>{agent.displayName}</option>)}</select>}</div>
							{current?.activeTurn ? <button type="button" className="send-button stop-button" aria-label={t.cancel} title={t.cancel} disabled={client.status !== 'ready'} onClick={() => { try { client.cancel(chat, current.activeTurn!.id); } catch (failure) { setError(String(failure)); } }}><Icon name="primitive-square"/></button> : <button type="submit" className="send-button" aria-label={t.send} title={t.send} disabled={!draft.trim() || client.status !== 'ready' || busy}><Icon name="arrow-up"/></button>}
						</div>
					</form><p className="composer-hint">{t.draftHint}</p>
				</div>
			</div>
		</main>
		{projectDialog && <ProjectDialog initial={directory} onClose={() => setProjectDialog(false)} onApply={value => { setDirectory(value); setProjectDialog(false); composer.current?.focus(); }}/>}
		{settings && <Modal title={t.settings} onClose={() => setSettings(false)}><label className="field">{t.theme}<select value={theme} onChange={event => setTheme(event.target.value as Theme)}><option value="system">{t.systemTheme}</option><option value="light">{t.lightTheme}</option><option value="dark">{t.darkTheme}</option></select></label><h3>{t.shortcuts}</h3><p>{t.newShortcut}<br/>{t.sidebarShortcut}</p><p className="muted">{t.account}</p><p className="muted">{t.attribution}</p><div className="dialog-actions"><button disabled={!runtime.available} onClick={() => { setSettings(false); setQuit(true); }}>{t.quit}</button><button className="primary" onClick={() => setSettings(false)}>{t.close}</button></div></Modal>}
		{quit && <Modal title={t.quitTitle} onClose={() => setQuit(false)}>{active && <p>{t.quitDetail}</p>}<div className="dialog-actions"><button onClick={() => { setQuit(false); setWait(false); }}>{t.keep}</button>{active && <button onClick={() => { setWait(true); setQuit(false); }}>{t.wait}</button>}<button className="primary" disabled={busy} onClick={() => void run(async () => { await client.disconnect(); await runtime.quit(); })}>{t.stop}</button></div></Modal>}
	</div>;
}

function ProjectDialog({ initial, onClose, onApply }: { initial: string; onClose(): void; onApply(value: string): void }) {
	const [value, setValue] = useState(initial);
	const [error, setError] = useState('');
	return <Modal title={t.chooseProject} onClose={onClose}><form onSubmit={event => { event.preventDefault(); if (!value.trim().startsWith('/')) { setError(t.invalidProject); return; } onApply(value.trim()); }}><p>{t.projectHelp}</p><label className="field">{t.projectPath}<input autoFocus value={value} onChange={event => setValue(event.target.value)} required/></label>{error && <p role="alert" className="error">{error}</p>}<div className="dialog-actions"><button type="button" onClick={onClose}>{t.back}</button><button className="primary" type="submit">{t.apply}</button></div></form></Modal>;
}
