/*---------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { spawn, execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const root = process.cwd();
const work = path.join(root, '.build/native-vsix-20261030');
const raw = path.join(work, 'raw');
const inputs = JSON.parse(await fs.readFile(path.join(work, 'inputs.json'), 'utf8'));
const fixtureIds = inputs.fixtures.map(fixture => fixture.id);
const { chromium } = createRequire(path.join(root, 'package.json'))('playwright');
const env = { ...process.env, PATH: path.join(root, '.build/mac-toolchain/node-v24.22.1-darwin-arm64/bin') + ':' + process.env.PATH, VSCODE_SKIP_PRELAUNCH: '1' };
delete env.ELECTRON_RUN_AS_NODE;
delete env.GIT_CONFIG_COUNT;
delete env.GIT_CONFIG_PARAMETERS;
const development = process.argv.includes('--development');
const resume = process.argv.includes('--resume') || development;
const result = resume ? JSON.parse(await fs.readFile(path.join(raw, 'result.json'), 'utf8')) : { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), platform: process.platform, arch: process.arch, node: process.version, fixtureIds, checks: {} };
delete result.failure;
delete result.cleanupError;
let info, browser, activePage;

async function command(executable, args) {
	const child = spawn(executable, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
	let stdout = '', stderr = '';
	child.stdout.on('data', data => stdout += data);
	child.stderr.on('data', data => stderr += data);
	await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(stderr || `${executable} exited ${code}`))); });
	return { stdout, stderr };
}

async function connect() {
	browser = await chromium.connectOverCDP(`http://127.0.0.1:${info.cdpPort}`, { timeout: 20000 });
	for (let attempt = 0; attempt < 100; attempt++) {
		activePage = browser.contexts()[0].pages().find(page => page.url().includes('sessions-dev.html'));
		if (activePage) break;
		await new Promise(resolve => setTimeout(resolve, 200));
	}
	assert(activePage, 'Original Sessions page must exist');
	await activePage.locator('.monaco-workbench').waitFor({ timeout: 60000 });
	await activePage.waitForTimeout(7000);
	const baseUrl = activePage.url().split('/out/')[0] + '/out/';
	await activePage.evaluate(async baseUrl => {
		const [{ Action2, registerAction2 }, { IWorkbenchExtensionManagementService, IWorkbenchExtensionEnablementService }, { IExtensionService }, { IProductService }, { IConfigurationService }, { IStorageService }, { IWorkspaceContextService }, { IExtensionsScannerService }] = await Promise.all([
			import(baseUrl + 'vs/platform/actions/common/actions.js'),
			import(baseUrl + 'vs/workbench/services/extensionManagement/common/extensionManagement.js'),
			import(baseUrl + 'vs/workbench/services/extensions/common/extensions.js'),
			import(baseUrl + 'vs/platform/product/common/productService.js'),
			import(baseUrl + 'vs/platform/configuration/common/configuration.js'),
			import(baseUrl + 'vs/platform/storage/common/storage.js'),
			import(baseUrl + 'vs/platform/workspace/common/workspace.js'),
			import(baseUrl + 'vs/platform/extensionManagement/common/extensionsScannerService.js')
		]);
		globalThis.__h1VsixRegistration = registerAction2(class extends Action2 {
			constructor() { super({ id: 'h1.native.vsixHarness', title: 'H1 Native VSIX Harness', f1: true }); }
			run(accessor) {
				globalThis.__h1Vsix = {
					management: accessor.get(IWorkbenchExtensionManagementService),
					enablement: accessor.get(IWorkbenchExtensionEnablementService),
					extensions: accessor.get(IExtensionService),
					product: accessor.get(IProductService),
					configuration: accessor.get(IConfigurationService),
					storage: accessor.get(IStorageService),
					workspace: accessor.get(IWorkspaceContextService),
					scanner: accessor.get(IExtensionsScannerService)
				};
			}
		});
	}, baseUrl);
	await activePage.keyboard.press('Escape');
	await activePage.keyboard.press('F1');
	await activePage.locator('.quick-input-widget .quick-input-box input').fill('>H1 Native VSIX Harness');
	await activePage.keyboard.press('Enter');
	await activePage.waitForFunction(() => !!globalThis.__h1Vsix);
	return activePage;
}

async function inspect(page) {
	return page.evaluate(async ids => {
		const h = globalThis.__h1Vsix;
		await h.extensions.whenInstalledExtensionsRegistered();
		const installed = (await h.management.getInstalled()).filter(extension => ids.includes(extension.identifier.id));
		const config = globalThis.vscode.context.configuration();
		return {
			mode: { isSessionsWindow: config.isSessionsWindow, agentFirst: h.product.agentFirst, executableExtensions: h.product.agentFirstExecutableExtensions, development: !!config.extensionDevelopmentPath?.length },
			workspaceId: h.workspace.getWorkspace().id,
			serviceClass: h.extensions.constructor.name,
			installed: installed.map(extension => ({ id: extension.identifier.id, valid: extension.isValid, state: h.enablement.getEnablementState(extension), location: extension.location.fsPath })),
			registeredExecutableIds: h.extensions.extensions.filter(extension => extension.main || extension.browser).map(extension => extension.identifier.value)
		};
	}, fixtureIds);
}

async function trigger(page) {
	return page.evaluate(async () => {
		const service = globalThis.__h1Vsix.extensions;
		const events = ['*', 'onStartupFinished', 'onLanguage:h1-native-fixture', 'onCommand:h1.native.editor-only', 'onCommand:h1.native.mixed', 'onChatParticipant:h1-native-fixture.mixed', 'onChatParticipant:github.copilot.editsAgent'];
		for (const event of events) await service.activateByEvent(event);
		return { serviceClass: service.constructor.name, completed: events };
	});
}

async function markers(state) {
	const values = [];
	for (const extension of state.installed) {
		for (const name of ['.h1-module.jsonl', '.h1-activation.jsonl']) {
			let contents = '';
			try { contents = await fs.readFile(path.join(extension.location, name), 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
			values.push({ id: extension.id, marker: name, lines: contents.trim() ? contents.trim().split('\n').length : 0, sha256: createHash('sha256').update(contents).digest('hex') });
		}
	}
	return values;
}

async function logs() {
	const collected = [];
	async function walk(directory) {
		for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
			const file = path.join(directory, entry.name);
			if (entry.isDirectory()) await walk(file);
			else if (entry.name === 'exthost.log') collected.push({ relativePath: path.relative(path.join(info.userDataDir, 'logs'), file), body: (await fs.readFile(file, 'utf8')).replaceAll(root, '$REPO') });
		}
	}
	await walk(path.join(info.userDataDir, 'logs'));
	return collected;
}

async function stop() {
	if (browser) { try { await browser.close(); } catch {} browser = undefined; }
	if (info?.pid) {
		try { process.kill(info.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
		for (let attempt = 0; attempt < 100; attempt++) {
			try { process.kill(info.pid, 0); } catch { return; }
			await new Promise(resolve => setTimeout(resolve, 100));
		}
		throw new Error('Owned native process did not exit; refusing to reuse its profile');
	}
}

try {
	let page;
	if (!resume) {
	const launched = await command('bash', ['.agents/skills/launch/scripts/launch.sh', '--agents', '--skip-prelaunch', '--session-title', 'H1 Native VSIX Admission', '--source-user-data-dir', path.join(work, 'empty-profile'), '--disable-workspace-trust', '--', '--use-inmemory-secretstorage', '--folder-uri', 'file://' + inputs.project]);
	await fs.writeFile(path.join(raw, 'launch.json'), launched.stdout);
	await fs.writeFile(path.join(raw, 'launch.log'), launched.stderr);
	info = JSON.parse(launched.stdout.trim().split('\n').at(-1));
	page = await connect();
	result.installation = await page.evaluate(async fixtures => {
		const h = globalThis.__h1Vsix;
		const { URI } = await import(location.href.split('/out/')[0] + '/out/vs/base/common/uri.js');
		const installed = [];
		for (const fixture of fixtures) {
			const extension = await h.management.install(URI.file(fixture.vsix), { isMachineScoped: true, donotIncludePackAndDependencies: true });
			installed.push({ id: extension.identifier.id, valid: extension.isValid });
		}
		return installed;
	}, inputs.fixtures);
	await page.waitForTimeout(1000);
	result.fresh = await inspect(page);
	assert.equal(result.fresh.installed.length, 3);
	assert(result.fresh.installed.every(extension => extension.valid && extension.state === 2));
	result.enableAttempts = await page.evaluate(async ids => {
		const h = globalThis.__h1Vsix;
		const installed = (await h.management.getInstalled()).filter(extension => ids.includes(extension.identifier.id));
		const attempts = [];
		for (const extension of installed) for (const state of [12, 13]) {
			try { await h.enablement.setEnablement([extension], state); attempts.push({ id: extension.identifier.id, requestedState: state, rejected: false }); }
			catch (error) { attempts.push({ id: extension.identifier.id, requestedState: state, rejected: true, message: String(error.message) }); }
		}
		await h.configuration.updateValue('extensions.experimental.agentsWindowManagement', true);
		await h.configuration.updateValue('extensions.experimental.enableAgentsWindowCapability', true);
		await h.configuration.updateValue('extensions.experimental.agentsWindowAutoEnable', ids);
		await h.configuration.updateValue('extensions.supportAgentsWindow', Object.fromEntries(ids.map(id => [id, true])));
		return attempts;
	}, fixtureIds);
	assert(result.enableAttempts.every(attempt => attempt.rejected));
	result.freshTrigger = await trigger(page);
	await page.waitForTimeout(2000);
	result.freshAfterOverrides = await inspect(page);
	result.freshMarkers = await markers(result.freshAfterOverrides);
	assert(result.freshMarkers.every(marker => marker.lines === 0));
	assert(result.freshAfterOverrides.installed.every(extension => extension.state === 2));
	assert.equal(result.freshAfterOverrides.registeredExecutableIds.length, 0);
	result.freshLogsBeforeControl = await logs();
	console.log('Production empty-list install/enable/config/event negatives completed');
	result.control = await page.evaluate(async ids => {
		const h = globalThis.__h1Vsix;
		const original = h.product.agentFirstExecutableExtensions;
		if (!Array.isArray(original) || original.length) throw new Error('Expected actual empty production policy');
		h.product.agentFirstExecutableExtensions = ids;
		try {
			const installed = (await h.management.getInstalled()).filter(extension => ids.includes(extension.identifier.id));
			await h.enablement.setEnablement(installed, 13);
			await h.storage.flush();
			return { testOnlyProductOverlay: ids, originalPolicy: original, states: installed.map(extension => ({ id: extension.identifier.id, state: h.enablement.getEnablementState(extension) })) };
		} catch (error) { h.product.agentFirstExecutableExtensions = original; throw error; }
	}, fixtureIds);
	assert(result.control.states.every(extension => extension.state === 13));
	for (let attempt = 0; attempt < 50; attempt++) {
		const registered = await inspect(page);
		if (fixtureIds.every(id => registered.registeredExecutableIds.includes(id))) break;
		await page.waitForTimeout(100);
	}
	result.controlTrigger = await trigger(page);
	await page.waitForTimeout(1500);
	result.controlState = await inspect(page);
	result.controlMarkers = await markers(result.controlState);
	assert(result.controlMarkers.every(marker => marker.lines > 0), 'Admitted synthetic fixtures must actually execute');
	await page.evaluate(async () => { const h = globalThis.__h1Vsix; h.product.agentFirstExecutableExtensions = []; await h.storage.flush(); });
	result.restoredBeforeQuit = await inspect(page);
	await stop();
	result.controlLogs = await logs();
	} else {
		info = JSON.parse((await fs.readFile(path.join(raw, 'launch.json'), 'utf8')).trim().split('\n').at(-1));
		assert.equal(result.source, execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), 'Resume requires unchanged source');
	}
	const priorLogPaths = development ? (await logs()).map(log => log.relativePath) : result.controlLogs.map(log => log.relativePath);
	const output = await fs.open(path.join(raw, 'restart.log'), 'w');
	const child = spawn('bash', ['scripts/code.sh', '--agents', '--user-data-dir=' + info.userDataDir, '--extensions-dir=' + info.extensionsDir, '--shared-data-dir=' + info.sharedDataDir, '--remote-debugging-port=' + info.cdpPort, '--inspect-extensions=' + info.extHostPort, '--inspect=' + info.mainPort, '--inspect-agenthost=' + info.agentHostPort, '--disable-workspace-trust', '--use-inmemory-secretstorage', '--folder-uri', 'file://' + inputs.project, ...(development ? ['--extensionDevelopmentPath=' + path.join(work, 'sources/development-only')] : [])], { cwd: root, env, stdio: ['ignore', output.fd, output.fd] });
	child.once('exit', () => void output.close());
	info = { ...info, pid: child.pid };
	await command(process.execPath, ['.agents/skills/launch/scripts/waitForCdp.ts', String(info.pid), String(info.cdpPort), '60000']);
	page = await connect();
	result.restartScenario = development ? 'Production policy with native extensionDevelopmentPath; inherited earlier installation/positive control evidence is not rerun' : 'Production policy normal native restart';
	result.restarted = await inspect(page);
	assert.deepEqual(result.restarted.mode.executableExtensions, []);
	assert.equal(result.restarted.workspaceId, result.fresh.workspaceId, 'Saved workspace test must reuse the same workspace identity');
	assert.equal(result.restarted.installed.length, 3);
	assert(result.restarted.installed.every(extension => extension.state === 2));
	assert.equal(result.restarted.registeredExecutableIds.length, 0);
	if (development) {
		assert.equal(result.restarted.mode.development, true);
		result.developmentCandidate = await page.evaluate(async () => {
			const h = globalThis.__h1Vsix;
			const scanned = await h.scanner.scanExtensionsUnderDevelopment([], {});
			await h.configuration.updateValue('extensions.experimental.agentsWindowAutoEnable', true);
			return { autoEnable: h.configuration.getValue('extensions.experimental.agentsWindowAutoEnable'), scanned: scanned.map(extension => ({ id: extension.identifier.id, main: extension.manifest.main, valid: extension.isValid, state: h.enablement.getEnablementState(extension) })) };
		});
		assert(result.developmentCandidate.scanned.some(extension => extension.id === 'h1-native-fixture.development-only' && extension.valid && extension.state === 2));
		assert.equal(result.developmentCandidate.autoEnable, true);
	}
	result.savedWorkspaceReadback = await page.evaluate(async ids => {
		const h = globalThis.__h1Vsix;
		const installed = (await h.management.getInstalled()).filter(extension => ids.includes(extension.identifier.id));
		const original = h.product.agentFirstExecutableExtensions;
		try {
			h.product.agentFirstExecutableExtensions = ids;
			return { synchronousTestOnlyInspection: true, states: installed.map(extension => ({ id: extension.identifier.id, state: h.enablement.getEnablementState(extension) })) };
		} finally { h.product.agentFirstExecutableExtensions = original; }
	}, fixtureIds);
	assert(result.savedWorkspaceReadback.states.every(extension => extension.state === 13));
	result.restartTrigger = await trigger(page);
	await page.waitForTimeout(3000);
	result.restartMarkers = await markers(await inspect(page));
	assert.deepEqual(result.restartMarkers, result.controlMarkers, 'Restart under production policy must not load or activate installed fixtures');
	if (development) {
		for (const name of ['.h1-module.jsonl', '.h1-activation.jsonl']) {
			await assert.rejects(fs.access(path.join(work, 'sources/development-only', name)), error => error.code === 'ENOENT');
		}
		result.checks.nativeDevelopmentCandidateBlocked = true;
		result.checks.booleanAutoEnableDenied = true;
	}
	await page.screenshot({ path: path.join(raw, 'native-vsix-negative.png') });
	await stop();
	result.restartLogs = (await logs()).filter(log => !priorLogPaths.includes(log.relativePath));
	assert(result.restartLogs.some(log => /Extension host with pid \d+ started/.test(log.body)));
	assert(result.restartLogs.some(log => /exiting with code 0/.test(log.body)));
	assert(result.restartLogs.every(log => !log.body.includes('ExtensionService#_doActivateExtension')));
	result.checks.nativeVSIXInstallation = true;
	result.checks.globalAndWorkspaceEnableDenied = true;
	result.checks.autoEnableAndCapabilityOverrideDenied = true;
	result.checks.admittedSyntheticPositiveControlExecuted = true;
	result.checks.savedWorkspacePolicySurvivedRestart = true;
	console.log(JSON.stringify({ source: result.source, checks: result.checks }));
} catch (error) {
	result.failure = String(error.stack ?? error);
	process.exitCode = 1;
	console.error(result.failure);
} finally {
	try { await stop(); } catch (error) { result.cleanupError = String(error); }
	await fs.writeFile(path.join(raw, development ? 'development-result.json' : 'result.json'), JSON.stringify(result, null, 2) + '\n');
}
