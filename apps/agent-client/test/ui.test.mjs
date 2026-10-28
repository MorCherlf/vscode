/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const config = JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));

test('production surface has narrow native capability and excludes IDE frontend modules', async () => {
	const capability = JSON.parse(await readFile(new URL('../src-tauri/capabilities/main.json', import.meta.url), 'utf8'));
	assert.deepEqual(capability.windows, ['main']); assert.equal(capability.remote, undefined);
	assert.equal(capability.permissions.some(permission => /shell|fs:|http:|opener/.test(permission)), false);
	assert.match(config.app.security.csp, /frame-src 'none'/);
	const assets = await readdir(path.join(root, 'assets'));
	const scripts = await Promise.all(assets.filter(asset => asset.endsWith('.js')).map(asset => readFile(path.join(root, 'assets', asset), 'utf8')));
	assert.doesNotMatch(scripts.join(''), /editor\.all|vs\/workbench|electron\.js/);
});

test('browser preview renders the built UI, explains unavailable native functions and escapes draft content', { timeout: 30000 }, async context => {
	const server = createServer(async (request, response) => {
		const pathname = new URL(request.url, 'http://localhost').pathname;
		const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
		if (!file.startsWith(root)) { response.writeHead(403).end(); return; }
		try { response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'); response.setHeader('Content-Security-Policy', config.app.security.csp); response.end(await readFile(file)); } catch { response.writeHead(404).end(); }
	});
	server.listen(0, '127.0.0.1'); await once(server, 'listening');
	let browser;
	try {
		browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
		const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, locale: 'en-US', colorScheme: 'light' });
		const errors = []; page.on('pageerror', error => errors.push(error.message));
		await page.goto(`http://127.0.0.1:${server.address().port}`);
		await page.getByRole('button', { name: 'Connect', exact: true }).waitFor();
		assert.equal(await page.getByRole('button', { name: 'Connect', exact: true }).isDisabled(), true);
		assert.equal(await page.getByRole('button', { name: 'Sign in', exact: true }).isDisabled(), true);
		assert.match(await page.locator('main').innerText(), /desktop application/);
		const text = '<img src=x onerror="window.injected=true">';
		await page.getByRole('textbox', { name: 'Describe a task…' }).fill(text);
		assert.equal(await page.locator('img').count(), 0);
		assert.equal(await page.evaluate(() => window.injected), undefined);
		assert.deepEqual(errors, []);
		await page.getByRole('textbox', { name: 'Describe a task…' }).fill('');
		const evidence = new URL('../../../docs/agent-client/evidence/M2/', import.meta.url);
		await mkdir(evidence, { recursive: true });
		await page.screenshot({ path: fileURLToPath(new URL('client-preview.png', evidence)), fullPage: true });
		context.diagnostic('Chromium browser preview only; no Tauri IPC or WKWebView acceptance claimed.');
	} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});
