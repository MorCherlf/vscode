/* Copyright (c) Microsoft Corporation. All rights reserved. */
/* Licensed under the MIT License. See LICENSE.txt in the project root for license information. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inputAnswers, supportsQuestion, supportsInputUrl } from '../dist/index.js';
const question = (kind, extra = {}) => ({ id: kind, kind, message: kind, required: true, ...extra });
test('all released question types produce official answer values including false, zero and defaults', () => {
	const questions = [question('text', { min: 2, max: 4 }), question('number', { min: 0, max: 3 }), question('integer', { defaultValue: 2 }), question('boolean'), question('single-select', { options: [{ id: 'a', label: 'A' }] }), question('multi-select', { min: 1, max: 2, options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] })];
	assert.deepEqual(Object.values(inputAnswers({ id: 'r', questions }, { text: 'ok', number: '0', boolean: false, 'single-select': 'a', 'multi-select': ['a', 'b'] })).map(answer => answer.value), [{ kind: 'text', value: 'ok' }, { kind: 'number', value: 0 }, { kind: 'number', value: 2 }, { kind: 'boolean', value: false }, { kind: 'selected', value: 'a' }, { kind: 'selected-many', value: ['a', 'b'] }]);
});
test('required, bounds, finite integer, text formats, unknown types and invalid selection fail closed', () => {
	for (const [q, value] of [[question('text', { min: 2 }), 'x'], [question('text', { format: 'email' }), 'bad'], [question('text', { format: 'date' }), '2026-02-30'], [question('text', { format: 'future' }), 'x'], [question('number'), 'NaN'], [question('number', { max: 1 }), '2'], [question('integer'), '1.5'], [question('boolean'), 'false'], [question('single-select', { options: [] }), 'forged'], [question('multi-select', { options: [{ id: 'a' }] }), ['a', 'a']], [question('future'), 'x'], [question('text'), undefined]]) {
		assert.throws(() => inputAnswers({ id: 'r', questions: [q] }, { [q.id]: value }), /INPUT_/);
	}
	assert.equal(supportsQuestion(question('future')), false);
	assert.deepEqual(inputAnswers({ id: 'r', questions: [question('text', { required: false })] }, {}), { text: { state: 'skipped' } });
});
test('URL capability excludes executable schemes, userinfo and oversized addresses', () => {
	assert.deepEqual(['https://github.com/login/device', 'javascript:alert(1)', 'file:///etc/passwd', 'http://localhost', 'https://user:secret@example.org', 'https://example.org/' + 'a'.repeat(2048)].map(supportsInputUrl), [true, false, false, false, false, false]);
});
test('freeform selection preserves option identity and protocol freeformValues', () => {
	assert.deepEqual(inputAnswers({ id: 'r', questions: [question('single-select', { allowFreeformInput: true, options: [] }), question('multi-select', { allowFreeformInput: true, options: [{ id: 'a' }] })] }, { 'single-select': 'custom', 'multi-select': ['a', 'other'] }), { 'single-select': { state: 'submitted', value: { kind: 'selected', value: '', freeformValues: ['custom'] } }, 'multi-select': { state: 'submitted', value: { kind: 'selected-many', value: ['a'], freeformValues: ['other'] } } });
});
