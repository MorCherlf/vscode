/* Copyright (c) Microsoft Corporation. All rights reserved. */
/* Licensed under the MIT License. See LICENSE.txt in the project root for license information. */
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { TauriTransport } from '@morcherlf/agent-client-core';
import { nativeBridge } from './bridge';

/** Native lifecycle and transport boundary; views hold no native credentials. */
export interface ClientRuntime {
	available: boolean;
	connect(): Promise<TauriTransport>;
	onQuit(listener: () => void): Promise<() => void>;
	quit(): Promise<void>;
}

export const desktopRuntime: ClientRuntime = {
	available: isTauri(),
	connect: () => TauriTransport.connect(nativeBridge()),
	onQuit: listener => listen('quit-requested', listener),
	quit: () => invoke('host_quit'),
};
