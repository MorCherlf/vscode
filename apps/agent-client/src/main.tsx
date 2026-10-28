/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { AgentClient, TauriTransport, type ChatState, type ChatInputRequest } from '@morcherlf/agent-client-core';
import { nativeBridge } from './bridge';
import { labels as t } from './i18n';
import './style.css';

const client = new AgentClient();

function projectUri(directory: string): string {
	if (!directory.startsWith('/')) { throw new Error('Absolute project directory required'); }
	const uri = new URL('file:///'); uri.pathname = directory; return uri.href;
}
function App() {
	const [, render] = useState(0);
	const [directory, setDirectory] = useState(''); const [session, setSession] = useState(''); const [chat, setChat] = useState('');
	const [draft, setDraft] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
	const [quit, setQuit] = useState(false); const [wait, setWait] = useState(false);
	const current = chat ? client.getChat(chat) : undefined;
	const active = client.hasActiveTurns() || client.status === 'resync-required';
	const run = async (action: () => Promise<void>) => { setBusy(true); setError(''); try { await action(); } catch (error) { setError(error instanceof Error ? error.message : t.error); } finally { setBusy(false); } };
	useEffect(() => client.onChange(() => render(value => value + 1)), []);
	useEffect(() => {
		let dispose: (() => void) | undefined; let alive = true;
		if (isTauri()) { void listen('quit-requested', () => setQuit(true)).then(unlisten => { if (alive) { dispose = unlisten; } else { unlisten(); } }); }
		return () => { alive = false; dispose?.(); };
	}, []);
	useEffect(() => { if (wait && !active && client.status === 'ready') { void invoke('host_quit').catch(() => { setWait(false); setError(t.error); }); } }, [wait, active, client.status]);
	const connect = () => run(async () => { await client.connect(await TauriTransport.connect(nativeBridge())); });
	const choose = (uri: string) => run(async () => { const chat = await client.selectSession(uri); setSession(uri); setChat(chat); });
	const create = () => run(async () => {
		const provider = client.root?.agents[0]?.provider; if (!provider) { throw new Error('PROVIDER_UNAVAILABLE'); }
		const uri = await client.createSession(provider, projectUri(directory));
		setSession(uri); setChat(await client.selectSession(uri));
	});
	const send = () => { if (!draft.trim() || !chat || busy || client.status !== 'ready' || current?.activeTurn) { return; } try { client.send(chat, draft.trim()); setDraft(''); } catch (error) { setError(String(error)); } };
	return <div className="app">
		<aside><header><span className="mark">M</span><strong>{t.app}</strong></header><p className="muted">{t.subtitle}</p>
			<label htmlFor="project">{t.projects}</label><input id="project" value={directory} onChange={event => setDirectory(event.target.value)} placeholder={t.projectPath}/>
			<button className="primary" disabled={!directory || busy || client.status !== 'ready'} onClick={() => void create()}>{t.newSession}</button>
			<h2>{t.sessions}</h2><nav aria-label={t.sessions}>{client.sessions.map(item => <button className={session === item.resource ? 'selected' : ''} key={item.resource} disabled={busy} onClick={() => void choose(item.resource)}>{item.title || item.resource}</button>)}</nav>
			<footer><button disabled title={t.account}>{t.signIn}</button><p className="muted">{t.account}</p><button disabled={!isTauri()} onClick={() => setQuit(true)}>{t.quit}</button></footer>
		</aside>
		<main><div className="toolbar"><span role="status" className={'status ' + client.status}>{t[client.status]}</span><button disabled={!isTauri() || busy} onClick={() => void connect()}>{client.status === 'offline' ? t.connect : t.reconnect}</button></div>
			{!isTauri() && <p className="notice">{t.desktop}</p>}{error && <p role="alert" className="notice error">{error}</p>}{wait && <p className="notice">{t.waiting}</p>}
			<section className="conversation" aria-live="polite" aria-label={t.sessions}>{current ? <Transcript state={current} chat={chat} connected={client.status === 'ready'}/> : <div className="empty"><h1>{session ? t.select : t.empty}</h1><p className="muted">{t.subtitle}</p></div>}</section>
			<form className="composer" onSubmit={event => { event.preventDefault(); send(); }}><textarea aria-label={t.prompt} value={draft} onChange={event => setDraft(event.target.value)} placeholder={t.prompt} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); send(); } }}/><div><button type="button" disabled={!current?.activeTurn || client.status !== 'ready'} onClick={() => current?.activeTurn && client.cancel(chat, current.activeTurn.id)}>{t.cancel}</button><button className="primary" disabled={!draft.trim() || !chat || client.status !== 'ready' || busy || !!current?.activeTurn}>{t.send}</button></div></form>
		</main>
		{quit && <div className="scrim"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="quit-title"><h2 id="quit-title">{t.quitTitle}</h2>{active && <p>{t.quitDetail}</p>}<div><button onClick={() => { setQuit(false); setWait(false); }}>{t.keep}</button>{active && <button onClick={() => { setWait(true); setQuit(false); }}>{t.wait}</button>}<button className="primary" onClick={() => void run(async () => { await client.disconnect(); await invoke('host_quit'); })}>{t.stop}</button></div></section></div>}
	</div>;
}
function Transcript({ state, chat, connected }: { state: ChatState; chat: string; connected: boolean }) {
	const turns = [...state.turns, ...(state.activeTurn ? [state.activeTurn] : [])];
	return <>{turns.map(turn => <article key={turn.id}><p className="user-message">{turn.message.text}</p>{turn.responseParts.map((part, index) => {
		if (part.kind === 'markdown' || part.kind === 'reasoning') { return <pre className="answer" key={index}>{part.content}</pre>; }
		if (part.kind === 'toolCall') { return <details key={index}><summary>{part.toolCall.displayName} · {part.toolCall.status}</summary><pre>{JSON.stringify(part.toolCall, null, 2)}</pre>{part.toolCall.status === 'pending-confirmation' && <div><button disabled={!connected} onClick={() => client.confirmTool(chat, turn.id, part.toolCall.toolCallId, true)}>{t.accept}</button><button disabled={!connected} onClick={() => client.confirmTool(chat, turn.id, part.toolCall.toolCallId, false)}>{t.reject}</button></div>}</details>; }
		if (part.kind === 'inputRequest') { return <InputPrompt key={part.request.id} request={part.request} chat={chat} connected={connected}/>; }
		return <pre key={index}>{JSON.stringify(part, null, 2)}</pre>;
	})}</article>)}</>;
}

function InputPrompt({ request, chat, connected }: { request: ChatInputRequest; chat: string; connected: boolean }) {
	const [values, setValues] = useState<Record<string, string>>({});
	const textOnly = request.questions?.every(question => question.kind === 'text') && !request.url;
	return <section className="notice"><h3>{t.question}</h3><p>{request.message}</p>{textOnly ? <form onSubmit={event => { event.preventDefault(); client.answerText(chat, request.id, values); }}>{request.questions?.map(question => <label key={question.id}>{question.title}<input required={question.required} value={values[question.id] ?? ''} onChange={event => setValues({ ...values, [question.id]: event.target.value })}/></label>)}<button disabled={!connected}>{t.send}</button></form> : !request.questions?.length && !request.url ? <button disabled={!connected} onClick={() => client.acceptInput(chat, request.id, true)}>{t.accept}</button> : <p>{t.unsupported}</p>}<button disabled={!connected} onClick={() => client.acceptInput(chat, request.id, false)}>{t.reject}</button></section>;
}

createRoot(document.getElementById('root')!).render(<App/>);
