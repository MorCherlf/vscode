/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { runHost, type HostSettings } from '../src/host.js';
import { ScriptedMockAgent } from '../../../src/vs/platform/agentHost/test/node/mockAgent.js';
import { IAgentHostProviderService } from '../../../src/vs/platform/agentHost/node/agentHostProviderService.js';

class AuthenticatedMockAgent extends ScriptedMockAgent {
	override getProtectedResources() {
		return [{ resource: 'https://fixture.invalid' }];
	}

	override async authenticate(_resource: string, token: string): Promise<boolean> {
		return token === 'fixture-account-token';
	}
}

export async function main(settings: HostSettings): Promise<void> {
	await runHost(runtime => {
		const providers = runtime.instantiationService.invokeFunction(accessor => accessor.get(IAgentHostProviderService));
		providers.registerProvider(new AuthenticatedMockAgent());
	}, settings);
}
