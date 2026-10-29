/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InMemoryTransport } from '@microsoft/agent-host-protocol/client';
import { AgentClient, TauriTransport } from '../dist/index.js';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const session = 'custom-session:/opaque-identity';
const chat = 'custom-chat:/no-derivation';
const chatState = () => ({ resource: chat, title: 'Test', status: 1, modifiedAt: '2026-10-28T00:00:00.000Z', turns: [], pendingMessages: [] });

function fixture(race = false) {
	const mutations = [];
	let title = 'From snapshot'; let sequence = 1;
	return { mutations, connect: () => {
		const [transport, server] = InMemoryTransport.pair();
		void (async () => {
			for (;;) {
				const frame = await server.recv(); if (!frame) { break; }
				const request = JSON.parse(frame.text);
				if (!request.id) { mutations.push(request); continue; }
				let result;
				if (request.method === 'initialize') { result = { protocolVersion: '1.0.0', serverInfo: { name: 'fixture', version: '1' }, snapshots: [] }; }
				else if (request.method === 'listSessions') { result = { items: [{ resource: session, title, provider: 'mock' }] }; }
				else if (request.method === 'subscribe') {
					const resource = request.params.channel;
					result = { snapshot: { resource, fromSeq: sequence++, state: resource === 'ahp-root://' ? { agents: [] } : resource === session ? { resource, title, defaultChat: chat, chats: [], workingDirectories: [], status: 1 } : chatState() } };
				} else { result = {}; }
				if (race && request.method === 'subscribe' && request.params.channel === chat) { await server.send({ jsonrpc: '2.0', method: 'action', params: { channel: chat, serverSeq: 99, action: { type: 'chat/turnStarted', turnId: 'snapshot-race', startedAt: '2026-10-28T00:00:00.000Z', message: { text: 'race', origin: { kind: 'user' } } } } }); }
				await server.send({ jsonrpc: '2.0', id: request.id, result });
			}
		})();
		return { transport, server, setTitle(value) { title = value; } };
	} };
}

test('official client negotiates released protocol, preserves opaque identities and resubscribes without replaying mutations', async () => {
	const host = fixture(); const first = host.connect(); const client = new AgentClient('stable-client');
	try {
		await client.connect(first.transport);
		assert.equal(await client.selectSession(session), chat);
		client.send(chat, 'do once'); await delay(10);
		await first.server.close(); await delay(10);
		assert.equal(client.status, 'resync-required');
		assert.throws(() => client.send(chat, 'blocked offline'), /RESYNC_REQUIRED/);
		const second = host.connect(); second.setTitle('Restored snapshot');
		await client.connect(second.transport);
		assert.deepEqual({ status: client.status, title: client.getSession(session).title, mutations: host.mutations.filter(frame => frame.method === 'dispatchAction').length }, { status: 'ready', title: 'Restored snapshot', mutations: 1 });
	} finally { await client.disconnect(); }
});

test('Tauri transport ignores old generations, acknowledges consumed frames and fails closed on overflow', async () => {
	let receive; const calls = [];
	const bridge = { open: async callback => { receive = callback; return 7; }, send: async () => {}, ack: async (generation, sequence) => { calls.push([generation, sequence]); }, close: async generation => { calls.push(['close', generation]); } };
	const transport = await TauriTransport.connect(bridge, 2);
	receive({ kind: 'frame', generation: 6, sequence: 1, text: 'old' });
	receive({ kind: 'frame', generation: 7, sequence: 2, text: '{}' });
	assert.deepEqual(await transport.recv(), { kind: 'text', text: '{}' });
	receive({ kind: 'frame', generation: 7, sequence: 3, text: '{}' });
	receive({ kind: 'frame', generation: 7, sequence: 4, text: '{}' });
	receive({ kind: 'frame', generation: 7, sequence: 5, text: '{}' });
	await assert.rejects(transport.recv(), /BACKPRESSURE_RESYNC_REQUIRED/);
	assert.deepEqual(calls, [[7, 2], ['close', 7]]);
});

test('outbound failure is an unknown outcome; transport never retries a side effect', async () => {
	let sends = 0;
	const transport = await TauriTransport.connect({ open: async () => 1, send: async () => { sends++; throw new Error('disconnected'); }, ack: async () => {}, close: async () => {} });
	await assert.rejects(transport.send({ jsonrpc: '2.0', method: 'dispatchAction' }), /SEND_OUTCOME_UNKNOWN/);
	await assert.rejects(transport.send('{}'), /SEND_OUTCOME_UNKNOWN/);
	assert.equal(sends, 1);
});

test('snapshot/action race is reconciled with the official chat reducer', async () => {
	const host = fixture(true); const connection = host.connect(); const client = new AgentClient();
	try {
		await client.connect(connection.transport); await client.selectSession(session);
		assert.equal(client.getChat(chat).activeTurn.id, 'snapshot-race');
		await connection.server.send({ jsonrpc: '2.0', method: 'action', params: { channel: chat, serverSeq: 100, action: { type: 'chat/turnStarted', turnId: 'one', startedAt: '2026-10-28T00:00:00.000Z', message: { text: 'hello', origin: { kind: 'user' } } } } });
		await delay(5);
		assert.equal(client.getChat(chat).activeTurn.id, 'one');
		await connection.server.send({ jsonrpc: '2.0', method: 'action', params: { channel: chat, serverSeq: 101, action: { type: 'chat/turnCancelled', turnId: 'one', duration: 0 } } });
		await delay(5);
		assert.equal(client.getChat(chat).activeTurn, undefined);
	} finally { await client.disconnect(); }
});

test('input requests and tool denials use the official action contract without an execution bypass', async () => {
	const host = fixture(); const connection = host.connect(); const client = new AgentClient();
	try {
		await client.connect(connection.transport); await client.selectSession(session);
		await connection.server.send({ jsonrpc: '2.0', method: 'action', params: { channel: chat, serverSeq: 100, action: { type: 'chat/turnStarted', turnId: 'input-turn', startedAt: '2026-10-28T00:00:00.000Z', message: { text: 'ask me', origin: { kind: 'user' } } } } });
		await connection.server.send({ jsonrpc: '2.0', method: 'action', params: { channel: chat, serverSeq: 101, action: { type: 'chat/inputRequested', request: { id: 'input-1', message: 'Name?', questions: [{ id: 'name', kind: 'text', message: 'Your name', required: true }] } } } });
		await delay(5);
		assert.equal(client.getChat(chat).activeTurn.responseParts.find(part => part.kind === 'inputRequest').request.id, 'input-1');
		client.answerText(chat, 'input-1', { name: 'fixture' });
		client.confirmTool(chat, 'input-turn', 'tool-1', false); await delay(5);
		assert.deepEqual(host.mutations.filter(frame => frame.method === 'dispatchAction').map(frame => frame.params.action), [
			{ type: 'chat/inputCompleted', requestId: 'input-1', response: 'accept', answers: { name: { state: 'submitted', value: { kind: 'text', value: 'fixture' } } } },
			{ type: 'chat/toolCallConfirmed', turnId: 'input-turn', toolCallId: 'tool-1', approved: false, reason: 'denied' },
		]);
	} finally { await client.disconnect(); }
});

test('input cancellation, duplicate/stale responses and reconnect preserve unknown outcomes without replay', async () => {
	const host = fixture(); const first = host.connect(); const client = new AgentClient();
	const action = async (connection, serverSeq, action) => { await connection.server.send({ jsonrpc: '2.0', method: 'action', params: { channel: chat, serverSeq, action } }); await delay(5); };
	try {
		await client.connect(first.transport); await client.selectSession(session);
		await action(first, 100, { type: 'chat/turnStarted', turnId: 'turn', startedAt: '2026-10-29T00:00:00.000Z', message: { text: 'ask', origin: { kind: 'user' } } });
		await action(first, 101, { type: 'chat/inputRequested', request: { id: 'r', questions: [{ id: 'v', kind: 'integer', required: true }] } });
		client.answerForm(chat, 'r', { v: '3' });
		assert.throws(() => client.answerForm(chat, 'r', { v: '4' }), /OUTCOME_UNKNOWN/);
		await first.server.close(); await delay(5);
		assert.throws(() => client.answerForm(chat, 'r', { v: '4' }), /RESYNC_REQUIRED/);
		const second = host.connect(); await client.connect(second.transport);
		// The same still-open request in a fresh snapshot/action is not permission to resend.
		await action(second, 200, { type: 'chat/turnStarted', turnId: 'turn', startedAt: '2026-10-29T00:00:00.000Z', message: { text: 'ask', origin: { kind: 'user' } } });
		await action(second, 201, { type: 'chat/inputRequested', request: { id: 'r', questions: [{ id: 'v', kind: 'integer' }] } });
		assert.throws(() => client.answerForm(chat, 'r', { v: '4' }), /OUTCOME_UNKNOWN/);
		await action(second, 202, { type: 'chat/inputRequested', request: { id: 'resolved-elsewhere' } });
		await action(second, 203, { type: 'chat/inputCompleted', requestId: 'resolved-elsewhere', response: 'cancel' });
		assert.throws(() => client.answer(chat, 'resolved-elsewhere', 'accept'), /OUTCOME_UNKNOWN/);
		await action(second, 204, { type: 'chat/inputRequested', request: { id: 'cancel-me' } });
		client.answer(chat, 'cancel-me', 'cancel');
		await action(second, 205, { type: 'chat/turnCancelled', turnId: 'turn', duration: 0 });
		assert.throws(() => client.answer(chat, 'r', 'accept'), /OUTCOME_UNKNOWN/);
		await delay(5);
		assert.deepEqual(host.mutations.filter(frame => frame.method === 'dispatchAction').map(frame => frame.params.action.response), ['accept', 'cancel']);
	} finally { await client.disconnect(); }
});
