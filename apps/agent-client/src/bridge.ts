/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Channel, invoke } from '@tauri-apps/api/core';
import type { NativeBridge, NativeFrame } from '@morcherlf/agent-client-core';

export function nativeBridge(): NativeBridge {
	let channel: Channel<NativeFrame>;
	return {
		open: async receive => { channel = new Channel<NativeFrame>(); channel.onmessage = receive; return invoke<number>('host_connect', { events: channel }); },
		send: async (generation, text) => invoke('host_send', { generation, text }),
		ack: async (generation, sequence) => invoke('host_ack', { generation, sequence }),
		close: async generation => invoke('host_disconnect', { generation }),
	};
}
