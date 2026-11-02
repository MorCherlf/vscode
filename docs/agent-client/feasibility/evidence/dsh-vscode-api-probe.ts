/* Copyright (c) Microsoft Corporation. All rights reserved. */
/* Licensed under the MIT License. See LICENSE.txt in the project root for license information. */

// Compile-only probe against this checkout's real VS Code declarations.
// This is not an installed extension, a DSH runtime, or an Agents Window integration test.
import * as vscode from 'vscode';

export function registerDshSessionApi(
	context: vscode.ExtensionContext,
	provider: vscode.ChatSessionContentProvider,
	refresh: vscode.ChatSessionItemControllerRefreshHandler,
	handler: vscode.ChatRequestHandler,
): vscode.ChatSessionItemController {
	const sessionType = 'dsh-adapter-probe';
	const controller = vscode.chat.createChatSessionItemController(sessionType, refresh);
	context.subscriptions.push(controller);
	const participant = vscode.chat.createChatParticipant(sessionType, handler);
	context.subscriptions.push(participant);
	context.subscriptions.push(vscode.chat.registerChatSessionContentProvider(sessionType, provider, participant, {
		supportsInterruptions: false,
	}));
	return controller;
}

export function invokeVscodeToolFromDsh<T extends object>(
	name: string,
	input: T,
	token: vscode.CancellationToken,
): Thenable<vscode.LanguageModelToolResult> {
	return vscode.lm.invokeTool(name, { input, toolInvocationToken: undefined }, token);
}
