/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { AhpTransport, JsonRpcMessage, TransportFrame } from '@microsoft/agent-host-protocol/client';

export type NativeFrame = { kind: 'frame'; generation: number; sequence: number; text: string } | { kind: 'closed' | 'fault'; generation: number; reason: string };
export interface NativeBridge {
	open(receive: (frame: NativeFrame) => void): Promise<number>;
	send(generation: number, text: string): Promise<void>;
	ack(generation: number, sequence: number): Promise<void>;
	close(generation: number): Promise<void>;
}

/** Bounded, generation-scoped transport; credentials remain behind the native bridge. */
export class TauriTransport implements AhpTransport {
	private generation = 0;
	private queue: Extract<NativeFrame, { kind: 'frame' }>[] = [];
	private bytes = 0;
	private waiter?: { resolve: (frame: TransportFrame | null) => void; reject: (error: Error) => void };
	private failure?: Error;
	private closed = false;
	private starting = true;
	private early: NativeFrame[] = [];
	private sending = 0;
	private constructor(private readonly bridge: NativeBridge, private readonly limit: number) {}

	static async connect(bridge: NativeBridge, limit = 128): Promise<TauriTransport> {
		const transport = new TauriTransport(bridge, limit);
		transport.generation = await bridge.open(frame => transport.receive(frame));
		transport.starting = false;
		if (transport.failure) { await bridge.close(transport.generation); throw transport.failure; }
		for (const frame of transport.early.splice(0)) { transport.receive(frame); }
		return transport;
	}

	private receive(frame: NativeFrame): void {
		if (this.starting) {
			if (this.early.length >= this.limit) { this.fail('BACKPRESSURE_RESYNC_REQUIRED'); } else { this.early.push(frame); }
			return;
		}
		if (this.closed || frame.generation !== this.generation) { return; }
		if (frame.kind !== 'frame') { this.fail(frame.reason); return; }
		const bytes = new TextEncoder().encode(frame.text).byteLength;
		if (bytes > 1048576 || this.queue.length >= this.limit || this.bytes + bytes > 8388608) { this.fail('BACKPRESSURE_RESYNC_REQUIRED'); return; }
		this.queue.push(frame); this.bytes += bytes;
		if (this.waiter) {
			const waiter = this.waiter; this.waiter = undefined;
			void this.recv().then(waiter.resolve, waiter.reject);
		}
	}

	private fail(reason: string): void {
		this.failure = new Error(reason); this.closed = true; this.queue = []; this.bytes = 0;
		this.waiter?.reject(this.failure); this.waiter = undefined;
		if (this.generation) { void this.bridge.close(this.generation).catch(() => {}); }
	}

	async send(message: JsonRpcMessage | string): Promise<void> {
		if (this.closed) { throw this.failure ?? new Error('TRANSPORT_CLOSED'); }
		const text = typeof message === 'string' ? message : JSON.stringify(message);
		if (new TextEncoder().encode(text).byteLength > 1048576 || this.sending >= 32) { this.fail('BACKPRESSURE_RESYNC_REQUIRED'); throw this.failure; }
		this.sending++;
		try { await this.bridge.send(this.generation, text); } catch { this.fail('SEND_OUTCOME_UNKNOWN'); throw this.failure; }
		finally { this.sending--; }
	}

	async recv(): Promise<TransportFrame | null> {
		if (this.failure) { throw this.failure; }
		const frame = this.queue.shift();
		if (frame) {
			this.bytes -= new TextEncoder().encode(frame.text).byteLength;
			try { await this.bridge.ack(this.generation, frame.sequence); } catch { this.fail('ACK_FAILED_RESYNC_REQUIRED'); throw this.failure; }
			return { kind: 'text', text: frame.text };
		}
		if (this.closed) { return null; }
		if (this.waiter) { throw new Error('CONCURRENT_RECEIVE'); }
		return new Promise((resolve, reject) => { this.waiter = { resolve, reject }; });
	}

	async close(): Promise<void> {
		if (this.closed) { return; }
		this.closed = true; this.queue = []; this.bytes = 0;
		this.waiter?.resolve(null); this.waiter = undefined;
		await this.bridge.close(this.generation);
	}
}
