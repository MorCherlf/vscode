/* Copyright (c) Microsoft Corporation. All rights reserved. */
/* Licensed under the MIT License. See LICENSE.txt in the project root for license information. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile, chmod, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../dist-test/', import.meta.url));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(condition) { const deadline = Date.now() + 15000; while (Date.now() < deadline) { if (await condition()) { return; } await delay(20); } assert.fail('fault test deadline'); }

test('parent SIGKILL closes owned stdin; active and pending-approval mock Hosts stop and remove connection credentials', { timeout: 45000 }, async () => {
	for (const task of ['slow', 'permission']) {
		const data = await mkdtemp(path.join(tmpdir(), 'm2b-parent-'));
		const parent = spawn(process.execPath, [fileURLToPath(new URL('./parent-fixture.mjs', import.meta.url)), root, data, task], { stdio: ['ignore', 'pipe', 'pipe'] });
		const exited = once(parent, 'exit'); let output = ''; let errors = ''; parent.stdout.on('data', value => { output += value; }); parent.stderr.on('data', value => { errors += value; });
		let ready;
		try {
			await until(() => output.includes('"active"') || parent.exitCode !== null); assert.equal(parent.exitCode, null, errors);
			ready = JSON.parse(output.trim()); parent.kill('SIGKILL'); await exited;
			await until(async () => { try { await access(ready.tokenFile); return false; } catch { return true; } });
			if (process.platform === 'linux') { await until(async () => { try { return /\) Z /.test(await readFile(`/proc/${ready.pid}/stat`, 'utf8')); } catch { return true; } }); }
		} finally { if (parent.exitCode === null && parent.signalCode === null) { parent.kill('SIGKILL'); await exited; } if (ready) { try { process.kill(ready.pid, 'SIGKILL'); } catch {} } await rm(data, { recursive: true, force: true }); }
	}
});

test('actual pinned SDK/runtime crash rejects the next request and stops without a model task or credential', { timeout: 30000 }, async () => {
	const { CopilotClient, RuntimeConnection } = await import(new URL('../dist-test/node_modules/@github/copilot-sdk/dist/index.js', import.meta.url));
	const { resolveCopilotRuntimePaths } = await import(new URL('../dist-test/src/vs/platform/agentHost/node/copilot/copilotRuntimePaths.js', import.meta.url));
	const { URI } = await import(new URL('../dist-test/src/vs/base/common/uri.js', import.meta.url));
	const paths = await resolveCopilotRuntimePaths(URI.file(path.join(root, 'node_modules')));
	const data = await mkdtemp(path.join(tmpdir(), 'm2b-sdk-crash-')); const wrapper = path.join(data, 'runtime.sh'); const pidFile = path.join(data, 'pid');
	const quote = text => "'" + text.replaceAll("'", "'\\''") + "'";
	await writeFile(wrapper, '#!/bin/sh\nprintf %s "$$" > ' + quote(pidFile) + '\nexec ' + quote(paths.runtimePath) + ' "$@"\n'); await chmod(wrapper, 0o700);
	// Deliberately restricted environment: never discover a personal account or CLI cache.
	const client = new CopilotClient({ connection: RuntimeConnection.forStdio({ path: wrapper }), useLoggedInUser: false, mode: 'empty', baseDirectory: data, env: { PATH: '/usr/bin:/bin', HOME: data, COPILOT_HOME: data } });
	try {
		await client.start(); assert.equal((await client.ping('crash-fixture')).message, 'pong: crash-fixture');
		const pid = Number(await readFile(pidFile, 'utf8')); assert.ok(pid > 1); process.kill(pid, 'SIGKILL');
		await delay(100); await assert.rejects(client.getStatus());
	} finally { await client.stop(); await rm(data, { recursive: true, force: true }); }
});
