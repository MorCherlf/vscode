/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerAction2 } from '../../platform/actions/common/actions.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../workbench/common/contributions.js';
import product from '../../platform/product/common/product.js';

// Actions
// Do not even load the cross-product editor launcher in an Agent-only composition.
if (!product.agentFirst) {
	const { OpenInVSCodeAction, OpenInVSCodeWidgetContribution } = await import('./actions/vscodeActions.js');
	registerAction2(OpenInVSCodeAction);
	registerWorkbenchContribution2(OpenInVSCodeWidgetContribution.ID, OpenInVSCodeWidgetContribution, WorkbenchPhase.BlockRestore);
}
