/* Copyright (c) Microsoft Corporation. All rights reserved. */
/* Licensed under the MIT License. See LICENSE.txt in the project root for license information. */
import * as vscode from 'vscode';
import { RuntimeClient, type SessionItem, type RuntimeEvent } from './runtime';
const sessionType = 'morcherlf-dsh';
let runtime: RuntimeClient | undefined;
/** Native session APIs project runtime-owned activity; no language-model loop or Webview. */
export function activate(context: vscode.ExtensionContext): void {
	const settings = vscode.workspace.getConfiguration('dshAdapter');
	const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (!cwd) { throw new Error(vscode.l10n.t('Open a trusted test folder before using DSH.')); }
	runtime = new RuntimeClient({ nodePath: settings.get('nodePath', ''), runtimeDirectory: settings.get('runtimeDirectory', ''), home: vscode.Uri.joinPath(context.globalStorageUri, 'runtime').fsPath, cwd, profile: settings.get('profile', 'sdk'), provider: settings.get('provider', 'deepseek-official'), model: settings.get('model', 'deepseek-v4-flash') }, update);
	const client = runtime;
	const controller = vscode.chat.createChatSessionItemController(sessionType, async () => {
		const items = await client.request<SessionItem[]>('list'); controller.items.replace(items.map(toItem));
	});
	context.subscriptions.push(controller);
	const toItem = (item: SessionItem) => {
		const result = controller.createChatSessionItem(vscode.Uri.from({ scheme: sessionType, path: '/' + item.id }), item.title);
		result.timing = { created: item.created }; result.status = item.status === 'running' ? vscode.ChatSessionStatus.InProgress : item.status === 'unknown' ? vscode.ChatSessionStatus.NeedsInput : vscode.ChatSessionStatus.Completed;
		return result;
	};
	function update(event: RuntimeEvent): void {
		const item = controller.items.get(vscode.Uri.from({ scheme: sessionType, path: '/' + event.id }));
		if (item && event.status) { item.status = event.status === 'running' ? vscode.ChatSessionStatus.InProgress : event.status === 'unknown' ? vscode.ChatSessionStatus.NeedsInput : vscode.ChatSessionStatus.Completed; controller.items.add(item); }
	}
	controller.newChatSessionItemHandler = async input => toItem(await client.request<SessionItem>('create', { title: input.request.prompt.slice(0, 100) }));
	const handler: vscode.ChatRequestHandler = async (request, chatContext, stream, token) => {
		const resource = chatContext.chatSessionContext?.chatSessionItem.resource;
		if (!resource || resource.scheme !== sessionType) { throw new Error('DSH_SESSION_CONTEXT_REQUIRED'); }
		if (token.isCancellationRequested) { throw new vscode.CancellationError(); }
		stream.progress(vscode.l10n.t('Running the original DSH profile. Per-session cancellation is not supported by this SDK version.'));
		// SDK has no per-session cancel RPC. Do not register a no-op cancellation handler.
		{
			const result = await client.request<{ text: string }>('send', { id: resource.path.slice(1), text: request.prompt });
			if (!token.isCancellationRequested) { stream.markdown(result.text); }
			return {};
		}
	};
	const participant = vscode.chat.createChatParticipant(sessionType, handler); context.subscriptions.push(participant);
	context.subscriptions.push(vscode.chat.registerChatSessionContentProvider(sessionType, {
		provideChatSessionContent: async resource => {
			const result = await client.request<{ history: { prompt: string; response: string }[]; incomplete: boolean }>('history', { id: resource.path.slice(1) });
			if (result.incomplete) { throw new Error(vscode.l10n.t('The previous DSH outcome is unknown. Inspect the native session log; this adapter will not replay it.')); }
			return { history: result.history.flatMap(turn => [new vscode.ChatRequestTurn2(turn.prompt, undefined, [], sessionType, [], undefined, undefined, undefined, undefined), new vscode.ChatResponseTurn2([new vscode.ChatResponseMarkdownPart(turn.response)], {}, sessionType)]), requestHandler: handler };
		}
	}, participant, { supportsInterruptions: false }));
}
export async function deactivate(): Promise<void> { await runtime?.close(); runtime = undefined; }
