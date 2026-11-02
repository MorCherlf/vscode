/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = process.cwd();
const work = path.join(root, '.build/agent-first-mac-admission-retest-20261030');
const raw = path.join(work, 'raw-final');
await fs.mkdir(raw, { recursive: true });
const require = createRequire(path.join(root, 'package.json'));
const { chromium } = require('playwright');
const title = 'Agent First Mac admission retest';
const args = ['.agents/skills/launch/scripts/launch.sh', '--agents', '--skip-prelaunch', '--session-title', title, '--source-user-data-dir', path.join(work, 'empty-profile'), '--disable-workspace-trust', '--', '--use-inmemory-secretstorage', '--folder-uri', 'file://' + JSON.parse(await fs.readFile(path.join(work, 'test-project.json'), 'utf8')).project];
const result = { source: '09c03744303e2693251b4dd077851307b1b2d95a', mode: 'native Electron, empty profile, in-memory secrets, no account/model', checks: {}, errors: [] };
let info, browser;
const launcher = spawn('bash', args, { cwd: root, env: { ...process.env, PATH: path.join(root, '.build/mac-toolchain/node-v24.22.1-darwin-arm64/bin') + ':' + process.env.PATH }, stdio: ['ignore', 'pipe', 'pipe'] });
let stdout = '', stderr = '';
launcher.stdout.on('data', b => stdout += b);
launcher.stderr.on('data', b => stderr += b);
try {
 await new Promise((resolve, reject) => { launcher.once('error', reject); launcher.once('exit', code => code === 0 ? resolve() : reject(new Error('Launcher exit ' + code))); });
 await fs.writeFile(path.join(raw, 'launch-held.json'), stdout);
 await fs.writeFile(path.join(raw, 'launch-held.log'), stderr);
 info = JSON.parse(stdout.trim().split('\n').at(-1));
 browser = await chromium.connectOverCDP('http://127.0.0.1:' + info.cdpPort, { timeout: 20000 });
 const context = browser.contexts()[0];
 let page;
 for (let attempt = 0; attempt < 80; attempt++) {
  const pages = context.pages();
  page = pages.find(p => p.url().includes('sessions')) ?? pages.find(p => p.url().includes('vscode-file:'));
  if (page) break;
  await new Promise(resolve => setTimeout(resolve, 250));
 }
 if (!page) throw new Error('No workbench page');
 const resources = new Set();
 const cdp = await context.newCDPSession(page);
 await cdp.send('Network.enable');
 cdp.on('Network.requestWillBeSent', e => { try { const u = new URL(e.request.url); if (u.protocol === 'vscode-file:' || u.protocol === 'file:') resources.add(decodeURIComponent(u.pathname).replace(root, '')); } catch {} });
 page.on('pageerror', error => result.errors.push(error.message));
 await page.addInitScript(() => performance.setResourceTimingBufferSize(50000));
 await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
 await page.locator('.monaco-workbench').waitFor({ timeout: 60000 });
 await page.waitForTimeout(7000);
 result.checks.workbench = await page.locator('.monaco-workbench').count();
 result.page = { url: page.url(), title: await page.title(), text: (await page.locator('body').innerText()).slice(0, 16000) };
 result.buttons = await page.getByRole('button').allTextContents();
 result.configuration = await page.evaluate(async () => {
  const g = globalThis;
  if (!g.vscode?.context) return { available: false };
  const c = g.vscode.context.configuration?.() ?? await g.vscode.context.resolveConfiguration?.();
  if (!c) return { available: false };
  return { available: true, isSessionsWindow: c.isSessionsWindow, agentFirst: c.product?.agentFirst, executableExtensions: c.product?.agentFirstExecutableExtensions, isExtensionDevelopment: !!c.extensionDevelopmentPath?.length };
 });
 const baseUrl = page.url().split('/out/')[0] + '/out/';
 result.activationProbeInstalled = await page.evaluate(async ({ actionsUrl, extensionsUrl }) => {
  const { Action2, registerAction2 } = await import(actionsUrl);
  const { IExtensionService } = await import(extensionsUrl);
  globalThis.__h1NativeAdmissionProbe = { exercised: false };
  registerAction2(class extends Action2 {
   constructor() { super({ id: 'h1.mac.nativeAdmissionProbe', title: 'H1 Native Admission Probe', f1: true }); }
   async run(accessor) {
    const service = accessor.get(IExtensionService);
    const event = 'onChatParticipant:github.copilot.editsAgent';
    await service.whenInstalledExtensionsRegistered();
    globalThis.__h1NativeAdmissionProbe = { exercised: true, event, completed: false, serviceClass: service.constructor.name };
    await service.activateByEvent(event);
    globalThis.__h1NativeAdmissionProbe = { exercised: true, event, completed: true, serviceClass: service.constructor.name, registeredExtensions: service.extensions.map(extension => ({ id: extension.identifier.value, executable: !!(extension.main || extension.browser) })) };
   }
  });
  return true;
 }, { actionsUrl: baseUrl + 'vs/platform/actions/common/actions.js', extensionsUrl: baseUrl + 'vs/workbench/services/extensions/common/extensions.js' });
 const before = await page.locator('.monaco-editor').count();
 result.checks.originalEditorCount = before;
 const focusCode = await fs.readFile(path.join(root, '.agents/skills/launch/playwrightScripts/focus-chat-input.ts'), 'utf8');
 const focusInput = (0, eval)('(' + focusCode + ')');
 result.checks.chatFocus = await focusInput(page);
 await page.keyboard.press('Meta+a');
 await page.keyboard.press('Backspace');
 const draft = 'Mac 中文粘贴验证\n第二行 draft';
 result.checks.chinesePaste = await page.evaluate(async draft => {
  const root = document.activeElement;
  if (!root?.matches('.native-edit-context, textarea.inputarea')) return { passed: false, reason: 'wrong focus' };
  const editor = root.closest('.monaco-editor');
  const data = new DataTransfer();
  data.setData('text/plain', draft);
  root.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 500));
  const lines = [...editor.querySelectorAll('.view-line')].map(line => line.textContent.replace(/\u00a0/g, ' '));
  return { passed: lines.join('').includes(draft.replace(/\n/g, '')), lines };
 }, draft);
 await page.screenshot({ path: path.join(raw, 'native-chinese-draft.png') });
 await page.keyboard.press('Meta+a');
 await page.keyboard.press('Backspace');
 const project = JSON.parse(await fs.readFile(path.join(work, 'test-project.json'), 'utf8')).project;
 const originalFile = await fs.readFile(path.join(project, 'sum.js'), 'utf8');
 result.checks.fileReview = { attempted: true };
 try {
  await page.keyboard.press('Meta+Shift+e');
  await page.waitForTimeout(800);
  const item = page.getByRole('treeitem', { name: /^sum\.js(?:\b|$)/ }).first();
  await item.dblclick({ timeout: 5000 });
  await page.waitForTimeout(1000);
  const editors = page.locator('.monaco-editor:visible');
  result.checks.fileReview.editorStates = await editors.evaluateAll(nodes => nodes.map(e => ({ classes: e.className, role: e.getAttribute('role'), label: e.getAttribute('aria-label'), text: [...e.querySelectorAll('.view-line')].map(l => l.textContent).join('\n') })));
  const review = editors.filter({ hasText: /export\s+const\s+sum/ }).first();
  await review.waitFor({ state: 'visible', timeout: 5000 });
  const surface = review.locator('.native-edit-context, textarea.inputarea').first();
  result.checks.fileReview.textBefore = await review.locator('.view-lines').innerText();
  await surface.focus();
  await page.keyboard.press('End');
  await page.keyboard.press('A');
  await page.waitForTimeout(300);
  result.checks.fileReview.textAfterKeypress = await review.locator('.view-lines').innerText();
  await surface.evaluate(element => {
   const data = new DataTransfer();
   data.setData('text/plain', 'H1_WRITE_PROBE');
   element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(300);
  result.checks.fileReview.textAfterPaste = await review.locator('.view-lines').innerText();
  result.checks.fileReview.bufferUnchanged = result.checks.fileReview.textBefore === result.checks.fileReview.textAfterKeypress && result.checks.fileReview.textBefore === result.checks.fileReview.textAfterPaste;
  result.checks.fileReview.fileUnchanged = originalFile === await fs.readFile(path.join(project, 'sum.js'), 'utf8');
  result.checks.fileReview.readonlyNotice = (await page.locator('body').innerText()).includes('read-only');
  await page.screenshot({ path: path.join(raw, 'native-readonly-review.png') });
 } catch (error) { result.checks.fileReview.error = String(error); }

 result.nativeVersion = await browser.version();
 result.captureMode = 'controlled renderer reload, not cold-start performance';
 await page.screenshot({ path: path.join(raw, 'native-agent-window.png') });
 await fs.writeFile(path.join(raw, 'native-page.html.txt'), await page.locator('body').innerText());
 result.resources = [...resources].sort();
 const excluded = ['/out/vs/editor/editor.all.js', '/out/vs/workbench/contrib/notebook/browser/notebook.contribution.js', '/out/vs/workbench/contrib/interactive/browser/interactive.contribution.js', '/out/vs/workbench/contrib/searchEditor/browser/searchEditor.contribution.js', '/out/vs/workbench/contrib/mergeEditor/browser/mergeEditor.contribution.js'];
 result.checks.excludedStartupModules = excluded.map(module => ({ module, loaded: result.resources.some(p => p.endsWith(module)) }));
 await page.keyboard.press('F1');
 await page.waitForTimeout(800);
 result.commandPalette = (await page.locator('body').innerText()).slice(0, 12000);
 await page.screenshot({ path: path.join(raw, 'native-command-palette.png') });
 await page.keyboard.press('Escape');
 await page.keyboard.press('Escape');
 await page.keyboard.press('F1');
 await page.locator('.quick-input-widget .quick-input-box input').fill('>H1 Native Admission Probe');
 await page.keyboard.press('Enter');
 await page.waitForFunction(() => globalThis.__h1NativeAdmissionProbe?.completed, { timeout: 15000 });
 result.explicitActivation = await page.evaluate(() => globalThis.__h1NativeAdmissionProbe);
 await page.waitForTimeout(6000);
 result.checks.appStayedAlive = true;
 console.log(JSON.stringify({ workbench: result.checks.workbench, version: result.nativeVersion, url: result.page.url, resourceCount: result.resources.length, errorCount: result.errors.length }));
} catch (error) { result.failure = String(error.stack ?? error); process.exitCode = 1; console.error(result.failure); }
finally {
 await fs.writeFile(path.join(raw, 'native-smoke.json'), JSON.stringify(result, null, 2) + '\n');
 if (browser) { try { await browser.close(); } catch {} }
 if (info?.pid) { try { process.kill(info.pid, 'SIGTERM'); } catch {} }
 if (info?.logFile) { try { await fs.copyFile(info.logFile, path.join(raw, 'native-code.log')); } catch {} }
 if (info?.userDataDir) {
  await new Promise(resolve => setTimeout(resolve, 500));
  const logsRoot = path.join(info.userDataDir, 'logs');
  const collected = [];
  async function collect(directory) {
   for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(file);
    else if (entry.name === 'exthost.log') {
     const body = await fs.readFile(file, 'utf8');
     collected.push({ relativePath: path.relative(logsRoot, file), body });
    }
   }
  }
  try { await collect(logsRoot); } catch (error) { result.logCollectionError = String(error); }
  await fs.writeFile(path.join(raw, 'native-eh-logs.json'), JSON.stringify(collected, null, 2) + '\n');
  result.nativeEH = { logCount: collected.length, started: collected.some(log => /Extension host with pid \d+ started/.test(log.body)), activationLines: collected.flatMap(log => log.body.split('\n').filter(line => line.includes('ExtensionService#_doActivateExtension'))) };
 }
 await fs.writeFile(path.join(raw, 'native-smoke.json'), JSON.stringify(result, null, 2) + '\n');
}
