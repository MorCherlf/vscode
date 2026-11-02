/* Copyright (c) Microsoft Corporation. All rights reserved. */
/* Licensed under the MIT License. See LICENSE.txt in the project root for license information. */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/** Display projection only. DSH's profile and session log remain the runtime authority. */
export class RuntimeBridge {
	constructor(createHarness, notify) { this.createHarness = createHarness; this.notify = notify; this.sessions = new Map(); this.busy = new Set(); this.persistence = Promise.resolve(); }
	async initialize(config) {
		if (this.harness || this.initializing) { throw new Error('ALREADY_INITIALIZED'); }
		if (config.protocol !== 1 || !path.isAbsolute(config.home) || !path.isAbsolute(config.cwd) || config.version !== '0.2.2-alpha.2') { throw new Error('UNSUPPORTED_RUNTIME_CONFIGURATION'); }
		this.initializing = true;
		try {
		this.file = path.join(config.home, 'vscode-projection.json');
		try { const record = JSON.parse(await readFile(this.file, 'utf8')); for (const item of record) { this.sessions.set(item.id, { ...item, status: item.status === 'running' ? 'unknown' : item.status, restored: true }); } } catch (error) { if (error.code !== 'ENOENT') { throw new Error('PROJECTION_READ_FAILED'); } }
		this.harness = this.createHarness(config);
		// Initialization stays lazy: merely discovering this extension does not start the loop.
		return { protocol: 1, version: config.version, cancellation: false, history: 'verified-display-projection' };
		} finally { this.initializing = false; }
	}
	async persist() {
		const snapshot = JSON.stringify([...this.sessions.values()].map(({ restored, ...item }) => item));
		const pending = this.persistence.then(async () => {
			await mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 });
			await writeFile(this.file + '.tmp', snapshot, { mode: 0o600 });
			await rename(this.file + '.tmp', this.file);
		});
		this.persistence = pending.catch(() => {});
		return pending;
	}
	async request(method, params = {}) {
		if (method === 'initialize') { return this.initialize(params); }
		if (!this.harness) { throw new Error('NOT_INITIALIZED'); }
		if (method === 'list') { return [...this.sessions.values()].map(({ history, restored, ...item }) => item); }
		if (method === 'create') {
			const item = { id: randomUUID(), title: String(params.title || 'DSH'), created: Date.now(), status: 'new', history: [] };
			this.sessions.set(item.id, item); await this.persist(); return item;
		}
		if (method === 'shutdown') { await this.harness.close(); return {}; }
		const item = this.sessions.get(params.id); if (!item) { throw new Error('SESSION_NOT_FOUND'); }
		if (method === 'cancel') { throw new Error('SESSION_CANCEL_UNSUPPORTED'); }
		if (method === 'history') {
			if (item.restored && item.history.length) { await this.harness.start(); await this.harness.client.request('session/resume', { sessionId: item.id }); item.restored = false; }
			return { history: item.history, incomplete: item.status === 'unknown' || item.status === 'running' };
		}
		if (method !== 'send') { throw new Error('METHOD_UNSUPPORTED'); }
		if (this.busy.has(item.id) || item.status === 'unknown') { throw new Error('SESSION_BUSY_OR_OUTCOME_UNKNOWN'); }
		if (typeof params.text !== 'string' || !params.text.trim() || params.text.length > 131072) { throw new Error('INVALID_PROMPT'); }
		this.busy.add(item.id); item.status = 'running';
		try {
			if (item.restored && item.history.length) { await this.harness.start(); await this.harness.client.request('session/resume', { sessionId: item.id }); item.restored = false; }
			await this.persist(); this.notify({ id: item.id, status: item.status });
			const result = await this.harness.run(params.text, { sessionId: item.id, onNotification: notification => { if (notification.method === 'session.status') { this.notify({ id: item.id, runtimeStatus: notification.params.status }); } } });
			item.history.push({ prompt: params.text, response: result.finalResponse }); item.status = 'completed'; await this.persist();
			this.notify({ id: item.id, status: item.status }); return { text: result.finalResponse };
		} catch { item.status = 'unknown'; await this.persist(); this.notify({ id: item.id, status: 'unknown' }); throw new Error('SEND_OUTCOME_UNKNOWN'); }
		finally { this.busy.delete(item.id); }
	}
}
