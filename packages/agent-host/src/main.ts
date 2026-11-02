/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { runHost, type HostSettings } from './host.js';
import { CopilotAgent } from '../../../src/vs/platform/agentHost/node/copilot/copilotAgent.js';
import { IAgentHostProviderService } from '../../../src/vs/platform/agentHost/node/agentHostProviderService.js';

export async function main(settings: HostSettings): Promise<void> {
	await runHost(runtime => {
		const providers = runtime.instantiationService.invokeFunction(accessor => accessor.get(IAgentHostProviderService));
		providers.registerProvider(runtime.instantiationService.createInstance(CopilotAgent));
	}, settings);
}
