/* Copyright (c) Microsoft Corporation. All rights reserved. */
/* Licensed under the MIT License. See LICENSE.txt in the project root for license information. */
import { memo, useLayoutEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AgentClient, type ChatState, type ChatInputRequest } from '@morcherlf/agent-client-core';
import { Icon } from './Icon';
import { labels as t } from './i18n';

type ResponsePart = ChatState['turns'][number]['responseParts'][number];
type ToolCall = Extract<ResponsePart, { kind: 'toolCall' }>['toolCall'];

/** React nodes only: raw HTML, remote media and native/external navigation stay disabled. */
export const MarkdownText = memo(function MarkdownText({ text }: { text: string }) {
	return <div className="markdown-body"><Markdown skipHtml remarkPlugins={[remarkGfm]} components={{
		a: ({ children, href }) => <span className="transcript-link" title={t.linksUnavailable + (href ? ' ' + href : '')}>{children}</span>,
		img: ({ alt }) => <span className="muted">{t.imageOmitted}{alt ? ': ' + alt : ''}</span>,
	}}>{text}</Markdown></div>;
});

export function Transcript({ state, chat, connected, client, onError }: { state?: ChatState; chat: string; connected: boolean; client: AgentClient; onError(message: string): void }) {
	const viewport = useRef<HTMLDivElement>(null);
	const follow = useRef(true);
	useLayoutEffect(() => { follow.current = true; }, [chat]);
	useLayoutEffect(() => {
		const element = viewport.current;
		if (element && follow.current) { element.scrollTop = element.scrollHeight; }
	}, [state, chat]);
	const turns = state ? [...state.turns, ...(state.activeTurn ? [state.activeTurn] : [])] : [];
	return <div className="conversation" ref={viewport} role="log" aria-label={t.sessions} aria-live="polite" onScroll={() => { const element = viewport.current; if (element) { follow.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; } }}>
		<div className="transcript-content">{turns.map(turn => <article className="chat-turn" key={turn.id}>
			<div className="request-message"><span className="sr-only">{t.you}</span><p>{turn.message.text}</p></div>
			<div className="response-heading"><Icon name="copilot"/><strong>{t.assistant}</strong>{turn.id === state?.activeTurn?.id && <span className="muted">{t.working}</span>}</div>
			{turn.responseParts.map((part, index) => {
				if (part.kind === 'markdown') { return <MarkdownText key={index} text={part.content}/>; }
				if (part.kind === 'reasoning') { return <details className="thinking" key={index}><summary>{t.thinking}</summary><MarkdownText text={part.content}/></details>; }
				if (part.kind === 'toolCall') { return <ToolCard key={part.toolCall.toolCallId} tool={part.toolCall} canAct={connected && turn.id === state?.activeTurn?.id} onDecision={approved => client.confirmTool(chat, turn.id, part.toolCall.toolCallId, approved)} onError={onError}/>; }
				if (part.kind === 'inputRequest') { return <InputPrompt key={part.request.id} request={part.request} chat={chat} active={turn.id === state?.activeTurn?.id} connected={connected} client={client} onError={onError}/>; }
				return <details className="tool-card" key={index}><summary>{t.toolDetails}</summary><pre>{JSON.stringify(part, null, 2)}</pre></details>;
			})}
			{turn.responseParts.some(part => part.kind === 'markdown') && <CopyButton text={turn.responseParts.filter(part => part.kind === 'markdown').map(part => part.content).join('\n\n')} onError={onError}/>}
		</article>)}</div>
	</div>;
}
function CopyButton({ text, onError }: { text: string; onError(message: string): void }) {
	const [copied, setCopied] = useState(false);
	const copy = async () => {
		try { if (!navigator.clipboard) { throw new Error(t.copyFailed); } await navigator.clipboard.writeText(text); setCopied(true); }
		catch { onError(t.copyFailed); }
	};
	return <button className="copy-button" title={t.copy} onClick={() => void copy()}><Icon name={copied ? 'check' : 'copy'}/><span>{copied ? t.copied : t.copy}</span></button>;
}
function ToolCard({ tool, canAct, onDecision, onError }: { tool: ToolCall; canAct: boolean; onDecision(approved: boolean): void; onError(message: string): void }) {
	const [submitted, setSubmitted] = useState(false);
	const pending = tool.status === 'pending-confirmation';
	const status = { streaming: t.toolStreaming, 'pending-confirmation': t.toolPending, running: t.toolRunning, completed: t.toolComplete, cancelled: t.toolCancelled, 'auth-required': t.toolAuth, 'pending-result-confirmation': t.toolResult };
	const decide = (approved: boolean) => {
		if (!canAct || submitted) { return; }
		try { onDecision(approved); setSubmitted(true); } catch (failure) { onError(String(failure)); }
	};
	return <section className={'tool-card' + (pending ? ' approval-card' : '')} aria-label={tool.displayName}>
		<details open={pending || undefined}><summary><Icon name={tool.status === 'completed' ? 'check' : tool.status === 'cancelled' ? 'circle-slash' : 'terminal'}/><span>{tool.displayName}</span><span className="tool-status">{status[tool.status]}</span></summary>
			{'toolInput' in tool && tool.toolInput !== undefined && <pre>{typeof tool.toolInput === 'string' ? tool.toolInput : JSON.stringify(tool.toolInput, null, 2)}</pre>}
			{'content' in tool && <pre>{JSON.stringify(tool.content, null, 2)}</pre>}
		</details>
		{pending && <div className="approval-actions"><button disabled={!canAct || submitted} onClick={() => decide(false)}>{t.reject}</button><button className="primary" disabled={!canAct || submitted} onClick={() => decide(true)}>{t.accept}</button></div>}
	</section>;
}
function InputPrompt({ request, chat, active, connected, client, onError }: { request: ChatInputRequest; chat: string; active: boolean; connected: boolean; client: AgentClient; onError(message: string): void }) {
	const [values, setValues] = useState<Record<string, string>>({});
	const [submitted, setSubmitted] = useState(false);
	const textOnly = !!request.questions?.length && request.questions.every(question => question.kind === 'text') && !request.url;
	const answer = (action: () => void) => { if (!active || !connected || submitted) { return; } try { action(); setSubmitted(true); } catch (failure) { onError(String(failure)); } };
	return <section className="input-request"><h3>{t.question}</h3><p>{request.message}</p>{active && <>
		{textOnly ? <form aria-label={t.question} onSubmit={event => { event.preventDefault(); answer(() => client.answerText(chat, request.id, values)); }}>{request.questions?.map(question => <label className="field" key={question.id}>{question.title || question.message}<input required={question.required} disabled={!connected || submitted} value={values[question.id] ?? ''} onChange={event => setValues(previous => ({ ...previous, [question.id]: event.target.value }))}/></label>)}<button className="primary" disabled={!connected || submitted}>{t.submit}</button></form> : !request.questions?.length && !request.url ? <button className="primary" disabled={!connected || submitted} onClick={() => answer(() => client.acceptInput(chat, request.id, true))}>{t.accept}</button> : <p className="muted">{t.unsupported}</p>}
		<button disabled={!connected || submitted} onClick={() => answer(() => client.acceptInput(chat, request.id, false))}>{t.reject}</button>
	</>}</section>;
}
