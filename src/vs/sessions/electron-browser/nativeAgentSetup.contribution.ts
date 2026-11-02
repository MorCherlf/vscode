/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore } from '../../base/common/lifecycle.js';
import { URI } from '../../base/common/uri.js';
import { localize, localize2 } from '../../nls.js';
import { Action2, registerAction2 } from '../../platform/actions/common/actions.js';
import { IAgentHostService, AgentHostAllowSignedOutWhenUsableSettingId, AgentHostCodexAgentEnabledSettingId } from '../../platform/agentHost/common/agentService.js';
import { INativeAgentConfiguration, NativeAgentId, nativeAgentResource, nativeAgentSecretKey, parseNativeAgentConfiguration } from '../../platform/agentHost/common/nativeAgentConfiguration.js';
import { ConfigurationTarget, IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { IFileService } from '../../platform/files/common/files.js';
import { ServicesAccessor } from '../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../platform/notification/common/notification.js';
import { IQuickInputService } from '../../platform/quickinput/common/quickInput.js';
import { ISecretStorageService } from '../../platform/secrets/common/secrets.js';
import { IUserDataProfileService } from '../../workbench/services/userDataProfile/common/userDataProfile.js';
import { IFileDialogService } from '../../platform/dialogs/common/dialogs.js';
import { IPathService } from '../../workbench/services/path/common/pathService.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../workbench/common/contributions.js';
import { Menus } from '../browser/menus.js';

/** Replays only this product's own saved credentials to the original local authentication channel. */
class NativeAgentCredentialsContribution extends Disposable {
	static readonly ID = 'sessions.nativeAgentCredentials';
	private generation = 0;

	constructor(
		@IAgentHostService private readonly agentHostService: IAgentHostService,
		@ISecretStorageService private readonly secretStorageService: ISecretStorageService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super();
		const listeners = this._register(new DisposableStore());
		const bind = () => {
			listeners.clear();
			const generation = ++this.generation;
			const applied = new Set<NativeAgentId>();
			const replay = async () => {
				const state = this.agentHostService.rootState.value;
				if (!state || state instanceof Error) {
					return;
				}
				for (const agent of ['claude', 'codex'] as const) {
					if (applied.has(agent) || !state.agents.some(info => info.protectedResources?.some(resource => resource.resource === nativeAgentResource(agent)))) {
						continue;
					}
					applied.add(agent);
					try {
						const token = await this.secretStorageService.get(nativeAgentSecretKey(agent));
						if (generation !== this.generation || this._store.isDisposed) {
							return;
						}
						if (token) {
							const result = await this.agentHostService.authenticate({ resource: nativeAgentResource(agent), token });
							if (!result.authenticated) {
								throw new Error('Native configuration was not accepted');
							}
						}
					} catch {
						if (generation === this.generation && !this._store.isDisposed) {
							this.notificationService.error(localize('nativeAgent.restoreFailed', "Could not restore the {0} connection. Configure Local Agents to try again.", agent));
						}
					}
				}
			};
			listeners.add(this.agentHostService.rootState.onDidChange(() => { void replay(); }));
			void replay();
		};
		this._register(this.agentHostService.onAgentHostStart(bind));
		bind();
	}
}

registerWorkbenchContribution2(NativeAgentCredentialsContribution.ID, NativeAgentCredentialsContribution, WorkbenchPhase.AfterRestored);

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'sessions.configureNativeAgent',
			title: localize2('nativeAgent.configure', "Configure Local Agents..."),
			category: localize2('nativeAgent.category', "Agent"),
			f1: true,
			menu: { id: Menus.AccountMenu, group: '0_agents', order: 1 },
		});
	}

	async run(accessor: ServicesAccessor, requestedAgent?: NativeAgentId): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const secrets = accessor.get(ISecretStorageService);
		const files = accessor.get(IFileService);
		const profiles = accessor.get(IUserDataProfileService);
		const host = accessor.get(IAgentHostService);
		const configuration = accessor.get(IConfigurationService);
		const notifications = accessor.get(INotificationService);
		const fileDialogs = accessor.get(IFileDialogService);
		const paths = accessor.get(IPathService);
		const selected = requestedAgent === 'claude' || requestedAgent === 'codex'
			? { label: requestedAgent === 'claude' ? 'Claude Code' : 'Codex', agent: requestedAgent }
			: await quickInput.pick([
			{ label: 'Claude Code', agent: 'claude' as const },
			{ label: 'Codex', agent: 'codex' as const },
		], { title: localize('nativeAgent.select', "Configure Local Agent"), placeHolder: localize('nativeAgent.chooseAgent', "Choose the agent to configure") });
		if (!selected) {
			return;
		}
		const agent = selected.agent;
		const key = nativeAgentSecretKey(agent);
		let previous: INativeAgentConfiguration | undefined;
		try {
			previous = parseNativeAgentConfiguration(await secrets.get(key) ?? '');
		} catch { /* Replace an obsolete saved configuration through this flow. */ }
		const mode = await quickInput.pick([
			{ label: localize('nativeAgent.apiKey', "API Key"), mode: 'apiKey' as const, description: localize('nativeAgent.apiKeyDescription', "Official API or a compatible endpoint") },
			{ label: localize('nativeAgent.local', "Use Local Agent Configuration"), mode: 'local' as const, description: localize('nativeAgent.localDescription', "Let the agent read its own existing account and configuration") },
			{ label: localize('nativeAgent.remove', "Remove Saved Connection"), mode: 'remove' as const },
		], { title: selected.label, placeHolder: localize('nativeAgent.chooseAuth', "Choose how this agent connects") });
		if (!mode) {
			return;
		}
		let token: string | undefined;
		if (mode.mode !== 'remove') {
			const home = await paths.userHome();
			const candidates = [URI.joinPath(home, '.local', 'bin', agent), URI.joinPath(home, 'bin', agent), URI.file(`/opt/homebrew/bin/${agent}`), URI.file(`/usr/local/bin/${agent}`)];
			const installed = (await Promise.all(candidates.map(async uri => await files.exists(uri) ? uri : undefined))).filter((uri): uri is URI => uri !== undefined);
			const runtime = await quickInput.pick([
				{ label: localize('nativeAgent.bundled', "Use Bundled Runtime"), path: undefined, browse: false },
				...installed.map(uri => ({ label: localize('nativeAgent.installed', "Use Installed {0}", selected.label), description: uri.fsPath, path: uri.fsPath, browse: false })),
				{ label: localize('nativeAgent.browse', "Choose Agent Executable..."), path: undefined, browse: true },
			], { title: selected.label, placeHolder: localize('nativeAgent.chooseRuntime', "Choose the local runtime") });
			if (!runtime) {
				return;
			}
			let executable = runtime.path;
			if (runtime.browse) {
				const picked = await fileDialogs.showOpenDialog({ title: localize('nativeAgent.executable', "Choose Agent Executable"), canSelectFiles: true, canSelectFolders: false, canSelectMany: false });
				if (!picked?.[0]) {
					return;
				}
				executable = picked[0].fsPath;
			}
			if (mode.mode === 'local') {
				token = JSON.stringify({ mode: 'local', executable } satisfies INativeAgentConfiguration);
			} else {
				const baseUrl = await quickInput.input({ title: selected.label, prompt: agent === 'claude' ? localize('nativeAgent.anthropicEndpoint', "Anthropic Messages API base URL") : localize('nativeAgent.responsesEndpoint', "OpenAI Responses API base URL"), value: previous?.baseUrl ?? (agent === 'claude' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1'), ignoreFocusLost: true });
				if (baseUrl === undefined) {
					return;
				}
				const model = await quickInput.input({ title: selected.label, prompt: localize('nativeAgent.model', "Model ID supported by this endpoint"), value: previous?.model, ignoreFocusLost: true, validateInput: async value => value.trim() ? undefined : localize('nativeAgent.modelRequired', "Enter a model ID.") });
				if (model === undefined) {
					return;
				}
				const keepKey = baseUrl.replace(/\/$/, '') === previous?.baseUrl && !!previous.apiKey;
				const apiKey = await quickInput.input({ title: selected.label, password: true, ignoreFocusLost: true,
					prompt: keepKey ? localize('nativeAgent.keepKey', "API Key (leave empty to keep the key for this endpoint)") : localize('nativeAgent.enterKey', "API Key"),
					validateInput: async value => value.trim() || keepKey ? undefined : localize('nativeAgent.keyRequired', "Enter an API key."),
				});
				if (apiKey === undefined) {
					return;
				}
				const stateHome = URI.joinPath(profiles.currentProfile.globalStorageHome, 'agent-first', agent);
				try {
					token = JSON.stringify(parseNativeAgentConfiguration(JSON.stringify({ mode: 'apiKey', apiKey: apiKey.trim() || previous?.apiKey, baseUrl, model, executable, home: stateHome.fsPath })));
				} catch {
					notifications.error(localize('nativeAgent.invalid', "Invalid connection. Use an HTTP(S) endpoint without embedded credentials or URL parameters, and a valid model ID."));
					return;
				}
				await files.createFolder(stateHome);
			}
		}
		const apply = await quickInput.pick([
			{ label: localize('nativeAgent.restart', "Save and Restart Agents"), description: localize('nativeAgent.restartDescription', "Running agent tasks will stop"), restart: true },
			{ label: localize('nativeAgent.save', "Save for Next Restart"), restart: false },
		], { title: selected.label });
		if (!apply) {
			return;
		}
		if (token) {
			await secrets.set(key, token);
			await configuration.updateValue(AgentHostAllowSignedOutWhenUsableSettingId, true, ConfigurationTarget.USER);
			if (agent === 'codex') {
				await configuration.updateValue(AgentHostCodexAgentEnabledSettingId, true, ConfigurationTarget.USER);
			}
		} else {
			await secrets.delete(key);
		}
		if (apply.restart) {
			await host.restartAgentHost();
		}
		notifications.info(localize('nativeAgent.saved', "Agent configuration saved. Select its model in a new chat; credentials are checked when a task is sent."));
	}
});
