/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { Memento } from '../../../../common/memento.js';
import { IEditorResolverService, RegisteredEditorPriority } from '../../../../services/editor/common/editorResolverService.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { nullExtensionDescription } from '../../../../services/extensions/common/extensions.js';
import { ExtensionMessageCollector, ExtensionsRegistry } from '../../../../services/extensions/common/extensionsRegistry.js';
import { TestProductService } from '../../../../test/common/workbenchTestServices.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { CustomEditorResolverContribution } from '../../browser/customEditors.js';
import { CustomEditorCapabilities, ICustomEditorService } from '../../common/customEditor.js';

suite('CustomEditorResolverContribution', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	setup(() => Memento.clear(StorageScope.PROFILE));
	teardown(() => Memento.clear(StorageScope.PROFILE));

	test('Registers custom editors from the previous session without using the custom editor service #325506', () => {
		const instantiationService = workbenchInstantiationService(undefined, disposables);
		instantiationService.get(IStorageService).store('memento/customEditors', JSON.stringify({
			editors: [{
				id: 'test.markdownEditor',
				displayName: 'Test Markdown Editor',
				providerDisplayName: 'Test',
				selector: [{ filenamePattern: '*.md' }],
				priority: RegisteredEditorPriority.default,
			}]
		}), StorageScope.PROFILE, StorageTarget.MACHINE);

		let customEditorServiceUsed = false;
		instantiationService.stub(ICustomEditorService, new class extends mock<ICustomEditorService>() {
			override getCustomEditorCapabilities(): CustomEditorCapabilities | undefined {
				customEditorServiceUsed = true;
				return undefined;
			}
		});

		disposables.add(instantiationService.createInstance(CustomEditorResolverContribution));

		const editors = instantiationService.get(IEditorResolverService).getEditors(URI.file('/test/readme.md'));
		assert.deepStrictEqual({
			registered: editors.some(editor => editor.id === 'test.markdownEditor'),
			customEditorServiceUsed,
		}, {
			registered: true,
			customEditorServiceUsed: false,
		});
	});
	for (const { sessions, admitted, restore } of [
		{ sessions: true, admitted: [], restore: false },
		{ sessions: true, admitted: ['test.audited'], restore: false },
		{ sessions: true, admitted: undefined, restore: true },
		{ sessions: false, admitted: [], restore: true },
	]) {
		test(`Cached custom editors: sessions=${sessions}, admission=${JSON.stringify(admitted)}`, () => {
			const instantiationService = workbenchInstantiationService(undefined, disposables);
			instantiationService.stub(IProductService, { ...TestProductService, agentFirstExecutableExtensions: admitted });
			instantiationService.stub(IWorkbenchEnvironmentService, { isSessionsWindow: sessions });
			const storage = instantiationService.get(IStorageService);
			const cached = JSON.stringify({ editors: [{
				id: 'test.stale', displayName: 'Stale editor', providerDisplayName: 'Test',
				selector: [{ filenamePattern: '*.md' }], priority: RegisteredEditorPriority.default,
			}] });
			storage.store('memento/customEditors', cached, StorageScope.PROFILE, StorageTarget.MACHINE);
			disposables.add(instantiationService.createInstance(CustomEditorResolverContribution));
			assert.deepStrictEqual({
				registered: instantiationService.get(IEditorResolverService).getEditors(URI.file('/project/readme.md')).some(editor => editor.id === 'test.stale'),
				// Ignoring unowned metadata must not delete recovery state.
				stored: storage.get('memento/customEditors', StorageScope.PROFILE),
			}, { registered: restore, stored: cached });
		});
	}

	test('Policy windows receive live contributions and unregister them on removal', () => {
		const instantiationService = workbenchInstantiationService(undefined, disposables);
		instantiationService.stub(IProductService, { ...TestProductService, agentFirstExecutableExtensions: ['test.audited'] });
		instantiationService.stub(IWorkbenchEnvironmentService, { isSessionsWindow: true });
		disposables.add(instantiationService.createInstance(CustomEditorResolverContribution));
		const resolver = instantiationService.get(IEditorResolverService);
		const registered = () => resolver.getEditors(URI.file('/project/readme.md')).some(editor => editor.id === 'test.live');
		const states = [registered()];
		const point = ExtensionsRegistry.getExtensionPoints().find(point => point.name === 'customEditors')!;
		try {
			// This is the already-filtered registry boundary, not an enablement test.
			point.acceptUsers([{
				description: nullExtensionDescription,
				value: [{ viewType: 'test.live', displayName: 'Live editor', selector: [{ filenamePattern: '*.md' }], priority: 'default' }],
				collector: new ExtensionMessageCollector(message => assert.fail(message.message), nullExtensionDescription, 'customEditors'),
			}]);
			states.push(registered());
			point.acceptUsers([]);
			states.push(registered());
			assert.deepStrictEqual(states, [false, true, false]);
		} finally {
			point.acceptUsers([]);
		}
	});

});
