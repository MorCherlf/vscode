/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isAbsolute } from '../../../base/common/path.js';
import { localize } from '../../../nls.js';

export type NativeAgentId = 'claude' | 'codex';

/** Kept in secret storage and carried as a redacted authenticate token, never root state. */
export interface INativeAgentConfiguration {
	readonly mode: 'apiKey' | 'local';
	readonly apiKey?: string;
	readonly baseUrl?: string;
	readonly model?: string;
	readonly executable?: string;
	readonly home?: string;
}

export const NATIVE_CODEX_MODEL_PROVIDER = 'agent-first-api';
export const NATIVE_CODEX_API_KEY_ENV = 'VSC_AGENT_CODEX_API_KEY';

export function nativeAgentResource(agent: NativeAgentId): string {
	return `vsc-agent-native://${agent}`;
}

export function isNativeAgentResource(resource: string): boolean {
	return resource === nativeAgentResource('claude') || resource === nativeAgentResource('codex');
}

export function nativeAgentSecretKey(agent: NativeAgentId): string {
	return `agentFirst.nativeAgent.${agent}`;
}

/** Validate at both the UI and host boundaries; diagnostics must never include the input. */
export function parseNativeAgentConfiguration(token: string): INativeAgentConfiguration | undefined {
	if (!token) {
		return undefined;
	}
	try {
		const value: Partial<INativeAgentConfiguration> = JSON.parse(token);
		if (!value || (value.mode !== 'apiKey' && value.mode !== 'local')) {
			throw new Error();
		}
		for (const entry of [value.executable, value.home]) {
			if (entry !== undefined && (typeof entry !== 'string' || !isAbsolute(entry) || entry.includes('\0'))) {
				throw new Error();
			}
		}
		if (value.mode === 'local') {
			return { mode: 'local', executable: value.executable };
		}
		if (typeof value.apiKey !== 'string' || !value.apiKey.trim() || /[\r\n\0]/.test(value.apiKey)
			|| typeof value.model !== 'string' || !value.model.trim() || /[\r\n\0]/.test(value.model)
			|| typeof value.baseUrl !== 'string' || !value.home) {
			throw new Error();
		}
		const url = new URL(value.baseUrl);
		if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
			throw new Error();
		}
		return { mode: 'apiKey', apiKey: value.apiKey.trim(), baseUrl: url.href.replace(/\/$/, ''), model: value.model.trim(), executable: value.executable, home: value.home };
	} catch {
		throw new Error(localize('nativeAgent.invalidConfiguration', "Invalid local agent configuration. Check the endpoint, model and executable path."));
	}
}
