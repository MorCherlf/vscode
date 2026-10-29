/* Copyright (c) Microsoft Corporation. All rights reserved. */
/* Licensed under the MIT License. See LICENSE.txt in the project root for license information. */
import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { readFile, readdir, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';
import { build } from 'vite';
import { WebSocket, WebSocketServer } from '../../../packages/agent-host/node_modules/ws/wrapper.mjs';

const app = fileURLToPath(new URL('../', import.meta.url));
const production = path.join(app, 'dist');
const evidence = fileURLToPath(new URL('../../../docs/agent-client/evidence/M2-ui/', import.meta.url));
const config = JSON.parse(await readFile(path.join(app, 'src-tauri/tauri.conf.json'), 'utf8'));
let temporary, fixture, host, exited, server, browser, base, token;
const connections = new Set();
async function until(condition) {
	const deadline = Date.now() + 15000;
	while (Date.now() < deadline) { if (condition()) { return; } await new Promise(resolve => setTimeout(resolve, 20)); }
	assert.fail('Condition timed out');
}

before(async () => {
	temporary = await mkdtemp(path.join(tmpdir(), 'sessions-ui-'));
	fixture = path.join(temporary, 'fixture');
	await mkdir(evidence, { recursive: true });
	await build({ configFile: false, root: app, logLevel: 'error', build: { outDir: fixture, emptyOutDir: true, rollupOptions: { input: path.join(app, 'test/fixture.html') } } });
	const artifact = fileURLToPath(new URL('../../../packages/agent-host/dist-test/', import.meta.url));
	host = spawn(path.join(artifact, 'bin/node'), [path.join(artifact, 'start-test.mjs'), '--user-data-dir', path.join(temporary, 'host-data')], { stdio: ['pipe', 'pipe', 'pipe'] });
	exited = once(host, 'exit');
	let stdout = ''; let stderr = '';
	host.stdout.on('data', chunk => { stdout += chunk; }); host.stderr.on('data', chunk => { stderr += chunk; });
	await until(() => stdout.includes('"ready"') || host.exitCode !== null);
	assert.equal(host.exitCode, null, stderr);
	const ready = JSON.parse(stdout.split('\n').find(line => line.includes('"ready"')));
	token = await readFile(ready.tokenFile, 'utf8');
	server = createServer(async (request, response) => {
		const pathname = new URL(request.url, 'http://localhost').pathname;
		const relative = pathname === '/' ? 'index.html' : pathname === '/fixture.html' ? 'test/fixture.html' : '.' + pathname;
		const isFixture = pathname === '/fixture.html';
		let found;
		for (const root of isFixture ? [fixture] : [production, fixture]) {
			const file = path.resolve(root, relative);
			if (!file.startsWith(root + path.sep)) { continue; }
			try { found = { file, bytes: await readFile(file) }; break; } catch { /* Try the other asset tree. */ }
		}
		if (!found) { response.writeHead(404).end(); return; }
		const mime = { '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.html': 'text/html' };
		response.setHeader('Content-Type', mime[path.extname(found.file)] || 'application/octet-stream');
		// Only the test document can use the loopback proxy. Production CSP is unchanged.
		response.setHeader('Content-Security-Policy', isFixture ? config.app.security.csp.replace('connect-src ipc: http://ipc.localhost', "connect-src 'self' ws://127.0.0.1:*") : config.app.security.csp);
		response.end(found.bytes);
	});
	const sockets = new WebSocketServer({ noServer: true });
	server.on('upgrade', (request, socket, head) => {
		if (request.url !== '/fixture-socket' || request.headers.origin !== base) { socket.destroy(); return; }
		sockets.handleUpgrade(request, socket, head, downstream => {
			// The Host token stays in this Node fixture; no authenticated URL reaches the page.
			const upstream = new WebSocket('ws://127.0.0.1:' + ready.port + '/?tkn=' + token);
			connections.add(downstream); connections.add(upstream);
			const queued = [];
			downstream.on('message', (data, binary) => { if (upstream.readyState === WebSocket.OPEN) { upstream.send(data, { binary }); } else if (queued.length < 32) { queued.push([data, binary]); } else { downstream.close(); } });
			upstream.on('open', () => { for (const [data, binary] of queued) { upstream.send(data, { binary }); } queued.length = 0; });
			upstream.on('message', (data, binary) => { if (downstream.readyState === WebSocket.OPEN) { downstream.send(data, { binary }); } });
			upstream.on('error', () => downstream.close());
			downstream.on('error', () => upstream.close());
			upstream.on('close', () => { connections.delete(upstream); downstream.close(); });
			downstream.on('close', () => { connections.delete(downstream); upstream.close(); });
		});
	});
	server.listen(0, '127.0.0.1'); await once(server, 'listening');
	base = 'http://127.0.0.1:' + server.address().port;
	browser = await chromium.launch({ headless: true });
}, { timeout: 45000 });

after(async () => {
	await browser?.close();
	for (const socket of connections) { socket.terminate(); }
	if (server) { await new Promise(resolve => server.close(resolve)); }
	if (host && host.exitCode === null) {
		host.stdin.end(); const timer = setTimeout(() => host.kill('SIGKILL'), 10000);
		const result = await exited; clearTimeout(timer); assert.deepEqual(result, [0, null]);
	}
	if (temporary) { await rm(temporary, { recursive: true, force: true }); }
});

test('production has narrow native capability, safe fonts and no IDE/test fixture entry', async () => {
	const capability = JSON.parse(await readFile(path.join(app, 'src-tauri/capabilities/main.json'), 'utf8'));
	assert.deepEqual(capability.windows, ['main']); assert.equal(capability.remote, undefined);
	assert.equal(capability.permissions.some(permission => /shell|fs:|http:|opener/.test(permission)), false);
	assert.match(config.app.security.csp, /frame-src 'none'/);
	const assets = await readdir(path.join(production, 'assets'));
	const scripts = await Promise.all(assets.filter(asset => asset.endsWith('.js')).map(asset => readFile(path.join(production, 'assets', asset), 'utf8')));
	assert.doesNotMatch(scripts.join(''), /editor\.all|vs\/workbench|electron\.js|fixture-socket|ui-fixture/);
	assert.equal(assets.some(asset => asset.startsWith('codicon-') && asset.endsWith('.ttf')), true);
});

test('production preview: themes, persisted preference, project validation, dialog focus and keyboard navigation', { timeout: 30000 }, async () => {
	const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, locale: 'en-US', colorScheme: 'light' });
	const errors = []; page.on('pageerror', error => errors.push(error.message));
	try {
		await page.goto(base);
		await expect(page.getByRole('heading', { name: 'What are we building?' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeDisabled();
		await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeDisabled();
		await page.evaluate(() => document.fonts.ready);
		assert.equal(await page.evaluate(() => document.fonts.check('16px codicon')), true);
		await page.screenshot({ path: path.join(evidence, 'preview-light.png') });
		await page.getByRole('button', { name: 'Choose Project', exact: true }).click();
		await page.getByRole('textbox', { name: 'Absolute project directory' }).fill('relative/path');
		await page.getByRole('button', { name: 'Apply', exact: true }).click();
		await expect(page.getByRole('alert')).toContainText('absolute local folder path');
		await page.keyboard.press('Escape');
		await expect(page.getByRole('button', { name: 'Choose Project', exact: true })).toBeFocused();
		await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
		await expect(page.locator('aside')).toHaveCount(0);
		await page.keyboard.press('Control+b');
		await expect(page.locator('aside')).toBeVisible();
		await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
		await page.getByLabel('Color Theme').selectOption('dark');
		await page.getByRole('button', { name: 'Close', exact: true }).click();
		await page.reload();
		assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
		await page.screenshot({ path: path.join(evidence, 'preview-dark.png') });
		assert.deepEqual(errors, []);
	} finally { await page.close(); }
});

test('actual M1 mock Host drives UI: create/send, drafts, session switching, search, IME guard, cancel, approvals and reconnect', { timeout: 60000 }, async () => {
	const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, locale: 'en-US', colorScheme: 'dark' });
	const errors = []; page.on('pageerror', error => errors.push(error.message));
	const firstProject = path.join(temporary, 'project-one'); const secondProject = path.join(temporary, 'project-two');
	await mkdir(firstProject); await mkdir(secondProject);
	const draft = page.getByRole('textbox', { name: 'Describe a task…' });
	const chooseProject = async directory => { await page.getByRole('button', { name: 'Choose Project', exact: true }).click(); await page.getByRole('textbox', { name: 'Absolute project directory' }).fill(directory); await page.getByRole('button', { name: 'Apply', exact: true }).click(); };
	try {
		await page.goto(base + '/fixture.html');
		await page.getByRole('button', { name: 'Connect', exact: true }).click();
		await expect(page.getByRole('status')).toHaveText('Connected');
		await chooseProject(firstProject);
		await draft.fill('hello'); await draft.press('Enter');
		await expect(page.getByRole('log')).toContainText('Hello, world!');
		const first = await page.locator('.session-row[aria-current="page"]').getAttribute('data-session');
		await draft.fill('draft for first');
		await page.keyboard.press('Control+n');
		await expect(draft).toHaveValue('');
		await chooseProject(secondProject);
		await draft.fill('draft for new');
		await page.locator('[data-session=' + JSON.stringify(first) + ']').click();
		await expect(draft).toHaveValue('draft for first');
		await page.keyboard.press('Control+n');
		await expect(draft).toHaveValue('draft for new');
		await draft.fill('hello');
		await draft.evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, isComposing: true, bubbles: true, cancelable: true })));
		await expect(page.getByRole('heading', { name: 'What are we building?' })).toBeVisible();
		await expect(draft).toHaveValue('hello');
		await draft.press('Enter'); await expect(page.getByRole('log')).toContainText('Hello, world!');
		await page.locator('.session-row').first().focus(); await page.keyboard.press('End');
		await expect(page.locator('.session-row').last()).toBeFocused();
		await page.keyboard.press('Home'); await expect(page.locator('.session-row').first()).toBeFocused();
		await page.getByRole('textbox', { name: 'Search Sessions' }).fill('project-one');
		await expect(page.locator('[data-session=' + JSON.stringify(first) + ']')).toBeVisible();
		await expect(page.locator('.session-group')).toHaveCount(1);
		await page.getByRole('textbox', { name: 'Search Sessions' }).fill('');
		await draft.fill('slow'); await draft.press('Enter');
		await expect(page.getByRole('button', { name: 'Stop Turn', exact: true })).toBeEnabled();
		await page.getByRole('button', { name: 'Stop Turn', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
		await draft.fill('permission'); await draft.press('Enter');
		await expect(page.getByRole('button', { name: 'Reject', exact: true })).toBeEnabled();
		await page.screenshot({ path: path.join(evidence, 'mock-approval-dark.png') });
		await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
		await page.getByRole('button', { name: 'Quit', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Wait and Quit', exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Keep Working', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Reject', exact: true })).toBeEnabled();
		await page.getByRole('button', { name: 'Reject', exact: true }).click();
		await expect(page.locator('.tool-card')).toContainText('Cancelled');
		if (await page.getByRole('button', { name: 'Stop Turn', exact: true }).count()) { await page.getByRole('button', { name: 'Stop Turn', exact: true }).click(); }
		for (const socket of connections) { socket.close(); }
		await expect(page.getByRole('status')).toContainText('Connection interrupted');
		await draft.fill('unsent after disconnect');
		await page.getByRole('button', { name: 'Reconnect and Sync', exact: true }).click();
		await expect(page.getByRole('status')).toHaveText('Connected');
		await expect(draft).toHaveValue('unsent after disconnect');
		await expect(page.getByRole('log')).toContainText('Hello, world!');
		assert.equal((await page.content()).includes(token), false);
		assert.deepEqual(errors, []);
	} finally { await page.close(); }
});

test('Markdown renders code/tables while blocking raw HTML, remote images and executable links', async () => {
	const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
	const remote = []; page.on('request', request => { if (request.url().startsWith('https://fixture.invalid')) { remote.push(request.url()); } });
	try {
		await page.goto(base + '/fixture.html?markdown');
		await expect(page.getByRole('heading', { name: 'Safe heading' })).toBeVisible();
		await expect(page.locator('table')).toHaveCount(1);
		await expect(page.locator('pre code')).toContainText('<script>bad()</script>');
		assert.deepEqual({ images: await page.locator('img').count(), executableLinks: await page.locator('a').count(), injected: await page.evaluate(() => window.injected), remote }, { images: 0, executableLinks: 0, injected: undefined, remote: [] });
	} finally { await page.close(); }
});

test('Chinese compact window keeps the welcome/composer visible without horizontal overflow', async () => {
	const page = await browser.newPage({ viewport: { width: 720, height: 520 }, locale: 'zh-CN', colorScheme: 'light', reducedMotion: 'reduce' });
	try {
		await page.goto(base);
		await expect(page.getByRole('heading', { name: '我们来构建些什么？' })).toBeVisible();
		await expect(page.getByRole('textbox', { name: '描述要完成的任务…' })).toBeVisible();
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		await page.screenshot({ path: path.join(evidence, 'preview-zh-compact.png') });
	} finally { await page.close(); }
});
