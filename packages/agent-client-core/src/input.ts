/* Copyright (c) Microsoft Corporation. All rights reserved. */
/* Licensed under the MIT License. See LICENSE.txt in the project root for license information. */
import { ChatInputAnswerState, ChatInputAnswerValueKind, type ChatInputRequest, type ChatInputAnswer, type ChatInputQuestion } from '@microsoft/agent-host-protocol';
export type InputValue = string | boolean | string[];
/** Future question kinds and formats fail closed, rather than silently dropping constraints. */
export function supportsQuestion(question: ChatInputQuestion): boolean {
	return ['text', 'number', 'integer', 'boolean', 'single-select', 'multi-select'].includes(question.kind)
		&& (question.kind !== 'text' || !question.format || ['email', 'uri', 'date', 'date-time'].includes(question.format));
}
/** Applies the actual AHP constraints before producing official typed answers. */
export function inputAnswers(request: ChatInputRequest, values: Record<string, InputValue>): Record<string, ChatInputAnswer> {
	const answers: Record<string, ChatInputAnswer> = {};
	for (const question of request.questions ?? []) {
		if (!supportsQuestion(question)) { throw new Error('INPUT_UNSUPPORTED'); }
		const defaultValue = 'defaultValue' in question ? question.defaultValue : undefined;
		const raw = values[question.id] ?? (typeof defaultValue === 'number' ? String(defaultValue) : defaultValue);
		if (raw === undefined || (raw === '' && question.kind !== 'text')) {
			if (question.required) { throw new Error('INPUT_REQUIRED'); }
			answers[question.id] = { state: ChatInputAnswerState.Skipped }; continue;
		}
		let value: Extract<ChatInputAnswer, { value: object }>['value'];
		switch (question.kind) {
			case 'text': {
				if (typeof raw !== 'string' || (question.required && !raw.length) || (question.min !== undefined && raw.length < question.min) || (question.max !== undefined && raw.length > question.max)) { throw new Error('INPUT_TEXT_LENGTH'); }
				if (question.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) { throw new Error('INPUT_FORMAT'); }
				if (question.format === 'uri') { try { new URL(raw); } catch { throw new Error('INPUT_FORMAT'); } }
				if (question.format === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || !Number.isFinite(Date.parse(raw)) || new Date(raw).toISOString().slice(0, 10) !== raw)) { throw new Error('INPUT_FORMAT'); }
				if (question.format === 'date-time' && (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(raw) || !Number.isFinite(Date.parse(raw)))) { throw new Error('INPUT_FORMAT'); }
				value = { kind: ChatInputAnswerValueKind.Text, value: raw }; break;
			}
			case 'number': case 'integer': {
				if (typeof raw !== 'string' || !raw.trim()) { throw new Error('INPUT_NUMBER'); }
				const number = Number(raw);
				if (!Number.isFinite(number) || (question.kind === 'integer' && !Number.isSafeInteger(number)) || (question.min !== undefined && number < question.min) || (question.max !== undefined && number > question.max)) { throw new Error('INPUT_NUMBER'); }
				value = { kind: ChatInputAnswerValueKind.Number, value: number }; break;
			}
			case 'boolean': {
				if (typeof raw !== 'boolean') { throw new Error('INPUT_BOOLEAN'); }
				value = { kind: ChatInputAnswerValueKind.Boolean, value: raw }; break;
			}
			case 'single-select': {
				if (typeof raw !== 'string' || !raw || (!question.allowFreeformInput && !question.options.some(option => option.id === raw))) { throw new Error('INPUT_SELECTION'); }
				value = question.options.some(option => option.id === raw) ? { kind: ChatInputAnswerValueKind.Selected, value: raw } : { kind: ChatInputAnswerValueKind.Selected, value: '', freeformValues: [raw] }; break;
			}
			case 'multi-select': {
				if (!Array.isArray(raw) || new Set(raw).size !== raw.length || raw.some(id => !id || (!question.allowFreeformInput && !question.options.some(option => option.id === id))) || (question.required && !raw.length) || (question.min !== undefined && raw.length < question.min) || (question.max !== undefined && raw.length > question.max)) { throw new Error('INPUT_SELECTION'); }
				const selected = raw.filter(id => question.options.some(option => option.id === id));
				const freeformValues = raw.filter(id => !selected.includes(id));
				value = { kind: ChatInputAnswerValueKind.SelectedMany, value: selected, ...(freeformValues.length ? { freeformValues } : {}) }; break;
			}
			default: throw new Error('INPUT_UNSUPPORTED');
		}
		answers[question.id] = { state: ChatInputAnswerState.Submitted, value };
	}
	return answers;
}
/** Only explicitly opened HTTPS requests are supported; never automatically accept a URL request. */
export function supportsInputUrl(value: string): boolean {
	try { const url = new URL(value); return value.length <= 2048 && url.protocol === 'https:' && !!url.hostname && !url.username && !url.password; } catch { return false; }
}
