/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { assertAgentFirstWindowAllowed, getAgentFirstWindowTarget } from '../../electron-main/agentFirstWindow.js';
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
		['diff', { ...base, diffMode: true }, { kind: 'unsupported' }],
		['merge', { ...base, mergeMode: true }, { kind: 'unsupported' }],
		['CLI diff', { ...base, cli: { _: [], diff: true } }, { kind: 'unsupported' }],
		['folder mutation', { ...base, addMode: true }, { kind: 'unsupported' }],
		['contradictory empty window with file payload', { ...base, forceEmpty: true, urisToOpen: [{ fileUri: URI.file('/project/a.ts') }] }, { kind: 'unsupported' }],
	];
	for (const [label, config, expected] of cases) {
		test(label, () => assert.deepStrictEqual(getAgentFirstWindowTarget(config, workspace), expected));
	}
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
