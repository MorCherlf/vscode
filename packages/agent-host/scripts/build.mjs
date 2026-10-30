/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { build } from 'esbuild';
import { mkdir, readFile, writeFile, rm, cp, readdir, stat, chmod } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire, isBuiltin } from 'node:module';

if (process.versions.node !== '24.22.1' || process.versions.electron) { throw new Error('Build requires ordinary Node 24.22.1'); }

const root = fileURLToPath(new URL('../../../', import.meta.url));
const testing = process.argv.includes('--test');
const output = path.join(root, 'packages/agent-host', testing ? 'dist-test' : 'dist');
const entries = ['packages/agent-host/src/main.ts', 'src/vs/platform/agentHost/node/diffWorkerMain.ts', 'src/bootstrap-fork.ts', 'src/vs/platform/files/node/watcher/watcherMain.ts'];
if (testing) { entries.push('packages/agent-host/test/mockMain.ts'); }
const options = { absWorkingDir: root, platform: 'node', format: 'esm', target: 'node24', packages: 'external', tsconfigRaw: { compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false } } };
const graph = await build({ ...options, entryPoints: entries, bundle: true, outdir: output, write: false, metafile: true, logLevel: 'warning' });
const inputs = Object.keys(graph.metafile.inputs);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await build({ ...options, entryPoints: inputs, bundle: false, outbase: root, outdir: output, logLevel: 'warning' });
const external = [...new Set(Object.values(graph.metafile.outputs).flatMap(output => output.imports.filter(i => i.external).map(i => i.path)))].sort();
await writeFile(path.join(output, 'module-graph.json'), JSON.stringify({ inputs, external }, null, '\t') + '\n');

const packageRoot = path.join(root, 'packages/agent-host');
const sourcePackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const hostPackage = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
const lock = JSON.parse(await readFile(path.join(packageRoot, 'package-lock.json'), 'utf8'));
const omittedExternals = {
	'@anthropic-ai/claude-agent-sdk': 'Claude provider is not registered',
	'@vscode/windows-registry': 'Windows is outside the current platform scope',
	kerberos: 'Integrated enterprise proxy authentication requires a separate native build and acceptance',
};
const resolve = createRequire(path.join(packageRoot, 'package.json')).resolve;
for (const name of external) {
	if (!isBuiltin(name) && !Object.hasOwn(omittedExternals, name)) { resolve(name); }
}
if (inputs.some(input => /(?:electron-main|electron-browser|sessions\.common\.main|editor\.all)/.test(input))) { throw new Error('Unexpected desktop entry in Host closure'); }
const product = {
	nameShort: 'MorCherlf Agent', nameLong: 'MorCherlf Agent', applicationName: 'morcherlf-agent',
	dataFolderName: '.morcherlf-agent', urlProtocol: 'morcherlf-agent', version: sourcePackage.version,
	quality: 'stable', enableTelemetry: false,
	defaultChatAgent: { extensionId: 'GitHub.copilot', chatExtensionId: 'GitHub.copilot-chat', provider: { default: { id: 'github', name: 'GitHub' }, enterprise: { id: 'github-enterprise', name: 'GitHub Enterprise' } }, providerScopes: [] },
	copilotVersions: { sdk: hostPackage.dependencies['@github/copilot-sdk'], runtime: sourcePackage.copilotRuntimeVersion },
};
await writeFile(path.join(output, 'product.json'), JSON.stringify(product, null, '\t') + '\n');
await writeFile(path.join(output, 'package.json'), JSON.stringify({ name: hostPackage.name, version: sourcePackage.version, type: 'module', private: true, dependencies: hostPackage.dependencies, copilotRuntimeVersion: sourcePackage.copilotRuntimeVersion }, null, '\t') + '\n');
for (const name of ['launch.mjs', 'start.mjs']) { await cp(path.join(packageRoot, 'scripts', name), path.join(output, name)); }
if (testing) {
	for (const name of ['start-test.mjs', 'resource-probe.mjs']) { await cp(path.join(packageRoot, 'test', name), path.join(output, name)); }
}
const resources = ['src/vs/base/node/terminateProcess.sh', 'src/vs/workbench/contrib/terminal/common/scripts'];
for (const resource of resources) {
	await mkdir(path.dirname(path.join(output, resource)), { recursive: true });
	await cp(path.join(root, resource), path.join(output, resource), { recursive: true });
}
const dependencies = [];
const libc = process.platform === 'linux' ? process.report.getReport().header.glibcVersionRuntime ? 'glibc' : 'musl' : undefined;
for (const [location, metadata] of Object.entries(lock.packages)) {
	if (!location || metadata.dev || metadata.devOptional) { continue; }
	const source = path.join(packageRoot, location);
	try { await stat(source); } catch (error) { if (error.code === 'ENOENT' && metadata.optional) { continue; } throw error; }
	const installed = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
	if (installed.libc && libc && !installed.libc.includes(libc)) { continue; }
	await mkdir(path.dirname(path.join(output, location)), { recursive: true });
	await cp(source, path.join(output, location), { recursive: true, dereference: false });
	dependencies.push({ location, version: metadata.version, integrity: metadata.integrity });
}
await mkdir(path.join(output, 'bin'), { recursive: true });
await cp(process.execPath, path.join(output, 'bin', process.platform === 'win32' ? 'node.exe' : 'node'));
await chmod(path.join(output, 'bin', process.platform === 'win32' ? 'node.exe' : 'node'), 0o755);
for (const name of ['LICENSE.txt', 'ThirdPartyNotices.txt']) { await cp(path.join(root, name), path.join(output, name)); }
const files = [];
async function inventory(directory) {
	for (const item of await readdir(directory, { withFileTypes: true })) {
		const fullPath = path.join(directory, item.name);
		if (item.isDirectory()) { await inventory(fullPath); }
		else { files.push({ path: path.relative(output, fullPath), bytes: (await stat(fullPath)).size, sha256: createHash('sha256').update(await readFile(fullPath)).digest('hex') }); }
	}
}
await inventory(output);
const { execFileSync } = await import('node:child_process');
const sourceHashes = {};
for (const input of inputs) { sourceHashes[input] = createHash('sha256').update(await readFile(path.join(root, input))).digest('hex'); }
const lockSha256 = createHash('sha256').update(await readFile(path.join(packageRoot, 'package-lock.json'))).digest('hex');
const manifest = { lockSha256, sourceHashes, omittedExternals, schemaVersion: 1, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), platform: process.platform, arch: process.arch, node: process.versions.node, abi: process.versions.modules, testing, entries, resources, dependencies, modules: inputs.length, files };
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, '\t') + '\n');
console.log(JSON.stringify({ output, modules: inputs.length, dependencies: dependencies.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) }));
