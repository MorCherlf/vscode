/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DisposableStore } from '../../../src/vs/base/common/lifecycle.js';
import { URI } from '../../../src/vs/base/common/uri.js';
import { NativeEnvironmentService } from '../../../src/vs/platform/environment/node/environmentService.js';
import { IFileService } from '../../../src/vs/platform/files/common/files.js';
import { LogService } from '../../../src/vs/platform/log/common/logService.js';
import { OtlpEmitterLogger, OtlpLogEmitter } from '../../../src/vs/platform/agentHost/common/otlp/otlpLogEmitter.js';
import product from '../../../src/vs/platform/product/common/product.js';
import { createAgentHostRuntime, type IAgentHostRuntime } from '../../../src/vs/platform/agentHost/node/agentHostBootstrap.js';
import { AgentHostLaunchKind } from '../../../src/vs/platform/agentHost/common/agentHostTelemetry.js';
import { IAgentHostStateManager } from '../../../src/vs/platform/agentHost/node/agentHostStateManager.js';
import { IAgentHostCompletions } from '../../../src/vs/platform/agentHost/node/agentHostCompletions.js';
import { IAgentHostCustomizationEnablementService } from '../../../src/vs/platform/agentHost/node/agentHostCustomizationEnablementService.js';
import { ISessionDataService } from '../../../src/vs/platform/agentHost/common/sessionDataService.js';
import { AgentHostClientFileSystemProvider } from '../../../src/vs/platform/agentHost/common/agentHostClientFileSystemProvider.js';
import { AGENT_CLIENT_SCHEME } from '../../../src/vs/platform/agentHost/common/agentClientUri.js';
import { BANG_COMMAND_PREFIX } from '../../../src/vs/platform/agentHost/node/agentHostBangCommand.js';
import { ProtocolServerHandler } from '../../../src/vs/platform/agentHost/node/protocolServerHandler.js';
import { WebSocketProtocolServer } from '../../../src/vs/platform/agentHost/node/webSocketTransport.js';
import { AgentModelRefreshScheduler, MODEL_REFRESH_INTERVAL_MS } from '../../../src/vs/platform/agentHost/node/agentModelRefreshScheduler.js';
import { shutdownAgentHostBeforeDispose } from '../../../src/vs/platform/agentHost/node/agentHostShutdown.js';

export interface HostSettings { readonly userData: string; readonly token: string; readonly tokenFile: string; readonly port: number; readonly shutdownTimeout: number; }

/** Starts the upstream runtime with entry-owned providers and transport. */
export async function runHost(registerProviders: (runtime: IAgentHostRuntime) => void, settings: HostSettings): Promise<void> {
	const owned = new DisposableStore();
	try {
		const emitter = owned.add(new OtlpLogEmitter());
		const logger = owned.add(new OtlpEmitterLogger(emitter));
		const logService = owned.add(new LogService(logger));
		const environmentService = new NativeEnvironmentService({ _: [], 'user-data-dir': settings.userData }, { _serviceBrand: undefined, ...product });
		const runtime = owned.add(await createAgentHostRuntime({
			environmentService, productService: { _serviceBrand: undefined, ...product }, logService,
			loggerService: undefined, disableTelemetry: true, transientProxyConfiguration: false,
			hostLaunchKind: AgentHostLaunchKind.VSCodeCLI, providerConfigurations: [], byok: { kind: 'unavailable' },
		}));
		registerProviders(runtime);
		owned.add(runtime.instantiationService.createInstance(AgentModelRefreshScheduler, runtime.agents, runtime.onDidStartTurn, MODEL_REFRESH_INTERVAL_MS));
		const services = runtime.instantiationService.invokeFunction(accessor => ({
			file: accessor.get(IFileService), state: accessor.get(IAgentHostStateManager),
			completions: accessor.get(IAgentHostCompletions), sessions: accessor.get(ISessionDataService),
			enablement: accessor.get(IAgentHostCustomizationEnablementService),
		}));
		const server = owned.add(await WebSocketProtocolServer.create({
			host: '127.0.0.1', port: settings.port, connectionTokenValidate: token => token === settings.token,
		}, logService));
		const clientFileSystem = owned.add(new AgentHostClientFileSystemProvider());
		owned.add(services.file.registerProvider(AGENT_CLIENT_SCHEME, clientFileSystem));
		const protocol = owned.add(runtime.instantiationService.createInstance(ProtocolServerHandler,
			runtime.agentService, services.state, server, {
				hostLaunchKind: AgentHostLaunchKind.VSCodeCLI, defaultDirectory: URI.file(settings.userData).toString(),
				completionTriggerCharacters: services.completions.triggerCharacters, terminalCommandPrefix: BANG_COMMAND_PREFIX,
				otlpLogEmitter: emitter,
			}, clientFileSystem));
		let stopping = false;
		const stop = async () => {
			if (stopping) { return; }
			stopping = true;
			protocol.dispose();
			server.dispose();
			await shutdownAgentHostBeforeDispose(() => protocol.whenIdle(), () => runtime.agentService.shutdown(),
				() => [services.sessions.whenIdle(), services.enablement.whenIdle()], settings.shutdownTimeout, logService);
			owned.dispose();
			process.exit(0);
		};
		process.stdin.resume();
		process.stdin.once('end', () => { void stop(); });
		process.once('SIGINT', () => { void stop(); });
		process.once('SIGTERM', () => { void stop(); });
		await server.whenListening;
		runtime.agentService.markStartupComplete();
		process.stdout.write(JSON.stringify({ type: 'ready', host: '127.0.0.1', port: server.boundPort, pid: process.pid, tokenFile: settings.tokenFile }) + '\n');
	} catch (error) {
		owned.dispose();
		throw error;
	}
}
