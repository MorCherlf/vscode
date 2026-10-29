/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
// Diagnostic embedder: original Sessions factory and DI, no replacement UI or mock services.
// This does not exercise native Electron, Extension Host, a model, or human acceptance.
import { createServer } from 'node:http';
import { readFile, readdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../package.json', import.meta.url));
let host;
let hostHome;
let server;
let browser;
let fixtureConnectionToken;
const redact = value => fixtureConnectionToken ? String(value).split(fixtureConnectionToken).join("[fixture-connection-token]") : String(value);
try {
const configurationDefaults = { 'telemetry.telemetryLevel': 'off', 'workbench.startupEditor': 'none' };
if (process.argv.includes('--mock-host')) {
	hostHome = await mkdtemp(resolve(tmpdir(), 'af-web-host-'));
	host = spawn(resolve(root, 'packages/agent-host/dist-test/bin/node'), [resolve(root, 'packages/agent-host/dist-test/start-test.mjs'), '--user-data-dir', hostHome], { cwd: root, env: { PATH: process.env.PATH, HOME: hostHome }, stdio: ['pipe', 'pipe', 'pipe'] });
	host.stderr.resume();
	const ready = await new Promise((accept, reject) => {
		const timeout = setTimeout(() => reject(new Error('Mock Host readiness timeout')), 15000);
		let buffer = '';
		host.once('error', reject);
		host.once('exit', code => { clearTimeout(timeout); reject(new Error(`Mock Host exited ${code}`)); });
		host.stdout.on('data', chunk => {
			buffer += chunk;
			for (let end; (end = buffer.indexOf('\n')) >= 0;) {
				const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
				try { const value = JSON.parse(line); if (value.type === 'ready') { clearTimeout(timeout); accept(value); } } catch { /* Not a frame. */ }
			}
		});
	});
	configurationDefaults['chat.remoteAgentHostsEnabled'] = true;
	fixtureConnectionToken = await readFile(ready.tokenFile, 'utf8');
	configurationDefaults['chat.remoteAgentHosts'] = [{ address: `127.0.0.1:${ready.port}`, name: 'Deterministic test Host', connectionToken: fixtureConnectionToken }];
}
const css = [];
async function scan(dir) {
	for (const entry of await readdir(resolve(root, dir), { withFileTypes: true })) {
		const path = `${dir}/${entry.name}`;
		if (entry.isDirectory()) { await scan(path); }
		else if (path.endsWith('.css')) { css.push(path); }
	}
}
await scan('out');
const product = JSON.parse(await readFile(resolve(root, 'product.json'), 'utf8'));
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{height:100%;margin:0}</style><style id="css"></style></head><body><script>
globalThis._VSCODE_FILE_ROOT=location.origin+'/out/';
globalThis._VSCODE_PRODUCT_JSON=${JSON.stringify(product)};
globalThis._VSCODE_PACKAGE_JSON=${JSON.stringify(pkg)};
globalThis._VSCODE_NLS_MESSAGES=[];
globalThis._VSCODE_NLS_LANGUAGE='en';
const imports={};
for(const path of ${JSON.stringify(css)}) {const url=location.origin+'/'+path;imports[url]=URL.createObjectURL(new Blob(["document.getElementById('css').sheet.insertRule("+JSON.stringify('@import url('+url+');')+");"],{type:'application/javascript'}));}
const map=document.createElement('script');map.type='importmap';map.textContent=JSON.stringify({imports});document.head.append(map);
</script><script type="module">
import {create} from '/out/vs/sessions/sessions.web.main.internal.js';
window.sessionsWorkbench=create(document.body,{productConfiguration:${JSON.stringify(product)},workspaceProvider:{workspace:undefined,trusted:undefined,payload:[['isSessionsWindow','true']],open:async()=>false},configurationDefaults:${JSON.stringify(configurationDefaults)},enableWorkspaceTrust:true});
</script></body></html>`;
server = createServer(async (req, res) => {
	try {
		if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end(html); return; }
		const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
		if (relative(root, path).startsWith('..')) { res.writeHead(403).end(); return; }
		res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' })[extname(path)] || 'application/octet-stream');
		res.end(await readFile(path));
	} catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
	const { chromium } = require('@playwright/test');
	browser = await chromium.launch({ headless: true, ...(process.env.AGENT_FIRST_CHROMIUM ? { executablePath: process.env.AGENT_FIRST_CHROMIUM } : {}) });
	const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
	const scripts = new Set(); const workers = new Set();
	page.on('response', r => { if (new URL(r.url()).pathname.endsWith('.js')) { scripts.add(new URL(r.url()).pathname); } });
	page.on('worker', w => workers.add(new URL(w.url()).pathname));
	page.on('pageerror', e => console.error('PAGE_ERROR', redact(e.message)));
	page.on('console', m => { if (m.type() === 'error') { console.error('CONSOLE_ERROR', redact(m.text())); } });
	await page.goto(`http://127.0.0.1:${server.address().port}/`);
	await page.locator('.monaco-workbench').waitFor({ timeout: 30000 });
	await page.waitForTimeout(process.argv.includes('--mock-host') ? 10000 : 3000);
	console.log(JSON.stringify({ browser: browser.version(), originalWorkbench: await page.locator('.monaco-workbench').count(), text: (await page.locator('body').innerText()).slice(0, 2000) }));
	if (process.env.AGENT_FIRST_TRACE) { await writeFile(process.env.AGENT_FIRST_TRACE, JSON.stringify({ kind: 'browser-resource-load-not-EH-activation', scripts: [...scripts].sort(), workers: [...workers].sort() }, null, 2)); }
	if (process.argv.includes('--mock-host') && !(await page.locator('body').innerText()).includes('Deterministic test Host')) { throw new Error('Original UI did not discover fixture Host'); }
	if (process.env.AGENT_FIRST_SCREENSHOT) { await page.screenshot({ path: process.env.AGENT_FIRST_SCREENSHOT }); }
} finally {
	await browser?.close(); if (server?.listening) { await new Promise(r => server.close(r)); }
	if (host && host.exitCode === null && host.signalCode === null) {
		const exited = once(host, 'exit'); host.stdin.end();
		const kill = setTimeout(() => host.kill('SIGKILL'), 6000);
		await exited; clearTimeout(kill);
	}
	if (hostHome) { await rm(hostHome, { recursive: true, force: true }); }
}
