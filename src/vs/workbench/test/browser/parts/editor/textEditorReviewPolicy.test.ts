/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { joinPath } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { toUserDataProfile } from '../../../../../platform/userDataProfile/common/userDataProfile.js';
import { TextEditorReviewPolicy } from '../../../../browser/parts/editor/textEditorReviewPolicy.js';
import { DiffEditorInput } from '../../../../common/editor/diffEditorInput.js';
import { TextResourceEditorInput } from '../../../../common/editor/textResourceEditorInput.js';
import { IUserDataProfileService } from '../../../../services/userDataProfile/common/userDataProfile.js';
import { workbenchInstantiationService } from '../../workbenchTestServices.js';
import { TestProductService } from '../../../common/workbenchTestServices.js';

suite('Agent First text review policy', () => {
	const store = new DisposableStore();
	teardown(() => store.clear());

	function setupPolicy(agentFirst: boolean) {
		const instantiation = workbenchInstantiationService(undefined, store);
		instantiation.stub(IProductService, { ...TestProductService, agentFirst });
		const policy = instantiation.createInstance(TextEditorReviewPolicy);
		const profile = instantiation.get(IUserDataProfileService).currentProfile;
		const input = (resource: URI) => store.add(instantiation.createInstance(TextResourceEditorInput, resource, undefined, undefined, undefined, undefined));
		return { instantiation, policy, profile, input };
	}

	test('only exact Profile resources and normalized instructions descendants are editable', () => {
		const { policy, profile, input } = setupPolicy(true);
		const allowed = [profile.settingsResource, profile.keybindingsResource, profile.tasksResource, profile.mcpResource, profile.languageModelsResource, joinPath(profile.promptsHome, 'fixture.instructions.md')];
		const denied = [
			URI.file('/project/settings.json'), URI.file('/project/AGENTS.md'),
			profile.settingsResource.with({ authority: 'other-profile' }),
			profile.settingsResource.with({ scheme: 'other-provider' }),
			profile.promptsHome.with({ path: profile.promptsHome.path + '/../../project/escape.md' }),
			profile.promptsHome.with({ path: profile.promptsHome.path + '-other/escape.md' }),
			joinPath(profile.agentPluginsHome, 'extension.js'), joinPath(profile.snippetsHome, 'code.json')
		];
		assert.deepStrictEqual({ allowed: allowed.map(uri => !!policy.getReadonlyReason(input(uri))), denied: denied.map(uri => !!policy.getReadonlyReason(input(uri))), missing: !!policy.getReadonlyReason(undefined) }, { allowed: allowed.map(() => false), denied: denied.map(() => true), missing: true });
	});

	test('ordinary products retain their original editor decisions', () => {
		const { policy, input } = setupPolicy(false);
		assert.deepStrictEqual([policy.getReadonlyReason(undefined), policy.getReadonlyReason(input(URI.file('/project/main.ts')))], [undefined, undefined]);
	});

	test('diffs cannot inherit a Profile file editing exception', () => {
		const { policy, profile, input, instantiation } = setupPolicy(true);
		const diff = store.add(instantiation.createInstance(DiffEditorInput, undefined, undefined, input(URI.file('/before')), input(profile.settingsResource), undefined));
		assert.strictEqual(!!policy.getReadonlyReason(diff), true);
	});

	test('Profile switches revoke the old Profile exception and retain the default Profile', async () => {
		const { policy, profile, input, instantiation } = setupPolicy(true);
		const next = toUserDataProfile('review', 'Review fixture', URI.file('/profiles/review'), URI.file('/cache'));
		await instantiation.get(IUserDataProfileService).updateCurrentProfile(next);
		const another = toUserDataProfile('another', 'Another fixture', URI.file('/profiles/another'), URI.file('/cache'));
		await instantiation.get(IUserDataProfileService).updateCurrentProfile(another);
		assert.deepStrictEqual([profile.settingsResource, next.settingsResource, another.settingsResource].map(uri => !!policy.getReadonlyReason(input(uri))), [false, true, false]);
	});
	ensureNoDisposablesAreLeakedInTestSuite();

});
