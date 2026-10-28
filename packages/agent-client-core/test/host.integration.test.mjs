/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AgentClient, TauriTransport } from '../dist/index.js';

async function until(condition) { const deadline = Date.now() + 10000; while (Date.now() < deadline) { if (condition()) { return; } await new Promise(resolve => setTimeout(resolve, 10)); } assert.fail('Timed out'); }

test('official SDK and bounded Tauri transport drive the existing M1 mock Host and converge after reconnect', { timeout: 40000 }, async () => {
	const root = fileURLToPath(new URL('../../agent-host/dist-test/', import.meta.url));
	const data = await mkdtemp(path.join(tmpdir(), 'm2-ahp-'));
	const host = spawn(path.join(root, 'bin/node'), [path.join(root, 'start-test.mjs'), '--user-data-dir', data], { stdio: ['pipe', 'pipe', 'pipe'] });
	const exited = once(host, 'exit'); let stdout = ''; let stderr = '';
	host.stdout.on('data', chunk => { stdout += chunk; }); host.stderr.on('data', chunk => { stderr += chunk; });
	const clients = [new AgentClient(), new AgentClient()];
	let generation = 0; let dispatches = 0;
	try {
		await until(() => stdout.includes('"ready"') || host.exitCode !== null);
		assert.equal(host.exitCode, null, stderr);
		const ready = JSON.parse(stdout.trim().split('\n').find(line => line.includes('"ready"')));
		const token = await readFile(ready.tokenFile, 'utf8');
		const bridge = () => {
			let socket; let current;
			return {
				open: async receive => {
					current = ++generation; const local = current; let sequence = 0;
					socket = new WebSocket(`ws://127.0.0.1:${ready.port}/?tkn=${token}`);
					socket.addEventListener('message', event => receive({ kind: 'frame', generation: local, sequence: ++sequence, text: event.data }));
					socket.addEventListener('close', () => receive({ kind: 'closed', generation: local, reason: 'HOST_DISCONNECTED' }));
					await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
					return local;
				},
				send: async (_generation, text) => { if (JSON.parse(text).method === 'dispatchAction') { dispatches++; } socket.send(text); },
				ack: async () => {}, close: async () => { socket.close(); },
			};
		};
		for (const client of clients) { await client.connect(await TauriTransport.connect(bridge())); }
		const session = await clients[0].createSession('mock', pathToFileURL(data).href);
		const chats = await Promise.all(clients.map(client => client.selectSession(session)));
		assert.equal(chats[0], chats[1]);
		clients[0].send(chats[0], 'hello');
		await until(() => clients.every((client, index) => JSON.stringify(client.getChat(chats[index])).includes('Hello, world!') && !client.getChat(chats[index]).activeTurn));
		await clients[0].disconnect();
		await clients[0].connect(await TauriTransport.connect(bridge()));
		assert.deepEqual({ sends: dispatches, transcriptRestored: JSON.stringify(clients[0].getChat(chats[0])).includes('Hello, world!') }, { sends: 1, transcriptRestored: true });
		clients[0].send(chats[0], 'slow');
		await until(() => !!clients[1].getChat(chats[1]).activeTurn);
		clients[0].cancel(chats[0], clients[0].getChat(chats[0]).activeTurn.id);
		await until(() => clients.every((client, index) => !client.getChat(chats[index]).activeTurn));
		assert.equal(JSON.stringify(clients.map(client => client.root)).includes(token), false);
	} finally {
		await Promise.all(clients.map(client => client.disconnect())); host.stdin.end();
		const timer = setTimeout(() => host.kill('SIGKILL'), 10000); const result = await exited; clearTimeout(timer);
		await rm(data, { recursive: true, force: true }); assert.deepEqual(result, [0, null]);
	}
});
