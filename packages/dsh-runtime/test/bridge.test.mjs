/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RuntimeBridge } from '../src/bridge.mjs';
async function fixture(t, run = async () => ({ finalResponse: 'fixture response' })) {
	const home = await mkdtemp(path.join(tmpdir(), 'dsh-bridge-test-')); t.after(() => rm(home, { recursive: true, force: true }));
	const calls = []; const events = []; const harness = { run: async (...args) => { calls.push(args); return run(...args); }, start: async () => {}, close: async () => {}, client: { request: async (...args) => calls.push(args) } };
	const config = { protocol: 1, version: '0.2.2-alpha.2', home, cwd: home };
	const bridge = new RuntimeBridge(() => harness, e => events.push(e)); await bridge.initialize(config);
	return { bridge, home, calls, events, harness, config };
}
test('fixture: concurrent creation serializes durable projections', async t => {
	const { bridge, home } = await fixture(t);
	const sessions = await Promise.all(Array.from({ length: 16 }, () => bridge.request('create')));
	const saved = JSON.parse(await readFile(path.join(home, 'vscode-projection.json'), 'utf8'));
	assert.equal(saved.length, 16); assert.equal(new Set(sessions.map(s => s.id)).size, 16);
});
test('fixture: runtime owns execution and original session resume is requested on restore', async t => {
	const f = await fixture(t); const item = await f.bridge.request('create');
	await f.bridge.request('send', { id: item.id, text: 'fixture prompt' });
	assert.equal(f.calls.length, 1); assert.equal(f.calls[0][1].sessionId, item.id);
	const restored = new RuntimeBridge(() => f.harness, () => {}); await restored.initialize(f.config);
	const result = await restored.request('history', { id: item.id });
	assert.equal(result.incomplete, false); assert.equal(result.history[0].response, 'fixture response');
	assert.deepEqual(f.calls[1], ['session/resume', { sessionId: item.id }]);
});
test('fixture: unknown side effect is not replayed, including after restart', async t => {
	const f = await fixture(t, async () => { throw new Error('simulated disconnect after dispatch'); }); const item = await f.bridge.request('create');
	await assert.rejects(f.bridge.request('send', { id: item.id, text: 'fixture prompt' }), /SEND_OUTCOME_UNKNOWN/);
	await assert.rejects(f.bridge.request('send', { id: item.id, text: 'retry' }), /OUTCOME_UNKNOWN/);
	const restored = new RuntimeBridge(() => f.harness, () => {}); await restored.initialize(f.config);
	assert.equal((await restored.request('history', { id: item.id })).incomplete, true);
	await assert.rejects(restored.request('send', { id: item.id, text: 'retry' }), /OUTCOME_UNKNOWN/); assert.equal(f.calls.length, 1);
});
test('fixture: busy session rejects duplicate; cancelling never kills shared harness', async t => {
	let complete; const f = await fixture(t, () => new Promise(r => { complete = r; })); const item = await f.bridge.request('create');
	const send = f.bridge.request('send', { id: item.id, text: 'fixture prompt' });
	while (!complete) { await new Promise(r => setTimeout(r, 1)); }
	assert.equal((await f.bridge.request('history', { id: item.id })).incomplete, true);
	await assert.rejects(f.bridge.request('send', { id: item.id, text: 'duplicate' }), /SESSION_BUSY/);
	await assert.rejects(f.bridge.request('cancel', { id: item.id }), /SESSION_CANCEL_UNSUPPORTED/);
	complete({ finalResponse: 'done' }); await send; assert.equal(f.calls.length, 1);
});
test('fixture: initialization is single-flight; unsupported config is explicit', async t => {
	const f = await fixture(t); await assert.rejects(f.bridge.initialize(f.config), /ALREADY_INITIALIZED/);
	const bridge = new RuntimeBridge(() => f.harness, () => {});
	await assert.rejects(bridge.initialize({ ...f.config, version: 'unverified' }), /UNSUPPORTED_RUNTIME_CONFIGURATION/);
	const first = bridge.initialize(f.config); await assert.rejects(bridge.initialize(f.config), /ALREADY_INITIALIZED/); await first;
});
