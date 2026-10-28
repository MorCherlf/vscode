/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, rm, access, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.dirname(fileURLToPath(import.meta.url));
globalThis._VSCODE_FILE_ROOT = path.join(root, 'src');
process.env.VSCODE_DEV_INJECT_NODE_MODULE_LOOKUP_PATH = path.join(root, 'node_modules');
const require = createRequire(import.meta.url);
const worker = new Worker(new URL('./src/vs/platform/agentHost/node/diffWorkerMain.js', import.meta.url));
try {
	worker.postMessage({ id: 1, fn: 'computeDiffCounts', args: ['a\nb\n', 'a\nc\nd\n', 1000] });
	const [message] = await once(worker, 'message');
	assert.deepEqual({ added: message.res.added, removed: message.res.removed }, { added: 2, removed: 1 });
} finally { await worker.terminate(); }
const sqlite = require('@vscode/sqlite3');
const database = await new Promise((resolve, reject) => { const db = new sqlite.Database(':memory:', error => error ? reject(error) : resolve(db)); });
await new Promise((resolve, reject) => database.exec('CREATE TABLE fixture (value TEXT); INSERT INTO fixture VALUES (\'native-ok\')', error => error ? reject(error) : resolve()));
assert.deepEqual(await new Promise((resolve, reject) => database.get('SELECT * FROM fixture', (error, row) => error ? reject(error) : resolve(row))), { value: 'native-ok' });
await new Promise((resolve, reject) => database.close(error => error ? reject(error) : resolve()));
const pty = require('node-pty').spawn('/bin/sh', ['-c', 'printf native-pty-ok'], { name: 'xterm', cols: 80, rows: 24, cwd: tmpdir(), env: { PATH: '/usr/bin:/bin' } });
let ptyOutput = '';
const dataListener = pty.onData(data => { ptyOutput += data; });
const exit = await new Promise(resolve => { const listener = pty.onExit(event => { listener.dispose(); resolve(event); }); });
dataListener.dispose();
assert.deepEqual({ output: ptyOutput, code: exit.exitCode }, { output: 'native-pty-ok', code: 0 });
const { default: treeSitter } = await import('@vscode/tree-sitter-wasm');
await treeSitter.Parser.init({ locateFile: () => path.join(root, 'node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter.wasm') });
for (const name of ['bash', 'powershell']) {
	const language = await treeSitter.Language.load(await readFile(path.join(root, `node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-${name}.wasm`)));
	const parser = new treeSitter.Parser();
	try { parser.setLanguage(language); const tree = parser.parse('echo hello'); assert.ok(tree.rootNode); tree.delete(); } finally { parser.delete(); }
}
const { rgPath } = await import('@vscode/ripgrep-universal');
assert.match(execFileSync(rgPath, ['--version'], { encoding: 'utf8' }), /ripgrep/);
const sdk = await import('@github/copilot-sdk');
assert.equal(typeof sdk.CopilotClient, 'function');
const { URI } = await import('./src/vs/base/common/uri.js');
const { resolveCopilotRuntimePaths } = await import('./src/vs/platform/agentHost/node/copilot/copilotRuntimePaths.js');
const paths = await resolveCopilotRuntimePaths(URI.file(path.join(root, 'node_modules')));
for (const resource of Object.values(paths)) { await access(resource); }
const runtimeHome = await mkdtemp(path.join(tmpdir(), 'agent-sdk-'));
const runtime = new sdk.CopilotClient({ connection: sdk.RuntimeConnection.forStdio({ path: paths.runtimePath }), useLoggedInUser: false, mode: 'empty', baseDirectory: runtimeHome, env: { ...process.env, COPILOT_HOME: runtimeHome } });
let runtimeVersion;
try {
	await runtime.start();
	assert.equal((await runtime.ping('fixture')).message, 'pong: fixture');
	runtimeVersion = (await runtime.getStatus()).version;
	const product = JSON.parse(await readFile(path.join(root, 'product.json'), 'utf8'));
	assert.equal(runtimeVersion, product.copilotVersions.runtime);
} finally { await runtime.stop(); await rm(runtimeHome, { recursive: true, force: true }); }
const { DiskFileSystemProvider } = await import('./src/vs/platform/files/node/diskFileSystemProvider.js');
const { NullLogService } = await import('./src/vs/platform/log/common/log.js');
const watched = await mkdtemp(path.join(tmpdir(), 'agent-watch-'));
const provider = new DiskFileSystemProvider(new NullLogService());
const watcher = provider.watch(URI.file(watched), { recursive: true, excludes: [] });
let changed = false;
const changeListener = provider.onDidChangeFile(changes => { if (changes.some(change => change.resource.fsPath.endsWith('fixture.txt'))) { changed = true; } });
try {
	const deadline = Date.now() + 10000;
	while (!changed && Date.now() < deadline) { await writeFile(path.join(watched, 'fixture.txt'), 'watch'); await new Promise(resolve => setTimeout(resolve, 150)); }
	assert.equal(changed, true);
} finally { changeListener.dispose(); watcher.dispose(); provider.dispose(); await rm(watched, { recursive: true, force: true }); }
console.log(JSON.stringify({ worker: true, sqlite: true, pty: true, wasm: true, ripgrep: true, sdkAssets: true, runtimeVersion, recursiveWatcher: true }));
