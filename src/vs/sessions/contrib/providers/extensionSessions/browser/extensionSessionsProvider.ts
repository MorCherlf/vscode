/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { constObservable, observableValue } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { localize } from '../../../../../nls.js';
import { IChatService } from '../../../../../workbench/contrib/chat/common/chatService/chatService.js';
import { ChatSessionStatus, IChatSessionItem, IChatSessionsService } from '../../../../../workbench/contrib/chat/common/chatSessionsService.js';
import { ChatAgentLocation } from '../../../../../workbench/contrib/chat/common/constants.js';
import { getNewChatSessionResource } from '../../../../../workbench/contrib/chat/common/model/chatUri.js';
import { ChatInteractivity, IChat, ISession, ISessionType, SessionStatus, SessionTypeAuthRequirement, toSessionId } from '../../../../services/sessions/common/session.js';
import { ISessionsProvider, ISessionChangeEvent, SessionMoveRefusedError } from '../../../../services/sessions/common/sessionsProvider.js';

/** One stable facade over an extension-owned session; the original chat service owns history. */
class ExtensionSession {
	readonly title = observableValue(this, '');
	readonly status = observableValue(this, SessionStatus.Untitled);
	readonly updatedAt = observableValue(this, new Date());
	readonly isArchived = observableValue(this, false);
	readonly isRead = observableValue(this, true);
	readonly createdAt: Date;
	readonly sessionId: string;
	readonly providerId = 'extensionSessions';
	readonly harness: string;
	readonly environment = 'local';
	readonly application = constObservable({ id: 'vscode', label: 'VS Code' });
	readonly icon = Codicon.extensions;
	readonly workspace = constObservable(undefined);
	readonly isQuickChat = constObservable(true);
	readonly modelId = constObservable(undefined);
	readonly mode = constObservable(undefined);
	readonly loading = constObservable(false);
	readonly description = constObservable(undefined);
	readonly lastTurnEnd = constObservable(undefined);
	readonly capabilities = constObservable({ supportsMultipleChats: false });
	readonly mainChat;
	readonly chats;
	constructor(readonly resource: URI, readonly sessionType: string, item?: IChatSessionItem) {
		this.createdAt = new Date(item?.timing.created ?? Date.now());
		this.sessionId = toSessionId(this.providerId, resource); this.harness = sessionType;
		const chat: IChat = { resource, createdAt: this.createdAt, workspace: this.workspace, title: this.title, updatedAt: this.updatedAt, status: this.status, changes: constObservable([]), changesets: constObservable([]), checkpoints: constObservable(undefined), modelId: this.modelId, modelSource: constObservable(undefined), mode: this.mode, isArchived: this.isArchived, isRead: this.isRead, interactivity: constObservable(ChatInteractivity.Full), description: this.description, lastTurnEnd: this.lastTurnEnd };
		this.mainChat = constObservable(chat); this.chats = constObservable([chat]);
		if (item) { this.update(item); }
	}
	update(item: IChatSessionItem): void {
		this.title.set(item.label, undefined); this.isArchived.set(item.archived ?? false, undefined); this.isRead.set(item.isRead ?? true, undefined);
		this.updatedAt.set(new Date(item.timing.lastRequestEnded ?? item.timing.lastRequestStarted ?? item.timing.created), undefined);
		this.status.set(item.status === ChatSessionStatus.InProgress ? SessionStatus.InProgress : item.status === ChatSessionStatus.NeedsInput ? SessionStatus.NeedsInput : item.status === ChatSessionStatus.Failed ? SessionStatus.Error : SessionStatus.Completed, undefined);
	}
}

/** Product-curated extension sessions, routed through the original workbench/Extension Host APIs. */
export class ExtensionSessionsProvider extends Disposable implements ISessionsProvider {
	readonly id = 'extensionSessions';
	readonly label = localize('extensionSessions', "Extension Sessions");
	readonly icon = Codicon.extensions;
	readonly order = 20;
	readonly environment = { id: 'local', label: localize('extensionSessions.local', "Local") };
	readonly supportsWorkspaceSelection = false;
	readonly supportsLocalWorkspaces = false;
	readonly supportsQuickChats = true;
	readonly browseActions = [];
	readonly onDidMoveChat = Event.None;
	readonly onDidChangeModels = Event.None;
	private readonly changedTypes = this._register(new Emitter<void>());
	readonly onDidChangeSessionTypes = this.changedTypes.event;
	private readonly changed = this._register(new Emitter<ISessionChangeEvent>());
	readonly onDidChangeSessions = this.changed.event;
	private readonly sessions = new Map<string, ExtensionSession>();
	private readonly drafts = new Map<string, ExtensionSession>();
	private readonly materialized = new Map<string, Promise<ExtensionSession>>();
	private readonly allowed: ReadonlySet<string>;
	constructor(
		@IProductService product: IProductService,
		@IChatSessionsService private readonly chatSessions: IChatSessionsService,
		@IChatService private readonly chatService: IChatService,
	) {
		super(); this.allowed = new Set(product.agentFirstSessionTypes ?? []);
		this._register(chatSessions.onDidChangeItemsProviders(() => { this.changedTypes.fire(); void this.refresh(); }));
		this._register(chatSessions.onDidChangeAvailability(() => this.changedTypes.fire()));
		this._register(chatSessions.onDidChangeSessionItems(delta => {
			for (const item of delta.addedOrUpdated ?? []) { if (this.allowed.has(item.resource.scheme)) { this.publish(item); } }
			for (const uri of delta.removed ?? []) { const item = this.sessions.get(uri.toString()); if (item) { this.sessions.delete(uri.toString()); this.changed.fire({ added: [], removed: [item], changed: [] }); } }
		}));
	}
	get sessionTypes(): readonly ISessionType[] {
		return this.chatSessions.getAllChatSessionContributions().filter(type => this.allowed.has(type.type) && !type.agentHostProviderId).map(type => ({ id: type.type, label: type.displayName, icon: Codicon.extensions, authRequirement: SessionTypeAuthRequirement.None }));
	}
	private publish(item: IChatSessionItem): ExtensionSession {
		let session = this.sessions.get(item.resource.toString()); const added = !session;
		if (!session) { session = new ExtensionSession(item.resource, item.resource.scheme, item); this.sessions.set(item.resource.toString(), session); } else { session.update(item); }
		this.changed.fire({ added: added ? [session] : [], removed: [], changed: added ? [] : [session] }); return session;
	}
	async refresh(): Promise<void> {
		for await (const group of this.chatSessions.getChatSessionItems([...this.allowed], CancellationToken.None)) { for (const item of group.items) { this.publish(item); } }
	}
	getSessions(): ISession[] { return [...this.sessions.values()]; }
	getSessionTypes(): ISessionType[] { return [...this.sessionTypes]; }
	resolveWorkspace(): undefined { return undefined; }
	createNewSession(): never { throw new Error('EXTENSION_SESSION_REQUIRES_OWN_WORKSPACE_CONTEXT'); }
	createQuickChat(type: string): ISession {
		if (!this.sessionTypes.some(item => item.id === type)) { throw new Error('EXTENSION_SESSION_TYPE_UNAVAILABLE'); }
		const session = new ExtensionSession(getNewChatSessionResource(type), type); this.drafts.set(session.sessionId, session); return session;
	}
	deleteNewSession(id: string): void { this.drafts.delete(id); }
	async createNewChat(id: string, prompt?: string): Promise<IChat> {
		const draft = this.drafts.get(id); if (!draft) { throw new Error('MULTIPLE_CHATS_UNSUPPORTED'); }
		let pending = this.materialized.get(id);
		if (!pending) {
			pending = (async () => {
				const item = await this.chatSessions.createNewChatSessionItem(draft.sessionType, { prompt: prompt ?? '', untitledResource: draft.resource }, CancellationToken.None);
				if (!item || item.resource.scheme !== draft.sessionType) { throw new Error('EXTENSION_SESSION_CREATION_FAILED'); }
				return this.publish(item);
			})(); this.materialized.set(id, pending);
		}
		return (await pending).mainChat.get();
	}
	async sendRequest(id: string, chat: URI, options: Parameters<ISessionsProvider['sendRequest']>[2]): Promise<ISession> {
		const session = this.sessions.get(chat.toString());
		if (!session || (id !== session.sessionId && !this.drafts.has(id))) { throw new Error('EXTENSION_SESSION_ROUTE_MISMATCH'); }
		const reference = await this.chatService.acquireOrLoadSession(chat, ChatAgentLocation.Chat, CancellationToken.None);
		if (!reference) { throw new Error('EXTENSION_SESSION_CONTENT_UNAVAILABLE'); }
		try {
			const result = await this.chatService.sendRequest(chat, options.query, { location: ChatAgentLocation.Chat, agentIdSilent: session.sessionType, attachedContext: options.attachedContext, onDidCreateResponse: options.onDidCreateResponse });
			if (result.kind === 'rejected') { throw new Error('EXTENSION_SESSION_REQUEST_REJECTED'); }
			this.drafts.delete(id); this.materialized.delete(id);
			if (result.kind === 'sent') { void result.data.responseCompletePromise.finally(() => reference.dispose()); } else { reference.dispose(); }
			return session;
		} catch (error) { reference.dispose(); throw error; }
	}
	getModelsSnapshot(): ReturnType<ISessionsProvider['getModelsSnapshot']> { return { models: [], desiredModelResolution: { kind: 'notRequested' }, modelTarget: undefined }; }
	getModelPickerOptions(): ReturnType<ISessionsProvider['getModelPickerOptions']> { return { showUnavailableFeatured: false, showManageModelsAction: false, showAutoModel: false }; }
	canMoveChat(): boolean { return false; }
	canMoveSessionUnder(): boolean { return false; }
	async moveChat(): Promise<never> { throw new SessionMoveRefusedError('Extension sessions do not support moving chats'); }
	async moveSessionUnder(): Promise<never> { throw new SessionMoveRefusedError('Extension sessions do not support moving sessions'); }
	async renameChat(): Promise<never> { throw new Error('RENAME_UNSUPPORTED'); }
	async renameSession(): Promise<never> { throw new Error('RENAME_UNSUPPORTED'); }
	setModel(): never { throw new Error('MODEL_SELECTION_OWNED_BY_EXTENSION_PROFILE'); }
	async archiveSession(): Promise<never> { throw new Error('ARCHIVE_UNSUPPORTED'); }
	async unarchiveSession(): Promise<never> { throw new Error('ARCHIVE_UNSUPPORTED'); }
	async setSessionReadState(id: string, read: boolean): Promise<void> { const session = [...this.sessions.values()].find(item => item.sessionId === id); if (!session || !this.chatSessions.canSetChatSessionItemRead(session.resource)) { throw new Error('READ_STATE_UNSUPPORTED'); } this.chatSessions.setChatSessionItemRead(session.resource, read); }
	async deleteSession(): Promise<never> { throw new Error('DELETE_UNSUPPORTED'); }
	async deleteSessions(): Promise<never> { throw new Error('DELETE_UNSUPPORTED'); }
	async deleteChat(): Promise<never> { throw new Error('DELETE_UNSUPPORTED'); }
	getNestedChatWorkspaceSupport(): undefined { return undefined; }
	async resolveNestedChatFolder(): Promise<never> { throw new Error('NESTED_WORKSPACE_UNSUPPORTED'); }
	async getNestedChatBranches(): Promise<never> { throw new Error('NESTED_WORKSPACE_UNSUPPORTED'); }
	async applyNestedChatWorkspace(): Promise<never> { throw new Error('NESTED_WORKSPACE_UNSUPPORTED'); }
	async forkChat(): Promise<never> { throw new Error('FORK_UNSUPPORTED'); }
	async createSideChat(): Promise<never> { throw new Error('SIDE_CHAT_UNSUPPORTED'); }
}
