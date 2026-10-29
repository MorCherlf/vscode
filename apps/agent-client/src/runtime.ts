/* Copyright (c) Microsoft Corporation. All rights reserved. */
/* Licensed under the MIT License. See LICENSE.txt in the project root for license information. */
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { TauriTransport } from '@morcherlf/agent-client-core';
import { nativeBridge } from './bridge';

export type AccountPhase = 'unconfigured' | 'signed-out' | 'authorizing' | 'signed-in' | 'expired' | 'denied' | 'locked' | 'unavailable' | 'failed';
export interface AccountView { phase: AccountPhase; userCode?: string; verificationUri?: string; expiresAt?: number }
export type AccountAction = 'status' | 'login' | 'cancel' | 'logout' | 'poll';
/** Native lifecycle and transport boundary; views hold no native credentials. */
export interface ClientRuntime {
	available: boolean;
	account?(action: AccountAction): Promise<AccountView>;
	openAccount?(): Promise<void>;
	openInputUrl?(url: string): Promise<void>;
	connect(): Promise<TauriTransport>;
	onQuit(listener: () => void): Promise<() => void>;
	quit(): Promise<void>;
}

export const desktopRuntime: ClientRuntime = {
	available: isTauri(),
	account: action => invoke('account_action', { action }),
	openAccount: () => invoke('account_open'),
	openInputUrl: url => invoke('input_open_url', { url }),
	connect: () => TauriTransport.connect(nativeBridge()),
	onQuit: listener => listen('quit-requested', listener),
	quit: () => invoke('host_quit'),
};
