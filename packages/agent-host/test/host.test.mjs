/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { mkdtemp, cp, readFile, rm, stat, access, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
let temporary;
let artifact;
let binary;
before(async () => {
	temporary = await mkdtemp(path.join(tmpdir(), 'standalone-agent-'));
	artifact = path.join(temporary, 'relocated');
	await cp(path.join(packageRoot, 'dist-test'), artifact, { recursive: true });
	binary = path.join(artifact, 'bin', process.platform === 'win32' ? 'node.exe' : 'node');
});
after(async () => { await rm(temporary, { recursive: true, force: true }); });

async function start(entry = 'start-test.mjs', userData = path.join(temporary, randomUUID()), extra = [], environment = {}) {
	const child = spawn(binary, [path.join(artifact, entry), '--user-data-dir', userData, ...extra], {
		cwd: temporary, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, HOME: temporary, PATH: '/usr/bin:/bin', ...environment },
	});
	let stdout = '';
	let stderr = '';
	child.stdout.on('data', data => { stdout += data; });
	child.stderr.on('data', data => { stderr += data; });
	const exited = once(child, 'exit');
	let ready;
	try {
		ready = await new Promise((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error(`Readiness timeout: ${stderr}`)), 20000);
			const inspect = () => {
				for (const line of stdout.split('\n')) {
					try { const frame = JSON.parse(line); if (frame.type === 'ready') { clearTimeout(timeout); resolve(frame); } } catch { /* Incomplete frame. */ }
				}
			};
			child.stdout.on('data', inspect);
			child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Startup exited ${code}: ${stderr}`)); });
		});
	} catch (error) { child.kill('SIGKILL'); await exited; throw error; }
	return { child, ready, userData, exited, output: () => ({ stdout, stderr }), stop: async (signal) => {
		if (signal) { child.kill(signal); } else { child.stdin.end(); }
		const timeout = setTimeout(() => child.kill('SIGKILL'), 10000);
		const result = await exited;
		clearTimeout(timeout);
		return result;
	} };
}

async function connect(ready, token) {
	const socket = new WebSocket(`ws://127.0.0.1:${ready.port}/?tkn=${encodeURIComponent(token)}`);
	await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', () => reject(new Error('WebSocket rejected')), { once: true }); });
	let sequence = 0;
	const pending = new Map();
	const notifications = [];
	socket.addEventListener('message', event => {
		const frame = JSON.parse(event.data);
		if (Object.hasOwn(frame, 'id') && (Object.hasOwn(frame, 'result') || frame.error)) { pending.get(frame.id)?.(frame); }
		else { notifications.push(frame); }
	});
	return { socket, notifications, call: async (method, params) => {
		const id = ++sequence;
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 15000);
			pending.set(id, frame => { clearTimeout(timeout); pending.delete(id); if (frame.error) { reject(new Error(JSON.stringify(frame.error))); } else { resolve(frame.result); } });
			socket.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
		});
	}, dispatch: params => socket.send(JSON.stringify({ jsonrpc: '2.0', method: 'dispatchAction', params })) };
}

async function initialize(client, clientId) {
	return client.call('initialize', { channel: 'ahp-root://', protocolVersions: ['1.0.0', '0.9.0'], clientId });
}

async function waitUntil(condition) {
	const deadline = Date.now() + 15000;
	while (Date.now() < deadline) { if (await condition()) { return; } await new Promise(resolve => setTimeout(resolve, 20)); }
	assert.fail('Condition timed out');
}

test('relocated mock host: token rejection, released AHP, auth, session, streaming, two clients, cancellation and stdin stop', { timeout: 60000 }, async () => {
	const host = await start();
	const clients = [];
	const session = `mock:/${randomUUID()}`;
	try {
		await assert.rejects(connect(host.ready, 'incorrect-token'), /rejected/);
		await assert.rejects(connect(host.ready, ''), /rejected/);
		const token = await readFile(host.ready.tokenFile, 'utf8');
		assert.equal((await stat(host.ready.tokenFile)).mode & 0o777, 0o600);
		assert.equal(JSON.stringify(host.output()).includes(token), false);
		const client = await connect(host.ready, token); clients.push(client);
		const init = await initialize(client, 'standalone-test-a');
		assert.equal(init.protocolVersion, '1.0.0');
		await assert.rejects(client.call('authenticate', { channel: 'ahp-root://', resource: 'https://fixture.invalid', token: 'invalid-account-token' }), /Authentication failed/);
		await client.call('authenticate', { channel: 'ahp-root://', resource: 'https://fixture.invalid', token: 'fixture-account-token' });

		await client.call('createSession', { channel: session, provider: 'mock', workingDirectories: [pathToFileURL(temporary).href], config: { isolation: 'folder' } });
		const subscribed = await client.call('subscribe', { channel: session });
		const chat = subscribed.snapshot.state.defaultChat;
		assert.equal(typeof chat, 'string');
		await client.call('subscribe', { channel: chat });
		const second = await connect(host.ready, token); clients.push(second);
		await initialize(second, 'standalone-test-b');
		await second.call('subscribe', { channel: session });
		await second.call('subscribe', { channel: chat });
		client.dispatch({ channel: chat, clientSeq: 1, action: { type: 'chat/turnStarted', turnId: 'turn-hello', startedAt: '2026-10-28T00:00:00.000Z', message: { text: 'hello', origin: { kind: 'user' } } } });
		await waitUntil(() => clients.every(c => JSON.stringify(c.notifications).includes('Hello, world!')));
		await waitUntil(async () => JSON.stringify(await client.call('subscribe', { channel: chat })).includes('Hello, world!'));
		await waitUntil(() => JSON.stringify(second.notifications).includes('chat/turnComplete'));
		client.dispatch({ channel: chat, clientSeq: 2, action: { type: 'chat/turnStarted', turnId: 'turn-slow', startedAt: '2026-10-28T00:00:01.000Z', message: { text: 'slow', origin: { kind: 'user' } } } });
		await waitUntil(() => JSON.stringify(client.notifications).includes('turn-slow'));
		client.dispatch({ channel: chat, clientSeq: 3, action: { type: 'chat/turnCancelled', turnId: 'turn-slow', duration: 0 } });
		await waitUntil(() => JSON.stringify(second.notifications).includes('chat/turnCancelled'));
		await new Promise(resolve => setTimeout(resolve, 5200));
		assert.equal(JSON.stringify(second.notifications).includes('Slow response.'), false);
		client.dispatch({ channel: session, clientSeq: 4, action: { type: 'session/titleChanged', title: 'fixture-restored-title' } });
		await waitUntil(async () => JSON.stringify(await client.call('listSessions', { channel: 'ahp-root://' })).includes('fixture-restored-title'));
		assert.equal(JSON.stringify(host.output()).includes('fixture-account-token'), false);
	} finally {
		for (const client of clients) { client.socket.close(); }
		assert.deepEqual(await host.stop(), [0, null]);
	}
	await assert.rejects(access(host.ready.tokenFile));
	await access(path.join(host.userData, 'User', 'globalStorage', 'agent-host.db'));
	const restarted = await start('start-test.mjs', host.userData, [], { VSCODE_AGENT_HOST_MOCK_SEED_SESSIONS: session });
	try {
		const client = await connect(restarted.ready, await readFile(restarted.ready.tokenFile, 'utf8'));
		try { await initialize(client, 'after-restart'); assert.match(JSON.stringify(await client.call('listSessions', { channel: 'ahp-root://' })), /fixture-restored-title/); } finally { client.socket.close(); }
	} finally { assert.deepEqual(await restarted.stop(), [0, null]); }
});

test('production Copilot provider boots and stops on SIGTERM without a real credential', { timeout: 40000 }, async () => {
	const host = await start('start.mjs');
	try {
		const token = await readFile(host.ready.tokenFile, 'utf8');
		const client = await connect(host.ready, token);
		try {
			await initialize(client, 'standalone-production');
			const root = await client.call('subscribe', { channel: 'ahp-root://' });
			const serialized = JSON.stringify(root);
			assert.match(serialized, /copilot/);
			assert.doesNotMatch(serialized, /"id":"mock"|"id":"claude"|"id":"codex"/);
		} finally { client.socket.close(); }
	} finally { assert.deepEqual(await host.stop('SIGTERM'), [0, null]); }
});

test('worker, native SQLite/PTY, WASM, recursive watcher and SDK assets load with shipped Node', { timeout: 40000 }, async context => {
	const child = spawn(binary, [path.join(artifact, 'resource-probe.mjs')], { cwd: temporary, env: { ...process.env, HOME: temporary }, stdio: ['ignore', 'pipe', 'pipe'] });
	let output = ''; let errors = '';
	child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { errors += data; });
	const timer = setTimeout(() => child.kill('SIGKILL'), 30000);
	const result = await once(child, 'exit'); clearTimeout(timer);
	assert.deepEqual({ result, errors: result[0] === 0 ? '' : errors }, { result: [0, null], errors: '' });
	assert.match(output, /"worker":true/);
	context.diagnostic(output.trim());
});

test('production manifest excludes development/test entry points and Electron', async () => {
	const manifest = JSON.parse(await readFile(path.join(packageRoot, 'dist/manifest.json'), 'utf8'));
	assert.equal(manifest.testing, false);
	assert.equal(manifest.files.some(file => /(?:node_modules\/(?:electron|esbuild|mocha)|agentHost\/test\/|mockMain|start-test|editor\.all|sessions\.common\.main)/.test(file.path)), false);
	assert.equal(manifest.files.some(file => file.path.endsWith('diffWorkerMain.js')), true);
});


test('invalid options and port conflicts produce machine-readable failures and clean token files', { timeout: 40000 }, async () => {
	await assert.rejects(start('start.mjs', path.join(temporary, 'invalid'), ['--port', '-1']), /INVALID_OPTIONS/);
	const listener = createServer();
	listener.listen(0, '127.0.0.1');
	await once(listener, 'listening');
	const userData = path.join(temporary, 'conflict');
	try { await assert.rejects(start('start.mjs', userData, ['--port', String(listener.address().port)]), /EADDRINUSE/); }
	finally { await new Promise(resolve => listener.close(resolve)); }
	assert.equal((await readdir(userData)).some(name => name.startsWith('.connection-')), false);
});
