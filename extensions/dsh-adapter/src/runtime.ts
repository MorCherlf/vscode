/* Copyright (c) Microsoft Corporation. All rights reserved. */
/* Licensed under the MIT License. See LICENSE.txt in the project root for license information. */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { isAbsolute, join } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
export interface SessionItem { id: string; title: string; created: number; status: 'new' | 'running' | 'completed' | 'unknown' }
export interface RuntimeEvent { id: string; status?: SessionItem['status']; runtimeStatus?: string }
export interface RuntimeConfig { nodePath: string; runtimeDirectory: string; home: string; cwd: string; profile: string; provider: string; model: string }
/** Owns only its child; no automatic replay after an unknown request outcome. */
export class RuntimeClient {
	private child?: ChildProcessWithoutNullStreams;
	private opening?: Promise<void>;
	private sequence = 0;
	private closed = false;
	private pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
	constructor(private readonly config: RuntimeConfig, private readonly changed: (event: RuntimeEvent) => void) { }
	private start(): Promise<void> {
		return this.opening ??= (async () => {
			if (this.closed || !isAbsolute(this.config.nodePath) || !isAbsolute(this.config.runtimeDirectory)) { throw new Error('DSH_RUNTIME_NOT_CONFIGURED'); }
			const env: NodeJS.ProcessEnv = { ...process.env, HOME: this.config.home, DSH_HOME: this.config.home };
			for (const name of ['GITHUB_TOKEN', 'GH_TOKEN', 'COPILOT_GITHUB_TOKEN', 'GITHUB_COPILOT_GITHUB_TOKEN', 'ELECTRON_RUN_AS_NODE', 'VSCODE_DEV']) { delete env[name]; }
			const child = this.child = spawn(this.config.nodePath, [join(this.config.runtimeDirectory, 'src', 'worker.mjs')], { cwd: this.config.cwd, env, stdio: 'pipe' });
			// Runtime stderr may include private data; never forward it to UI/output/evidence.
			child.stderr.resume(); let buffer = ''; const decoder = new StringDecoder('utf8');
			child.stdout.on('data', (data: Buffer) => {
				buffer += decoder.write(data);
				if (Buffer.byteLength(buffer) > 1024 * 1024) { this.fail('DSH_BACKPRESSURE_OUTCOME_UNKNOWN'); child.kill(); return; }
				for (;;) {
					const end = buffer.indexOf('\n'); if (end < 0) { break; }
					const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
					try {
						const frame = JSON.parse(line) as { id?: number; result?: unknown; error?: string; event?: RuntimeEvent };
						if (frame.event) { this.changed(frame.event); continue; }
						if (frame.id === undefined) { throw new Error(); }
						const request = this.pending.get(frame.id); this.pending.delete(frame.id);
						if (frame.error) { request?.reject(new Error(frame.error.match(/^[A-Z_]+$/) ? frame.error : 'DSH_REQUEST_FAILED')); } else { request?.resolve(frame.result); }
					} catch { this.fail('DSH_PROTOCOL_FAILED'); child.kill(); }
				}
			});
			child.on('error', () => this.fail('DSH_SPAWN_FAILED'));
			child.on('exit', () => { this.closed = true; this.fail('DSH_PROCESS_EXITED_OUTCOME_UNKNOWN'); });
			await this.call('initialize', { ...this.config, version: '0.2.2-alpha.2', protocol: 1 });
		})();
	}
	private fail(code: string): void { for (const request of this.pending.values()) { request.reject(new Error(code)); } this.pending.clear(); }
	private call<T>(method: string, params: object): Promise<T> {
		if (!this.child || this.closed || this.pending.size >= 16) { return Promise.reject(new Error('DSH_UNAVAILABLE_OR_QUEUE_FULL')); }
		const id = ++this.sequence; const text = JSON.stringify({ id, method, params }) + '\n';
		if (Buffer.byteLength(text) > 262144) { return Promise.reject(new Error('DSH_FRAME_TOO_LARGE')); }
		return new Promise<T>((resolve, reject) => {
			const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('DSH_REQUEST_TIMEOUT_OUTCOME_UNKNOWN')); }, method === 'send' ? 120000 : 15000);
			this.pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value as T); }, reject: error => { clearTimeout(timer); reject(error); } });
			this.child!.stdin.write(text, error => { if (error) { this.pending.get(id)?.reject(new Error('DSH_SEND_OUTCOME_UNKNOWN')); this.pending.delete(id); } });
		});
	}
	async request<T>(method: string, params: object = {}): Promise<T> { await this.start(); return this.call<T>(method, params); }
	async close(): Promise<void> {
		if (!this.child || this.child.exitCode !== null) { this.closed = true; return; }
		const child = this.child;
		const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
		try { await this.call('shutdown', {}); } catch { /* Teardown still closes stdin. */ }
		child.stdin.end();
		const term = setTimeout(() => child.kill('SIGTERM'), 6500); const kill = setTimeout(() => child.kill('SIGKILL'), 9500);
		await exited; clearTimeout(term); clearTimeout(kill); this.closed = true;
	}
}
