/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { assertAgentFirstOpenIntentAllowed, assertAgentFirstWindowAllowed, getAgentFirstResolvedFolder, getAgentFirstWindowTarget, isAgentFirstRestorableWindow } from '../../electron-main/agentFirstWindow.js';
import type { IOpenConfiguration } from '../../electron-main/windows.js';

suite('Agent First window routing', () => {
	ensureNoDisposablesAreLeakedInTestSuite();
	const workspace = URI.file('/profile/agents.code-workspace');
	const folder = URI.file('/project');
	const base: IOpenConfiguration = { context: 0, cli: { _: [] } };
	const cases: [string, IOpenConfiguration, ReturnType<typeof getAgentFirstWindowTarget>][] = [
		['canonical Agents workspace', { ...base, urisToOpen: [{ workspaceUri: workspace }] }, { kind: 'agents' }],
		['new window', base, { kind: 'new' }],
		['empty window', { ...base, forceEmpty: true, forceNewWindow: true }, { kind: 'new' }],
		['local folder', { ...base, urisToOpen: [{ folderUri: folder }] }, { kind: 'folder', folder }],
		['file', { ...base, urisToOpen: [{ fileUri: URI.file('/project/a.ts') }] }, { kind: 'unsupported' }],
		['ordinary workspace', { ...base, urisToOpen: [{ workspaceUri: URI.file('/project/a.code-workspace') }] }, { kind: 'unsupported' }],
		['multiple folders', { ...base, urisToOpen: [{ folderUri: folder }, { folderUri: URI.file('/other') }] }, { kind: 'unsupported' }],
		['unresolved CLI payload', { ...base, cli: { _: ['/project/a.ts'] } }, { kind: 'unsupported' }],
		['file URI CLI payload', { ...base, cli: { _: [], 'file-uri': ['file:///project/a.ts'] } }, { kind: 'unsupported' }],
		['file URI cannot hide behind a canonical workspace', { ...base, cli: { _: [], 'file-uri': ['file:///project/a.ts'] }, urisToOpen: [{ workspaceUri: workspace }] }, { kind: 'unsupported' }],
		['remote authority', { ...base, remoteAuthority: 'ssh-remote+host' }, { kind: 'unsupported' }],
		['canonical workspace cannot hide remote authority', { ...base, urisToOpen: [{ workspaceUri: workspace }], remoteAuthority: 'ssh-remote+host' }, { kind: 'unsupported' }],
		['canonical workspace cannot hide CLI remote', { ...base, urisToOpen: [{ workspaceUri: workspace }], cli: { _: [], remote: 'ssh-remote+host' } }, { kind: 'unsupported' }],
		['canonical workspace cannot hide extension development', { ...base, urisToOpen: [{ workspaceUri: workspace }], cli: { _: [], extensionDevelopmentPath: ['/extension'] } }, { kind: 'unsupported' }],
		['canonical workspace cannot hide extension test runner', { ...base, urisToOpen: [{ workspaceUri: workspace }], cli: { _: [], extensionTestsPath: '/tests' } }, { kind: 'unsupported' }],
		['canonical workspace retains resolved local folder handoff', { ...base, urisToOpen: [{ workspaceUri: workspace }], cli: { _: [], agents: true, 'folder-uri': [folder.toString()] } }, { kind: 'agents' }],
		['diff', { ...base, diffMode: true }, { kind: 'unsupported' }],
		['merge', { ...base, mergeMode: true }, { kind: 'unsupported' }],
		['CLI diff', { ...base, cli: { _: [], diff: true } }, { kind: 'unsupported' }],
		['folder mutation', { ...base, addMode: true }, { kind: 'unsupported' }],
		['contradictory empty window with file payload', { ...base, forceEmpty: true, urisToOpen: [{ fileUri: URI.file('/project/a.ts') }] }, { kind: 'unsupported' }],
	];
	for (const [label, config, expected] of cases) {
		test(label, () => assert.deepStrictEqual(getAgentFirstWindowTarget(config, workspace), expected));
	}
	test('resolved CLI input must contain exactly one local folder', () => {
		const valid = { workspace: { id: 'local', uri: folder } };
		assert.deepStrictEqual([
			getAgentFirstResolvedFolder([valid]), getAgentFirstResolvedFolder([]),
			getAgentFirstResolvedFolder([valid, valid]), getAgentFirstResolvedFolder([{}, valid]),
			getAgentFirstResolvedFolder([{ workspace: { id: 'remote', uri: URI.parse('vscode-remote://host/project') } }]),
			getAgentFirstResolvedFolder([{ workspace: { id: 'workspace', configPath: workspace } }])
		], [folder, undefined, undefined, undefined, undefined, undefined]);
	});

	test('restore admits only the canonical local Agents workspace and leaves legacy history intact', () => {
		const canonical = { workspace: { configPath: workspace } };
		const states: { workspace?: { configPath: URI }; folderUri?: URI; backupPath?: string; remoteAuthority?: string }[] = [canonical, { workspace: { configPath: URI.file('/old.code-workspace') } }, { folderUri: folder }, { backupPath: '/backup' }, { ...canonical, remoteAuthority: 'ssh-remote+host' }];
		const snapshot = () => states.map(state => [state.workspace?.configPath.toString(), state.folderUri?.toString(), state.backupPath, state.remoteAuthority]);
		const before = snapshot();
		assert.deepStrictEqual(states.map(state => isAgentFirstRestorableWindow(state, workspace)), [true, false, false, false, false]);
		assert.strictEqual(isAgentFirstRestorableWindow(canonical, undefined), false);
		assert.deepStrictEqual(snapshot(), before);
	});

	test('direct Agents entry rejects unsupported payload before canonicalization, preserving ordinary products', () => {
		const unsupported: IOpenConfiguration[] = [
			{ ...base, diffMode: true }, { ...base, mergeMode: true }, { ...base, addMode: true },
			{ ...base, remoteAuthority: 'ssh-remote+host' }, { ...base, cli: { _: [], extensionDevelopmentPath: ['/extension'] } },
			{ ...base, urisToOpen: [{ fileUri: URI.file('/file') }] },
			{ ...base, urisToOpen: [{ workspaceUri: URI.file('/other.code-workspace') }] },
			{ ...base, urisToOpen: [{ folderUri: folder }, { folderUri: URI.file('/other') }] }
		];
		for (const config of unsupported) {
			assert.throws(() => assertAgentFirstOpenIntentAllowed(true, config, workspace), /single project folder/);
			assert.doesNotThrow(() => assertAgentFirstOpenIntentAllowed(false, config, workspace));
			assert.doesNotThrow(() => assertAgentFirstOpenIntentAllowed(undefined, config, workspace));
		}
		assert.doesNotThrow(() => assertAgentFirstOpenIntentAllowed(true, { ...base, urisToOpen: [{ workspaceUri: workspace }] }, workspace));
	});

	test('ordinary products retain editor windows; Agent First rejects them at the final boundary', () => {
		for (const mode of [undefined, false, true]) {
			assert.doesNotThrow(() => assertAgentFirstWindowAllowed(mode, true));
		}
		for (const mode of [undefined, false]) {
			assert.doesNotThrow(() => assertAgentFirstWindowAllowed(mode, false));
		}
		assert.throws(() => assertAgentFirstWindowAllowed(true, false), /does not open editor windows/);
	});
});
