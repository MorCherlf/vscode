/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../../../workbench/common/contributions.js';
import { ISessionsProvidersService } from '../../../../services/sessions/browser/sessionsProvidersService.js';
import { ExtensionSessionsProvider } from './extensionSessionsProvider.js';
class ExtensionSessionsContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'sessions.extensionSessions';
	constructor(@IInstantiationService instantiation: IInstantiationService, @ISessionsProvidersService providers: ISessionsProvidersService) {
		super(); const provider = this._register(instantiation.createInstance(ExtensionSessionsProvider)); this._register(providers.registerProvider(provider));
	}
}
registerWorkbenchContribution2(ExtensionSessionsContribution.ID, ExtensionSessionsContribution, WorkbenchPhase.AfterRestored);
