/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerAction2 } from '../../platform/actions/common/actions.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../workbench/common/contributions.js';
import product from '../../platform/product/common/product.js';
import { CommandsRegistry } from '../../platform/commands/common/commands.js';
import { SHOULD_SHOW_RETURN_TO_VSCODE_EDITOR_COMMAND_ID } from '../common/sessionCommands.js';

// Actions
if (product.agentFirst) {
	// The sign-in flow asks this capability query. No editor-launch command is registered.
	CommandsRegistry.registerCommand(SHOULD_SHOW_RETURN_TO_VSCODE_EDITOR_COMMAND_ID, () => false);
} else {
	const { OpenSessionInVSCodeAction, OpenInVSCodeWidgetContribution, OpenVSCodeWindowAction, ReturnToVSCodeEditorAction, ShouldShowReturnToVSCodeEditorAction } = await import('./actions/vscodeActions.js');
	registerAction2(OpenSessionInVSCodeAction);
	registerAction2(OpenVSCodeWindowAction);
	registerAction2(ReturnToVSCodeEditorAction);
	registerAction2(ShouldShowReturnToVSCodeEditorAction);
	registerWorkbenchContribution2(OpenInVSCodeWidgetContribution.ID, OpenInVSCodeWidgetContribution, WorkbenchPhase.BlockRestore);
}
