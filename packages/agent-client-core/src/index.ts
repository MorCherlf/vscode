/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export { AgentClient } from './client.js';
export { TauriTransport } from './transport.js';
export type { NativeBridge, NativeFrame } from './transport.js';
export type { ChatState, SessionState, SessionSummary, ChatInputRequest } from '@microsoft/agent-host-protocol';

export { inputAnswers, supportsQuestion, supportsInputUrl } from './input.js';
export type { InputValue } from './input.js';
export type { ChatInputQuestion } from '@microsoft/agent-host-protocol';
