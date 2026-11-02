/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMarkdownString, MarkdownString } from '../../../../base/common/htmlContent.js';
import { normalizePath } from '../../../../base/common/resources.js';
import { localize } from '../../../../nls.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IUserDataProfilesService } from '../../../../platform/userDataProfile/common/userDataProfile.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { IUserDataProfileService } from '../../../services/userDataProfile/common/userDataProfile.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { DiffEditorInput } from '../../../common/editor/diffEditorInput.js';

/** View-only restriction: original file/model write capabilities remain available to Agent APIs. */
export class TextEditorReviewPolicy {
	constructor(
		@IProductService private readonly productService: IProductService,
		@IUserDataProfileService private readonly profileService: IUserDataProfileService,
		@IUserDataProfilesService private readonly profilesService: IUserDataProfilesService,
		@IUriIdentityService private readonly uriIdentityService: IUriIdentityService,
	) { }

	get onDidChange() { return this.profileService.onDidChangeCurrentProfile; }

	getReadonlyReason(input: EditorInput | undefined): IMarkdownString | undefined {
		if (!this.productService.agentFirst) {
			return undefined;
		}
		const resource = input?.resource ? normalizePath(input.resource) : undefined;
		if (resource && !(input instanceof DiffEditorInput)) {
			for (const profile of [this.profileService.currentProfile, this.profilesService.defaultProfile]) {
				const editable = [profile.settingsResource, profile.keybindingsResource, profile.tasksResource, profile.mcpResource, profile.languageModelsResource];
				if (editable.some(candidate => this.uriIdentityService.extUri.isEqual(resource, candidate)) || this.uriIdentityService.extUri.isEqualOrParent(resource, profile.promptsHome)) {
					return undefined;
				}
			}
		}
		return getAgentFirstReadonlyMessage();
	}
}

/** Shared explanation for original text and embedded diff review controls. */
export function getAgentFirstReadonlyMessage(): IMarkdownString {
	return new MarkdownString(localize('agentFirst.readonlyReview', "Agent First file review is read-only. Use an Agent task to change project files. Profile settings and Agent instructions remain editable."));
}
