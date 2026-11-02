/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
// Non-secret local platform/IPC probe. Does not launch a task, read credentials or claim acceptance.
import { execFileSync } from 'node:child_process';
import { readFile, mkdtemp, rm, access } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const product = JSON.parse(await readFile(new URL('../../product.json', import.meta.url), 'utf8'));
const home = await mkdtemp(join(tmpdir(), 'agent-first-preflight-'));
const server = createServer();
let ipc;
try {
	ipc = await new Promise(resolve => {
		server.once('error', error => resolve({ status: 'blocked', code: error.code ?? 'UNKNOWN' }));
		server.listen(join(home, 'probe.sock'), () => resolve({ status: 'available-for-probe-only' }));
	});
} finally {
	if (server.listening) { await new Promise(resolve => server.close(resolve)); }
	await rm(home, { recursive: true, force: true });
}
const compiled = await access(new URL('../../out/vs/sessions/sessions.common.main.js', import.meta.url)).then(() => true, () => false);
console.log(JSON.stringify({
	schema: 1, source: git(['rev-parse', 'HEAD']), dirty: git(['status', '--porcelain']).length > 0,
	platform: process.platform, arch: process.arch, node: process.versions.node,
	product: { agentFirst: product.agentFirst === true, executableExtensions: product.agentFirstExecutableExtensions },
	compiledClientPresent: compiled, nativeIpcProbe: ipc,
	macArm64: process.platform === 'darwin' && process.arch === 'arm64',
	scope: 'platform/socket probe only; compiled output presence is not freshness or native execution',
	unverified: ['native window/EH/VSIX', 'real dedicated account/model/tool/approval task', 'full task-time module/service/worker exclusion', 'Mac package/IME/VoiceOver', 'human H1 acceptance'],
	account: 'not inspected; do not send account tokens or credential logs'
}, null, 2));
process.exitCode = ipc.status === 'blocked' || process.platform !== 'darwin' || process.arch !== 'arm64' ? 2 : 0;
