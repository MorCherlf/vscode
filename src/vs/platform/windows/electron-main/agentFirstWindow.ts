/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ISingleFolderWorkspaceIdentifier, IWorkspaceIdentifier, isSingleFolderWorkspaceIdentifier } from '../../workspace/common/workspace.js';
import { Schemas } from '../../../base/common/network.js';
import { isEqual } from '../../../base/common/resources.js';
import { URI } from '../../../base/common/uri.js';
import { localize } from '../../../nls.js';
import { isFileToOpen, isFolderToOpen, isWorkspaceToOpen } from '../../window/common/window.js';
import type { IOpenConfiguration } from './windows.js';
import type { NativeParsedArgs } from '../../environment/common/argv.js';

export type AgentFirstWindowTarget = { readonly kind: 'agents' | 'new' | 'unsupported' } | { readonly kind: 'folder'; readonly folder: URI };

/** Native UI requests carry their own openables; the process's startup paths are not new API intent. */
export function getAgentFirstApiOpenArgs(agentFirst: boolean | undefined, startupArgs: NativeParsedArgs): NativeParsedArgs {
	return agentFirst ? { ...startupArgs, _: [], 'file-uri': undefined, 'folder-uri': undefined } : startupArgs;
}

/** Route only unambiguous opens; unsupported editor intents must not silently lose their payload. */
export function getAgentFirstWindowTarget(config: IOpenConfiguration, agentsWorkspace: URI): AgentFirstWindowTarget {
	const openables = config.urisToOpen ?? [];
	if (hasUnsupportedAgentFirstIntent(config, agentsWorkspace)) {
		return { kind: 'unsupported' };
	}
	if (openables.length === 1 && isWorkspaceToOpen(openables[0]) && isEqual(openables[0].workspaceUri, agentsWorkspace)) {
		return { kind: 'agents' };
	}
	if (config.cli['folder-uri']?.length) {
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

/** Validate before canonicalization can discard unsupported OS/API/CLI intent. */
export function assertAgentFirstOpenIntentAllowed(agentFirst: boolean | undefined, config: IOpenConfiguration, agentsWorkspace: URI | undefined): void {
	if (agentFirst && hasUnsupportedAgentFirstIntent(config, agentsWorkspace)) {
		throw new Error(localize('agentFirst.openIntentUnsupported', "Agent First supports a single project folder in the Agents window. Editor file, workspace, remote and extension development requests are not supported."));
	}
}

function hasUnsupportedAgentFirstIntent(config: IOpenConfiguration, agentsWorkspace: URI | undefined): boolean {
	const openables = config.urisToOpen ?? [];
	return !!(config.diffMode || config.mergeMode || config.cli.diff || config.cli.merge || config.addMode || config.removeMode
		|| config.remoteAuthority || config.cli.remote || config.cli.extensionDevelopmentPath?.length || config.cli.extensionTestsPath
		|| config.cli['file-uri']?.length || openables.length > 1
		|| (config.forceEmpty && (openables.length > 0 || config.cli._.length > 0))
		|| openables.some(openable => isFileToOpen(openable) || (isWorkspaceToOpen(openable) && !isEqual(openable.workspaceUri, agentsWorkspace))));
}

/** Keep CLI extraction authoritative; reject ambiguous results instead of silently selecting the first folder. */
export function getAgentFirstResolvedFolder(paths: readonly { readonly workspace?: IWorkspaceIdentifier | ISingleFolderWorkspaceIdentifier }[]): URI | undefined {
	if (paths.length !== 1 || !isSingleFolderWorkspaceIdentifier(paths[0].workspace) || paths[0].workspace.uri.scheme !== Schemas.file) {
		return undefined;
	}
	return paths[0].workspace.uri;
}

/** Ignore legacy editor-window history without deleting its workspaces or backups. */
export function isAgentFirstRestorableWindow(state: { readonly workspace?: { readonly configPath: URI }; readonly remoteAuthority?: string }, agentsWorkspace: URI | undefined): boolean {
	return !!agentsWorkspace && !!state.workspace && !state.remoteAuthority && isEqual(state.workspace.configPath, agentsWorkspace);
}
