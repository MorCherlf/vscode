/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Schemas } from '../../../base/common/network.js';
import { isEqual } from '../../../base/common/resources.js';
import { URI } from '../../../base/common/uri.js';
import { localize } from '../../../nls.js';
import { isFolderToOpen, isWorkspaceToOpen } from '../../window/common/window.js';
import type { IOpenConfiguration } from './windows.js';

export type AgentFirstWindowTarget = { readonly kind: 'agents' | 'new' | 'unsupported' } | { readonly kind: 'folder'; readonly folder: URI };

/** Route only unambiguous opens; unsupported editor intents must not silently lose their payload. */
export function getAgentFirstWindowTarget(config: IOpenConfiguration, agentsWorkspace: URI): AgentFirstWindowTarget {
	const openables = config.urisToOpen ?? [];
	if (config.diffMode || config.mergeMode || config.cli.diff || config.cli.merge || config.addMode || config.removeMode || config.cli['file-uri']?.length || (config.forceEmpty && (openables.length > 0 || config.cli._.length > 0))) {
		return { kind: 'unsupported' };
	}
	if (openables.length === 1 && isWorkspaceToOpen(openables[0]) && isEqual(openables[0].workspaceUri, agentsWorkspace)) {
		return { kind: 'agents' };
	}
	if (config.remoteAuthority || config.cli['file-uri']?.length || config.cli['folder-uri']?.length || config.cli.extensionDevelopmentPath?.length || config.cli.extensionTestsPath) {
		return { kind: 'unsupported' };
	}
	if (openables.length === 1 && isFolderToOpen(openables[0]) && openables[0].folderUri.scheme === Schemas.file) {
		return { kind: 'folder', folder: openables[0].folderUri };
	}
	return openables.length === 0 && config.cli._.length === 0 ? { kind: 'new' } : { kind: 'unsupported' };
}

/** Final renderer-load boundary, including callers that bypass the normal open dispatcher. */
export function assertAgentFirstWindowAllowed(agentFirst: boolean | undefined, isSessionsWindow: boolean): void {
	if (agentFirst && !isSessionsWindow) {
		throw new Error(localize('agentFirst.editorWindowUnsupported', "This Agent First product does not open editor windows. Open a project in the Agents window and use its review actions."));
	}
}
