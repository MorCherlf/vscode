/* Copyright (c) Microsoft Corporation. All rights reserved. */
/* Licensed under the MIT License. See LICENSE.txt in the project root for license information. */
import { memo, useLayoutEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AgentClient, supportsQuestion, supportsInputUrl, type InputValue, type ChatState, type ChatInputRequest, type ChatInputQuestion } from '@morcherlf/agent-client-core';
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

export function Transcript({ state, chat, connected, client, onError, onOpenUrl }: { state?: ChatState; chat: string; connected: boolean; client: AgentClient; onError(message: string): void; onOpenUrl?(url: string): Promise<void> }) {
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
				if (part.kind === 'inputRequest') { return <InputPrompt key={part.request.id} request={part.request} chat={chat} active={turn.id === state?.activeTurn?.id && !part.response} connected={connected} client={client} onError={onError} onOpenUrl={onOpenUrl}/>; }
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
export function InputPrompt({ request, chat, active, connected, client, onError, onOpenUrl }: { request: ChatInputRequest; chat: string; active: boolean; connected: boolean; client: AgentClient; onError(message: string): void; onOpenUrl?(url: string): Promise<void> }) {
	const [values, setValues] = useState<Record<string, InputValue>>({});
	const [submitted, setSubmitted] = useState(false);
	const [opened, setOpened] = useState(false);
	const supported = (request.questions ?? []).every(supportsQuestion) && (!request.url || (supportsInputUrl(request.url) && !!onOpenUrl));
	const disabled = !active || !connected || submitted;
	const answer = (action: () => void) => { if (disabled) { return; } try { action(); setSubmitted(true); } catch { onError(t.inputInvalid); } };
	return <section className="input-request"><h3>{t.question}</h3><p>{request.message}</p>{active && <>
		{supported ? <form aria-label={t.question} onSubmit={event => { event.preventDefault(); if (request.url && !opened) { return; } answer(() => client.answerForm(chat, request.id, values)); }}>
			{request.url && <><p>{t.urlReview}</p><code>{request.url}</code><button type="button" disabled={disabled} onClick={() => { void onOpenUrl!(request.url!).then(() => setOpened(true)).catch(() => onError(t.error)); }}>{t.openRequest}</button></>}
			{request.questions?.map(question => <Question key={question.id} question={question} disabled={disabled} value={values[question.id]} onChange={value => setValues(previous => ({ ...previous, [question.id]: value }))}/>)}
			<button className="primary" disabled={disabled || (!!request.url && !opened)}>{request.questions?.length ? t.submit : t.accept}</button>
		</form> : <p className="muted">{t.unsupported}</p>}
		<button disabled={disabled} onClick={() => answer(() => client.acceptInput(chat, request.id, false))}>{t.reject}</button>
		<button disabled={disabled} onClick={() => answer(() => client.cancelInput(chat, request.id))}>{t.back}</button>
	</>}</section>;
}
function Question({ question, disabled, value, onChange }: { question: ChatInputQuestion; disabled: boolean; value?: InputValue; onChange(value: InputValue): void }) {
	const initial = 'defaultValue' in question ? question.defaultValue : undefined;
	const selected = value ?? initial;
	const label = question.title || question.message;
	if (question.kind === 'boolean') {
		return <label className="field">{label}<select aria-label={label} disabled={disabled} required={question.required} value={selected === undefined ? '' : String(selected)} onChange={event => onChange(event.target.value === '' ? '' : event.target.value === 'true')}><option value=""></option><option value="true">{t.yes}</option><option value="false">{t.no}</option></select></label>;
	}
	if (question.kind === 'single-select' && question.allowFreeformInput) {
		return <label className="field">{label}<input list={'choices-' + question.id} disabled={disabled} required={question.required} value={typeof selected === 'string' ? selected : ''} onChange={event => onChange(event.target.value)}/><datalist id={'choices-' + question.id}>{question.options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</datalist></label>;
	}
	if (question.kind === 'multi-select' && question.allowFreeformInput) {
		const choices = Array.isArray(selected) ? selected : [];
		return <fieldset disabled={disabled}><legend>{label}</legend>{question.options.map(option => <label key={option.id}><input type="checkbox" checked={choices.includes(option.id)} onChange={event => onChange(event.target.checked ? [...choices, option.id] : choices.filter(id => id !== option.id))}/>{option.label}</label>)}<label className="field">{t.freeform}<textarea value={choices.filter(id => !question.options.some(option => option.id === id)).join('\n')} onChange={event => onChange([...choices.filter(id => question.options.some(option => option.id === id)), ...event.target.value.split('\n').filter(Boolean)])}/></label></fieldset>;
	}
	if (question.kind === 'single-select' || question.kind === 'multi-select') {
		return <label className="field">{label}<select aria-label={label} multiple={question.kind === 'multi-select'} required={question.required} disabled={disabled} value={question.kind === 'multi-select' ? (Array.isArray(selected) ? selected : []) : typeof selected === 'string' ? selected : ''} onChange={event => onChange(question.kind === 'multi-select' ? [...event.target.selectedOptions].map(option => option.value) : event.target.value)}>{question.kind === 'single-select' && <option value=""></option>}{question.options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>;
	}
	return <label className="field">{label}<input disabled={disabled} required={question.required} type={question.kind === 'text' ? (question.format === 'email' ? 'email' : 'text') : 'number'} step={question.kind === 'integer' ? 1 : 'any'} min={question.kind === 'text' ? undefined : question.min} max={question.kind === 'text' ? undefined : question.max} minLength={question.kind === 'text' ? question.min : undefined} maxLength={question.kind === 'text' ? question.max : undefined} value={typeof selected === 'string' || typeof selected === 'number' ? selected : ''} onChange={event => onChange(event.target.value)}/></label>;
}
