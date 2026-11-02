/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { isNativeAgentResource, nativeAgentResource, parseNativeAgentConfiguration } from '../../common/nativeAgentConfiguration.js';

suite('Native agent configuration', () => {
	ensureNoDisposablesAreLeakedInTestSuite();
	const api = { mode: 'apiKey', baseUrl: 'https://example.com/v1/', apiKey: 'fixture-key', model: 'model', home: '/agent-state' };

	test('normalizes a configured endpoint and keeps local configuration free of app credentials', () => {
		assert.deepStrictEqual({
			api: parseNativeAgentConfiguration(JSON.stringify(api)),
			local: parseNativeAgentConfiguration(JSON.stringify({ ...api, mode: 'local', executable: '/bin/agent' })),
			cleared: parseNativeAgentConfiguration(''),
		}, {
			api: { ...api, baseUrl: 'https://example.com/v1', executable: undefined },
			local: { mode: 'local', executable: '/bin/agent' },
			cleared: undefined,
		});
	});

	test('rejects malformed connections without echoing keys into diagnostics', () => {
		for (const invalid of [
			{ ...api, baseUrl: 'https://user:fixture-key@example.com' },
			{ ...api, baseUrl: 'https://example.com?key=fixture-key' },
			{ ...api, baseUrl: 'file:///private/data' },
			{ ...api, apiKey: 'fixture-key\r\nheader' },
			{ ...api, model: '' },
			{ ...api, home: undefined },
			{ ...api, executable: './agent' },
			{ mode: 'other' },
			null,
		]) {
			assert.throws(() => parseNativeAgentConfiguration(JSON.stringify(invalid)), error => error instanceof Error && !error.message.includes('fixture-key'));
		}
	});

	test('recognizes only the two native configuration resources', () => {
		assert.deepStrictEqual(['claude', 'codex', 'codex.evil', ''].map(id => isNativeAgentResource(`vsc-agent-native://${id}`)), [true, true, false, false]);
		assert.strictEqual(nativeAgentResource('codex'), 'vsc-agent-native://codex');
	});
});
