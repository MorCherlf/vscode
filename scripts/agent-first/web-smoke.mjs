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
import { checkComposition } from './composition-check.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../package.json', import.meta.url));
for (const argument of process.argv.slice(2)) { if (!['--mock-host', '--probe-extensions', '--legacy-editor-routes'].includes(argument)) { throw new Error('Unsupported smoke option: ' + argument); } }
const legacyEditorRoutes = process.argv.includes('--legacy-editor-routes');
let host;
let hostHome;
let server;
let browser;
const probeExtensions = process.argv.includes('--probe-extensions');
const activations = [];
const fixtureManifests = new Set();
const fixtureModules = [];
let fixtureConnectionToken;
const redact = value => fixtureConnectionToken ? String(value).split(fixtureConnectionToken).join("[fixture-connection-token]") : String(value);
async function within(promise, label) {
	let timeout;
	try {
		return await Promise.race([promise, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(label + ' timed out')), 45000); })]);
	} finally { clearTimeout(timeout); }
}
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
if (legacyEditorRoutes) { product.agentFirst = false; }
// Diagnostic A/B only: serve a separately transpiled, pinned original composition entry.
const baselineEntry = process.env.AGENT_FIRST_BASELINE_ENTRY ? await readFile(process.env.AGENT_FIRST_BASELINE_ENTRY, 'utf8') : undefined;
if (probeExtensions) {
	product.agentFirstExecutableExtensions = ['h1-fixture.control', 'h1-fixture.dependent'];
	configurationDefaults['extensions.supportAgentsWindow'] = { 'h1-fixture.editor-only': true, 'h1-fixture.mixed': true };
	configurationDefaults['diffEditor.renderSideBySide'] = false;
}
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
const options={productConfiguration:${JSON.stringify(product)},workspaceProvider:{workspace:undefined,trusted:undefined,payload:[['isSessionsWindow','true']],open:async()=>false},configurationDefaults:${JSON.stringify(configurationDefaults)},enableWorkspaceTrust:true};
if (${probeExtensions}) { globalThis.agentFirstProbeOptions=options; await import('/scripts/agent-first/extension-probe.mjs'); }
else { window.sessionsWorkbench=create(document.body,options); }
</script></body></html>`;
server = createServer(async (req, res) => {
	try {
		res.setHeader('Access-Control-Allow-Origin', '*');
		if (baselineEntry && new URL(req.url, 'http://localhost').pathname === '/out/vs/sessions/sessions.common.main.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(baselineEntry); return; }
		const fixture = /^\/_h1\/extensions\/(control|editor-only|mixed|dependent)\/(package.json|package.nls.json|extension.js)$/.exec(new URL(req.url, 'http://localhost').pathname);
		if (fixture) {
			const name = fixture[1];
			if (fixture[2] === 'package.json') {
				fixtureManifests.add(name);
				res.setHeader('Content-Type', 'application/json');
				res.end(JSON.stringify({ name, publisher: 'h1-fixture', version: '0.0.1', engines: { vscode: '^1.145.0' }, browser: './extension.js', activationEvents: ['*', 'onStartupFinished', 'onLanguage:agent-first-fixture', 'onCommand:agentFirst.fixture.denied'], extensionDependencies: name === 'dependent' ? ['h1-fixture.editor-only'] : [], capabilities: { agentsWindow: { supported: true } }, contributes: name === 'mixed' ? { commands: [{ command: 'agentFirst.fixture.denied', title: 'Fixture denied' }], languageModelTools: [{ name: 'fixtureTool', displayName: 'Fixture tool', modelDescription: 'Fixture only' }] } : {} }));
			} else if (fixture[2] === 'package.nls.json') {
				res.setHeader('Content-Type', 'application/json'); res.end('{}');
			} else {
				fixtureModules.push(name);
				res.setHeader('Content-Type', 'text/javascript');
				const origin = 'http://127.0.0.1:' + server.address().port;
				res.end('const vscode = require("vscode"); exports.activate = context => { fetch(' + JSON.stringify(origin + '/_h1/activated/' + name) + ', { method: "POST" }); context.subscriptions.push(vscode.commands.registerCommand("agentFirst.fixture." + ' + JSON.stringify(name) + ', () => ' + JSON.stringify(name) + ')); };');
			}
			return;
		}
		if (req.url?.startsWith('/_h1/activated/')) { activations.push(req.url.slice('/_h1/activated/'.length)); res.end('ok'); return; }
		if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end(html); return; }
		const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
		if (relative(root, path).startsWith('..')) { res.writeHead(403).end(); return; }
		res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.wasm': 'application/wasm', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' })[extname(path)] || 'application/octet-stream');
		res.end(await readFile(path));
	} catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
	const { chromium } = require('@playwright/test');
	browser = await chromium.launch({ headless: true, ...(process.env.AGENT_FIRST_CHROMIUM ? { executablePath: process.env.AGENT_FIRST_CHROMIUM } : {}) });
	const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
	const scripts = new Set(); const workers = new Set();
	const workerLifetimes = []; const workerAttributions = [];
	page.on('response', r => { if (new URL(r.url()).pathname.endsWith('.js')) { scripts.add(new URL(r.url()).pathname); } if (probeExtensions && r.status() === 404) { console.log('HTTP404', new URL(r.url()).pathname); } });
	page.on('worker', worker => {
		const url = new URL(worker.url()).pathname;
		workers.add(url);
		const lifetime = { url, name: undefined, closed: false, attributionUnavailable: false };
		workerLifetimes.push(lifetime);
		worker.on('close', () => { lifetime.closed = true; });
		workerAttributions.push(within(worker.evaluate(() => globalThis.name), 'Worker name').then(name => { lifetime.name = name; }, () => { lifetime.attributionUnavailable = true; }));
	});
	page.on('pageerror', e => console.error('PAGE_ERROR', redact(e.message)));
	page.on('console', m => { if (m.type() === 'error') { console.error('CONSOLE_ERROR', redact(m.text())); } });
	await page.goto(`http://127.0.0.1:${server.address().port}/`);
	await page.locator('.monaco-workbench').waitFor({ timeout: 30000 });
	await page.waitForTimeout(process.argv.includes('--mock-host') ? 10000 : 3000);
	if (probeExtensions) {
		await page.waitForFunction(() => window.agentFirstExtensionProbeReady, null, { timeout: 30000 });
		const status = await within(page.evaluate(() => window.agentFirstWorkbench.commands.executeCommand('agentFirst.test.extensionStatus')), 'Extension registration/activation');
		const control = await within(page.evaluate(() => window.agentFirstWorkbench.commands.executeCommand('agentFirst.fixture.control')), 'Original API command');
		console.log(JSON.stringify({ extensionHostProbe: status, control, manifests: [...fixtureManifests].sort(), fixtureModules, activations }));
		if (control !== 'control' || activations.length !== 1 || activations[0] !== 'control' || fixtureManifests.size !== 4 || fixtureModules.join() !== 'control' || status.enabled.join() !== 'h1-fixture.control') { throw new Error('Original Extension Host admission probe failed'); }
		const diff = await within(page.evaluate(() => window.agentFirstWorkbench.commands.executeCommand('agentFirst.test.diff')), 'Original diff');
		console.log(JSON.stringify({ originalDiffFixture: diff }));
		if (diff.pane !== 'workbench.editors.textDiffEditor' || diff.readOnly !== true || !diff.modified?.includes('a + b')) { throw new Error('Original read-only diff fixture failed'); }
		if (!legacyEditorRoutes) {
			const result = await within(page.evaluate(async () => {
				// Evaluate the actual Agent-only desktop registration branch; no native host or Electron runtime is substituted.
				await import('/out/vs/sessions/electron-browser/sessions.desktop.contribution.js');
				const shouldShowReturn = await window.agentFirstWorkbench.commands.executeCommand('agents.shouldShowReturnToVSCodeEditor');
				const rejected = [];
				for (const command of ['sessions.openInVSCode', 'agents.openSessionInVSCode', 'agents.openVSCodeWindow', 'agents.returnToVSCodeEditor']) {
					try { await window.agentFirstWorkbench.commands.executeCommand(command); } catch { rejected.push(command); }
				}
				return { shouldShowReturn, rejected };
			}), 'Editor route rejection');
			console.log(JSON.stringify({ editorRouteProbe: result, platform: 'browser; desktop registration branch only' }));
			if (result.shouldShowReturn !== false || result.rejected.length !== 4) { throw new Error('Editor routes were not rejected'); }
		}
	}
	const workerDetails = [];
	for (const worker of page.workers()) {
		try {
			workerDetails.push(await within(worker.evaluate(() => ({ name: globalThis.name, resources: performance.getEntriesByType('resource').flatMap(entry => { const url = new URL(entry.name, location.href); return ['http:', 'https:'].includes(url.protocol) ? [url.pathname] : []; }), resourceTimingMayBeTruncated: true })), 'Worker attribution'));
		} catch { workerDetails.push({ unavailable: true }); }
	}
	await Promise.all(workerAttributions);
	console.log(JSON.stringify({ workerLifetimes, workerDetails }));
	if (process.env.AGENT_FIRST_TRACE) { await writeFile(process.env.AGENT_FIRST_TRACE, JSON.stringify({ kind: 'browser-resource-load-not-EH-activation', scripts: [...scripts].sort(), workers: [...workers].sort(), workerLifetimes, workerDetails }, null, 2)); }
	const composition = await checkComposition(page, scripts, legacyEditorRoutes);
	console.log(JSON.stringify({ composition }));
	console.log(JSON.stringify({ browser: browser.version(), originalWorkbench: await page.locator('.monaco-workbench').count(), text: (await page.locator('body').innerText()).slice(0, 2000) }));
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
