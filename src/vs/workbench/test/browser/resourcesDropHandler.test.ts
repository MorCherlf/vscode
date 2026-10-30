/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DataTransfers } from '../../../base/browser/dnd.js';
import { mainWindow } from '../../../base/browser/window.js';
import { VSBuffer } from '../../../base/common/buffer.js';
import { stringify } from '../../../base/common/marshalling.js';
import { URI } from '../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { CodeDataTransfers, Extensions, IDragAndDropContributionRegistry } from '../../../platform/dnd/browser/dnd.js';
import { FileService } from '../../../platform/files/common/fileService.js';
import { InMemoryFileSystemProvider } from '../../../platform/files/common/inMemoryFilesystemProvider.js';
import { NullLogService } from '../../../platform/log/common/log.js';
import { INotificationService } from '../../../platform/notification/common/notification.js';
import { Registry } from '../../../platform/registry/common/platform.js';
import { IProductService } from '../../../platform/product/common/productService.js';
import { IWorkspacesService } from '../../../platform/workspaces/common/workspaces.js';
import { ResourcesDropHandler } from '../../browser/dnd.js';
import { IEditorService } from '../../services/editor/common/editorService.js';
import { IHostService } from '../../services/host/browser/host.js';
import { IWorkspaceEditingService } from '../../services/workspaces/common/workspaceEditing.js';
import { workbenchInstantiationService } from './workbenchTestServices.js';

class ChangingFileProvider extends InMemoryFileSystemProvider {
	armed = false;
	private reads = 0;
	override async stat(resource: URI) {
		const result = await super.stat(resource);
		if (this.armed && resource.path === '/race' && ++this.reads === 1) {
			await this.delete(resource, { recursive: false, useTrash: false, atomic: false });
			await this.mkdir(resource);
		}
		return result;
	}
}

suite('ResourcesDropHandler product workspace boundary', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	async function drop(agentFirst: boolean | undefined, paths: string[], allowWorkspaceOpen = true, transfer: 'external' | 'review' | 'dirty' | 'untitled' | 'embedded' = 'external', intercept = false, race = false) {
		const files = store.add(new FileService(new NullLogService()));
		const provider = store.add(new ChangingFileProvider());
		store.add(files.registerProvider('file', provider));
		await files.createFolder(URI.file('/one'));
		await files.createFolder(URI.file('/two'));
		await files.writeFile(URI.file('/review.txt'), VSBuffer.fromString('review'));
		await files.writeFile(URI.file('/project.code-workspace'), VSBuffer.fromString('{"folders":[]}'));
		await files.writeFile(URI.file('/race'), VSBuffer.fromString('file becomes folder'));
		provider.armed = race;
		const instantiation = workbenchInstantiationService({ fileService: () => files }, store);
		instantiation.stub(IProductService, { agentFirst });
		const calls: string[] = [];
		const warnings: string[] = [];
		instantiation.stub(IHostService, { focus: async () => { calls.push('focus'); }, openWindow: async () => { calls.push('window'); } });
		instantiation.stub(IWorkspaceEditingService, { createAndEnterWorkspace: async () => { calls.push('enter'); }, addFolders: async () => { calls.push('add'); } });
		instantiation.stub(IEditorService, { openEditors: async () => { calls.push('editors'); return []; } });
		instantiation.stub(IWorkspacesService, { addRecentlyOpened: async () => { calls.push('recents'); } });
		instantiation.stub(INotificationService, { warn: message => { warnings.push(String(message)); } });
		const handler = instantiation.createInstance(ResourcesDropHandler, { allowWorkspaceOpen });
		const data = new DataTransfer();
		if (transfer === 'dirty' || transfer === 'untitled' || transfer === 'embedded') {
			const resource = URI.file('/review.txt');
			const input = transfer === 'embedded' ? { original: { resource }, modified: { resource } }
				: { resource: transfer === 'untitled' ? URI.parse('untitled:New') : resource, contents: transfer === 'dirty' ? 'unsaved UI edit' : undefined };
			data.setData(CodeDataTransfers.EDITORS, stringify([input]));
		} else if (transfer === 'review') {
			data.setData(DataTransfers.RESOURCES, JSON.stringify(paths.map(path => URI.file(path).toString())));
		} else {
			data.setData(CodeDataTransfers.FILES, JSON.stringify(paths));
		}
		const registration = intercept ? store.add(Registry.as<IDragAndDropContributionRegistry>(Extensions.DragAndDropContribution).registerDropHandler({ handleDrop: async () => { calls.push('custom'); return false; } })) : undefined;
		try {
			await handler.handleDrop(new DragEvent('drop', { dataTransfer: data }), mainWindow);
			return { calls, warnings: warnings.length };
		} finally {
			registration?.dispose();
		}
	}

	for (const paths of [['/one'], ['/one', '/two'], ['/project.code-workspace'], ['/review.txt', '/one', '/two']]) {
		test(`Agent First rejects the whole workspace drop batch ${paths.join(',')}`, async () => {
			assert.deepStrictEqual(await drop(true, paths), { calls: [], warnings: 1 });
		});
	}

	test('late file-to-directory change cannot reach workspace mutation after preflight', async () => {
		assert.deepStrictEqual(await drop(true, ['/race'], true, 'external', false, true), { calls: ['focus', 'recents', 'editors'], warnings: 0 });
	});

	test('full-batch validation precedes contributed resource handlers', async () => {
		assert.deepStrictEqual(await drop(true, ['/review.txt', '/one'], true, 'external', true), { calls: [], warnings: 1 });
		assert.deepStrictEqual(await drop(false, ['/review.txt', '/one'], true, 'external', true), { calls: ['focus', 'custom', 'custom', 'window'], warnings: 0 });
	});

	test('folder drop cannot fall through when the caller disables workspace opening', async () => {
		assert.deepStrictEqual(await drop(true, ['/one'], false), { calls: [], warnings: 1 });
	});

	for (const transfer of ['dirty', 'untitled', 'embedded'] as const) {
		test(`unsaved or embedded ${transfer} transfer cannot create dirty review state`, async () => {
			assert.deepStrictEqual({ agent: await drop(true, [], false, transfer), legacy: await drop(false, [], false, transfer) }, {
				agent: { calls: [], warnings: 1 }, legacy: { calls: ['focus', 'editors'], warnings: 0 }
			});
		});
	}

	for (const flag of [false, undefined]) {
		test(`ordinary product ${flag} keeps single-folder/workspace opening and multi-folder entry`, async () => {
			assert.deepStrictEqual({ folder: await drop(flag, ['/one']), workspace: await drop(flag, ['/project.code-workspace']), multi: await drop(flag, ['/one', '/two']) }, {
				folder: { calls: ['focus', 'window'], warnings: 0 }, workspace: { calls: ['focus', 'window'], warnings: 0 }, multi: { calls: ['focus', 'enter'], warnings: 0 }
			});
		});
	}

	test('ordinary file review and explicit workspace-file text review retain original editor route', async () => {
		assert.deepStrictEqual({ file: await drop(true, ['/review.txt']), workspaceText: await drop(true, ['/project.code-workspace'], false, 'review') }, {
			file: { calls: ['focus', 'recents', 'editors'], warnings: 0 }, workspaceText: { calls: ['focus', 'editors'], warnings: 0 }
		});
	});
});
