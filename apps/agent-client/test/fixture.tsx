/* Copyright (c) Microsoft Corporation. All rights reserved. */
/* Licensed under the MIT License. See LICENSE.txt in the project root for license information. */
// Test-only entry, built into a temporary directory. Never an entry of the production bundle.
import { createRoot } from 'react-dom/client';
import { AgentClient, TauriTransport, inputAnswers, type NativeBridge } from '@morcherlf/agent-client-core';
import { App } from '../src/App';
import { MarkdownText, InputPrompt } from '../src/Transcript';
import type { ClientRuntime } from '../src/runtime';

let generation = 0;
function bridge(): NativeBridge {
	let socket: WebSocket;
	let current: number;
	return {
		open: async receive => {
			current = ++generation; const local = current; let sequence = 0;
			socket = new WebSocket(location.origin.replace('http:', 'ws:') + '/fixture-socket');
			socket.addEventListener('message', event => receive({ kind: 'frame', generation: local, sequence: ++sequence, text: String(event.data) }));
			socket.addEventListener('close', () => receive({ kind: 'closed', generation: local, reason: 'HOST_DISCONNECTED' }));
			await new Promise<void>((resolve, reject) => { socket.addEventListener('open', () => resolve(), { once: true }); socket.addEventListener('error', reject, { once: true }); });
			return local;
		},
		send: async (value, text) => { if (value !== current) { throw new Error('STALE_GENERATION'); } socket.send(text); },
		ack: async () => {},
		close: async () => { socket.close(); },
	};
}
const runtime: ClientRuntime = {
	available: true,
	connect: () => TauriTransport.connect(bridge()),
	onQuit: async () => () => {},
	quit: async () => { document.body.dataset.quit = 'requested'; },
};
const root = createRoot(document.getElementById('root')!);
if (new URLSearchParams(location.search).has('inputs')) {
	class FormClient extends AgentClient {
		override answerForm(_chat: string, requestId: string, values: Record<string, import('@morcherlf/agent-client-core').InputValue>) { document.body.dataset.answer = JSON.stringify({ requestId, answers: inputAnswers(form, values) }); }
		override acceptInput() { document.body.dataset.answer = 'decline'; }
		override cancelInput() { document.body.dataset.answer = 'cancel'; }
	}
	const form = { id: 'browser-form', questions: [
		{ id: 'name', kind: 'text', message: 'Name', required: true, min: 2, max: 5 },
		{ id: 'count', kind: 'integer', message: 'Count', required: true, min: 0, max: 4 },
		{ id: 'ratio', kind: 'number', message: 'Ratio', required: true, min: 0, max: 1 },
		{ id: 'flag', kind: 'boolean', message: 'Flag', required: true },
		{ id: 'one', kind: 'single-select', message: 'One', options: [{ id: 'a', label: 'A' }] },
		{ id: 'many', kind: 'multi-select', message: 'Many', required: true, min: 1, max: 2, options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] },
	] } as import('@morcherlf/agent-client-core').ChatInputRequest;
	const url = new URLSearchParams(location.search).has('url');
	root.render(<InputPrompt request={url ? { id: 'url-form', url: 'https://github.com/login/device' } : form} chat="fixture:/chat" active connected client={new FormClient()} onError={message => { document.body.dataset.error = message; }} onOpenUrl={async () => { document.body.dataset.opened = 'yes'; }}/>);
} else if (new URLSearchParams(location.search).has('markdown')) {
	root.render(<MarkdownText text={'# Safe heading\n\n**Bold** and `inline code`.\n\n| A | B |\n| - | - |\n| one | two |\n\n```js\nconst value = "<script>bad()</script>";\n```\n\n<img src="https://fixture.invalid/track" onerror="window.injected=true">\n\n![remote](https://fixture.invalid/image)\n\n[unsafe](javascript:alert(1)) [command](command:workbench.action.files.openFolder)\n\n<script>window.injected=true</script>'}/>);
} else {
	root.render(<App client={new AgentClient('ui-fixture')} runtime={runtime}/>);
}
