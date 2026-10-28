/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { AhpClient, type AhpTransport } from '@microsoft/agent-host-protocol/client';
import { SessionStatus, ActionType, ChatInputResponseKind, ChatInputAnswerState, ChatInputAnswerValueKind, ToolCallConfirmationReason, ToolCallCancellationReason, MessageKind, SUPPORTED_PROTOCOL_VERSIONS, rootReducer, sessionReducer, chatReducer, type RootState, type SessionState, type SessionSummary, type ChatState, type RootAction, type SessionAction, type ChatAction, type StateAction, type ChatInputAnswer } from '@microsoft/agent-host-protocol';

export type ChannelKind = 'root' | 'session' | 'chat';
type State = RootState | SessionState | ChatState;

/** Projects exact subscribed resources through the official reducers, without URI derivation. */
export class AgentClient {
	private client?: AhpClient;
	private generation = 0;
	private channels = new Map<string, { kind: ChannelKind; state?: State; sequence: number; pending?: import('@microsoft/agent-host-protocol').ActionEnvelope[] }>();
	private listeners = new Set<() => void>();
	private events?: AsyncIterableIterator<import('@microsoft/agent-host-protocol/client').ClientEvent>;
	private states?: AsyncIterableIterator<import('@microsoft/agent-host-protocol/client').ConnectionState>;
	status: 'offline' | 'connecting' | 'ready' | 'resync-required' = 'offline';
	readonly clientId: string;
	sessions: readonly SessionSummary[] = [];
	constructor(clientId = crypto.randomUUID()) { this.clientId = clientId; }
	onChange(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
	private changed(): void { for (const listener of this.listeners) { listener(); } }
	get root(): RootState | undefined { return this.channels.get('ahp-root://')?.state as RootState | undefined; }
	getSession(uri: string): SessionState | undefined { return this.channels.get(uri)?.state as SessionState | undefined; }
	getChat(uri: string): ChatState | undefined { return this.channels.get(uri)?.state as ChatState | undefined; }

	async connect(transport: AhpTransport): Promise<void> {
		await this.disconnect();
		const generation = ++this.generation;
		this.status = 'connecting'; this.changed();
		const client = this.client = new AhpClient(transport, { requestTimeoutMs: 15000, subscriptionBuffer: 256 });
		const events = this.events = client.events();
		const states = this.states = client.stateChanges();
		void (async () => { for await (const event of events) {
			if (generation !== this.generation) { break; }
			if (event.event.type === 'action') {
				const entry = this.channels.get(event.channel); const envelope = event.event.params;
				if (entry?.pending) {
					if (entry.pending.length >= 256) { this.invalidate(); void client.shutdown(); }
					else { entry.pending.push(envelope); }
				} else if (entry) { this.apply(entry, envelope); }
			} else if (['sessionAdded', 'sessionRemoved', 'sessionSummaryChanged'].includes(event.event.type)) {
				void this.refreshSessions().catch(() => this.invalidate());
			} else if (event.event.type === 'authRequired') { this.changed(); }
		} })().catch(() => this.invalidate());
		void (async () => { for await (const state of states) {
			if (generation !== this.generation) { break; }
			if (state.status === 'closed' && this.status !== 'offline') { this.invalidate(); }
		} })();
		client.connect();
		try {
			const result = await client.initialize({ clientId: this.clientId, protocolVersions: SUPPORTED_PROTOCOL_VERSIONS });
			if (!SUPPORTED_PROTOCOL_VERSIONS.includes(result.protocolVersion)) { throw new Error('UNSUPPORTED_PROTOCOL'); }
			await this.subscribe('ahp-root://', 'root');
			for (const [uri, entry] of this.channels) { if (entry.kind !== 'root') { await this.subscribe(uri, entry.kind); } }
			await this.refreshSessions();
			if (generation === this.generation) { this.status = 'ready'; this.changed(); }
		} catch (error) { this.invalidate(); await client.shutdown(); throw error; }
	}

	private apply(entry: { kind: ChannelKind; state?: State; sequence: number }, envelope: import('@microsoft/agent-host-protocol').ActionEnvelope): void {
		if (!entry.state || envelope.serverSeq <= entry.sequence) { return; }
		entry.sequence = envelope.serverSeq;
		if (entry.kind === 'root') { entry.state = rootReducer(entry.state as RootState, envelope.action as RootAction); }
		else if (entry.kind === 'session') { entry.state = sessionReducer(entry.state as SessionState, envelope.action as SessionAction); }
		else { entry.state = chatReducer(entry.state as ChatState, envelope.action as ChatAction); }
		this.changed();
	}
	private invalidate(): void { this.status = 'resync-required'; this.changed(); }
	async subscribe(uri: string, kind: ChannelKind): Promise<void> {
		const client = this.client; if (!client) { throw new Error('NOT_CONNECTED'); }
		const prior = this.channels.get(uri);
		const entry = { kind, state: prior?.state, sequence: prior?.sequence ?? -1, pending: [] as import('@microsoft/agent-host-protocol').ActionEnvelope[] | undefined };
		this.channels.set(uri, entry);
		const { result, subscription } = await client.subscribe(uri);
		await subscription.close();
		if (!result.snapshot) { throw new Error('SNAPSHOT_REQUIRED'); }
		entry.state = result.snapshot.state as State; entry.sequence = result.snapshot.fromSeq;
		const pending = entry.pending; entry.pending = undefined;
		for (const envelope of pending ?? []) { this.apply(entry, envelope); }
		this.changed();
	}

	async refreshSessions(): Promise<void> {
		const result = await this.client?.request('listSessions', { channel: 'ahp-root://' });
		if (result) { this.sessions = result.items; this.changed(); }
	}
	private ready(): AhpClient { if (!this.client || this.status !== 'ready') { throw new Error('RESYNC_REQUIRED'); } return this.client; }
	async createSession(provider: string, directory: string): Promise<string> {
		const client = this.ready(); const uri = `ahp-session:/${crypto.randomUUID()}`;
		await client.request('createSession', { channel: uri, provider, workingDirectories: [directory], config: { isolation: 'folder' } });
		await this.subscribe(uri, 'session'); await this.refreshSessions(); return uri;
	}
	async selectSession(uri: string): Promise<string> {
		await this.subscribe(uri, 'session');
		const chat = this.getSession(uri)?.defaultChat;
		if (!chat) { throw new Error('DEFAULT_CHAT_UNAVAILABLE'); }
		await this.subscribe(chat, 'chat'); return chat;
	}
	hasActiveTurns(): boolean {
		return this.sessions.some(session => (session.status & SessionStatus.InProgress) !== 0)
			|| [...this.channels.values()].some(entry => entry.kind === 'chat' && !!(entry.state as ChatState | undefined)?.activeTurn);
	}
	send(chat: string, text: string): void {
		this.ready().dispatch(chat, { type: ActionType.ChatTurnStarted, turnId: crypto.randomUUID(), startedAt: new Date().toISOString(), message: { text, origin: { kind: MessageKind.User } } });
	}
	cancel(chat: string, turnId: string): void { this.ready().dispatch(chat, { type: ActionType.ChatTurnCancelled, turnId, duration: 0 }); }
	answer(chat: string, requestId: string, response: ChatInputResponseKind, answers?: Record<string, ChatInputAnswer>): void { this.ready().dispatch(chat, { type: ActionType.ChatInputCompleted, requestId, response, ...(answers ? { answers } : {}) }); }
	acceptInput(chat: string, requestId: string, accepted: boolean): void { this.answer(chat, requestId, accepted ? ChatInputResponseKind.Accept : ChatInputResponseKind.Decline); }
	answerText(chat: string, requestId: string, values: Record<string, string>): void {
		const answers: Record<string, ChatInputAnswer> = {};
		for (const [key, value] of Object.entries(values)) { answers[key] = { state: ChatInputAnswerState.Submitted, value: { kind: ChatInputAnswerValueKind.Text, value } }; }
		this.answer(chat, requestId, ChatInputResponseKind.Accept, answers);
	}
	confirmTool(chat: string, turnId: string, toolCallId: string, approved: boolean): void {
		this.ready().dispatch(chat, approved ? { type: ActionType.ChatToolCallConfirmed, turnId, toolCallId, approved: true, confirmed: ToolCallConfirmationReason.UserAction } : { type: ActionType.ChatToolCallConfirmed, turnId, toolCallId, approved: false, reason: ToolCallCancellationReason.Denied });
	}
	dispatch(chat: string, action: StateAction): void { this.ready().dispatch(chat, action); }
	async disconnect(): Promise<void> {
		this.generation++; this.status = 'offline';
		const client = this.client; this.client = undefined; await client?.shutdown();
		await this.events?.return?.(); await this.states?.return?.(); this.changed();
	}
}
