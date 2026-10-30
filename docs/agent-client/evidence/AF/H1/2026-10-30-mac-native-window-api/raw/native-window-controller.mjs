/*---------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { spawn, execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const root = process.cwd();
const work = path.join(root, '.build/native-window-20261030');
const raw = path.join(work, 'raw');
const inputs = JSON.parse(await fs.readFile(path.join(work, 'inputs.json'), 'utf8'));
const { chromium } = createRequire(path.join(root, 'package.json'))('playwright');
const result = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), cases: [], rendererErrors: [] };
let info, browser;
try {
	const launcher = spawn('bash', ['.agents/skills/launch/scripts/launch.sh', '--agents', '--skip-prelaunch', '--session-title', 'H1 Native Window Intents', '--source-user-data-dir', path.join(work, 'empty-profile'), '--disable-workspace-trust', '--', '--use-inmemory-secretstorage', '--folder-uri', 'file://' + inputs.project], { cwd: root, env: { ...process.env, PATH: path.join(root, '.build/mac-toolchain/node-v24.22.1-darwin-arm64/bin') + ':' + process.env.PATH }, stdio: ['ignore', 'pipe', 'pipe'] });
	let stdout = '', stderr = '';
	launcher.stdout.on('data', data => stdout += data);
	launcher.stderr.on('data', data => stderr += data);
	await new Promise((resolve, reject) => { launcher.once('error', reject); launcher.once('exit', code => code === 0 ? resolve() : reject(new Error(stderr))); });
	await fs.writeFile(path.join(raw, 'launch.json'), stdout);
	info = JSON.parse(stdout.trim().split('\n').at(-1));
	browser = await chromium.connectOverCDP('http://127.0.0.1:' + info.cdpPort, { timeout: 20000 });
	let page;
	for (let attempt = 0; attempt < 100; attempt++) {
		page = browser.contexts()[0].pages().find(candidate => candidate.url().includes('sessions-dev.html'));
		if (page) break;
		await new Promise(resolve => setTimeout(resolve, 200));
	}
	assert(page, 'Original Sessions page exists');
	page.on('pageerror', error => result.rendererErrors.push(error.message));
	await page.locator('.monaco-workbench').waitFor({ timeout: 60000 });
	await page.waitForTimeout(7000);
	const base = page.url().split('/out/')[0] + '/out/';
	await page.evaluate(async base => {
		const [{ Action2, registerAction2 }, { INativeHostService }, { URI }] = await Promise.all([
			import(base + 'vs/platform/actions/common/actions.js'),
			import(base + 'vs/platform/native/common/native.js'),
			import(base + 'vs/base/common/uri.js')
		]);
		globalThis.__h1WindowRegistration = registerAction2(class extends Action2 {
			constructor() { super({ id: 'h1.native.windowIntents', title: 'H1 Native Window Intents', f1: true }); }
			run(accessor) { globalThis.__h1WindowProbe = { native: accessor.get(INativeHostService), URI }; }
		});
	}, base);
	await page.keyboard.press('F1');
	await page.locator('.quick-input-widget .quick-input-box input').fill('>H1 Native Window Intents');
	await page.keyboard.press('Enter');
	await page.waitForFunction(() => !!globalThis.__h1WindowProbe);
	result.mode = await page.evaluate(() => {
		const c = globalThis.vscode.context.configuration();
		return { isSessionsWindow: c.isSessionsWindow, agentFirst: c.product.agentFirst, executableExtensions: c.product.agentFirstExecutableExtensions, canonical: globalThis.__h1WindowProbe.URI.revive(c.workspace.configPath).fsPath };
	});
	assert.equal(result.mode.isSessionsWindow, true);
	assert.equal(result.mode.agentFirst, true);
	assert.deepEqual(result.mode.executableExtensions, []);
	const before = await page.evaluate(async () => (await globalThis.__h1WindowProbe.native.getWindows({ includeAuxiliaryWindows: false })).map(window => window.id));
	result.beforeWindowIds = before;
	const cases = [
		{ name: 'ordinary-file', open: [{ kind: 'fileUri', path: inputs.file }] },
		{ name: 'ordinary-workspace', open: [{ kind: 'workspaceUri', path: inputs.workspace }] },
		{ name: 'multiple-folders', open: [{ kind: 'folderUri', path: inputs.project }, { kind: 'folderUri', path: inputs.other }] },
		{ name: 'diff-files', open: inputs.files.slice(0, 2).map(path => ({ kind: 'fileUri', path })), options: { diffMode: true } },
		{ name: 'merge-files', open: inputs.files.map(path => ({ kind: 'fileUri', path })), options: { mergeMode: true } },
		{ name: 'canonical-with-remote-intent', open: [{ kind: 'workspaceUri', path: result.mode.canonical }], options: { remoteAuthority: 'h1-native.invalid' } },
		{ name: 'canonical-agents-positive', open: [{ kind: 'workspaceUri', path: result.mode.canonical }], accepted: true },
		{ name: 'local-folder-positive', open: [{ kind: 'folderUri', path: inputs.project }], accepted: true }
	];
	for (const test of cases) {
		const observation = await page.evaluate(async test => {
			const { native, URI } = globalThis.__h1WindowProbe;
			try {
				await native.openWindow(test.open.map(entry => ({ [entry.kind]: URI.file(entry.path) })), { forceReuseWindow: true, ...test.options });
				return { name: test.name, accepted: true };
			} catch (error) { return { name: test.name, accepted: false, error: String(error.message) }; }
		}, test);
		result.cases.push(observation);
		assert.equal(observation.accepted, !!test.accepted, `${test.name}: wrong native decision`);
		if (!test.accepted) assert(observation.error.includes('Agent First supports a single project folder') || observation.error.includes('This Agent First product does not open editor windows'), 'Explicit original native product error required');
		if (!test.accepted) {
			observation.windowIdsAfter = await page.evaluate(async () => (await globalThis.__h1WindowProbe.native.getWindows({ includeAuxiliaryWindows: false })).map(window => window.id));
			assert.deepEqual(observation.windowIdsAfter, before, 'Rejected request must not create a window');
		}
	}
	await page.waitForTimeout(1500);
	result.afterWindowIds = await page.evaluate(async () => (await globalThis.__h1WindowProbe.native.getWindows({ includeAuxiliaryWindows: false })).map(window => window.id));
	for (let attempt = 0; attempt < 50; attempt++) {
		if (browser.contexts()[0].pages().every(page => page.url().includes('sessions-dev.html'))) break;
		await page.waitForTimeout(200);
	}
	result.rendererPages = browser.contexts()[0].pages().map(page => page.url().replace(root, '$REPO'));
	assert(result.rendererPages.every(url => url.includes('sessions-dev.html')));
	result.chromium = await browser.version();
	await page.screenshot({ path: path.join(raw, 'native-window-intents.png') });
	result.passed = true;
	console.log(JSON.stringify({ source: result.source, passed: result.passed, cases: result.cases.length }));
} catch (error) {
	result.failure = String(error.stack ?? error);
	process.exitCode = 1;
	console.error(result.failure);
} finally {
	if (browser) { try { await browser.close(); } catch {} }
	if (info?.pid) { try { process.kill(info.pid, 'SIGTERM'); } catch {} }
	await fs.writeFile(path.join(raw, 'result.json'), JSON.stringify(result, null, 2) + '\n');
}
