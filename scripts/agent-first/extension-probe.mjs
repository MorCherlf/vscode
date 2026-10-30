/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
// Browser integration probe of the original workbench, DI, Extension Service and Worker EH.
import { IInstantiationService } from '/out/vs/platform/instantiation/common/instantiation.js';
import { ChatWidget } from '/out/vs/workbench/contrib/chat/browser/widget/chatWidget.js';
import { ChatAgentLocation } from '/out/vs/workbench/contrib/chat/common/constants.js';
import '/out/vs/sessions/sessions.web.main.js';
import { SessionsBrowserMain } from '/out/vs/sessions/browser/web.main.js';
import { CommandsRegistry } from '/out/vs/platform/commands/common/commands.js';
import { IExtensionService } from '/out/vs/workbench/services/extensions/common/extensions.js';
import { URI } from '/out/vs/base/common/uri.js';
import { mark } from '/out/vs/base/common/performance.js';
import { DisposableStore } from '/out/vs/base/common/lifecycle.js';
import { IModelService } from '/out/vs/editor/common/services/model.js';
import { ILanguageService } from '/out/vs/editor/common/languages/language.js';
import { IEditorService } from '/out/vs/workbench/services/editor/common/editorService.js';
import { IFileService } from '/out/vs/platform/files/common/files.js';
import { InMemoryFileSystemProvider } from '/out/vs/platform/files/common/inMemoryFilesystemProvider.js';
import { VSBuffer } from '/out/vs/base/common/buffer.js';
import { dirname, joinPath } from '/out/vs/base/common/resources.js';
import { IUserDataProfileService } from '/out/vs/workbench/services/userDataProfile/common/userDataProfile.js';
import { ITextFileService } from '/out/vs/workbench/services/textfile/common/textfiles.js';
import { IBulkEditService, ResourceTextEdit } from '/out/vs/editor/browser/services/bulkEditService.js';
import { MenuRegistry, MenuId } from '/out/vs/platform/actions/common/actions.js';
const disposables = new DisposableStore();
window.addEventListener('pagehide', () => disposables.dispose(), { once: true });
disposables.add(CommandsRegistry.registerCommand('agentFirst.test.extensionStatus', async accessor => {
	const service = accessor.get(IExtensionService);
	await service.whenInstalledExtensionsRegistered();
	for (const event of ['*', 'onStartupFinished', 'onLanguage:agent-first-fixture', 'onCommand:agentFirst.fixture.denied']) {
		await service.activateByEvent(event);
	}
	return {
		enabled: service.extensions.map(extension => extension.identifier.value).sort(),
		status: Object.fromEntries(Object.entries(service.getExtensionsStatus()).map(([id, status]) => [id, { activated: !!status.activationTimes, errors: status.runtimeErrors.length }]))
	};
}));
disposables.add(CommandsRegistry.registerCommand('agentFirst.test.diff', async accessor => {
	const models = accessor.get(IModelService);
	const language = accessor.get(ILanguageService).createById('javascript');
	const editor = accessor.get(IEditorService);
	const before = disposables.add(models.createModel('export const sum = (a, b) => a - b;\n', language, URI.parse('inmemory:/agent-first-before.js')));
	const after = disposables.add(models.createModel('export const sum = (a, b) => a + b;\n', language, URI.parse('inmemory:/agent-first-after.js')));
	const pane = await editor.openEditor({ original: { resource: before.uri }, modified: { resource: after.uri }, options: { readOnly: true } });
	const control = pane?.getControl();
	await control?.waitForDiff();
	return { pane: pane?.getId(), original: control?.getModel()?.original.getValue(), modified: control?.getModel()?.modified.getValue(), readOnly: control?.getModifiedEditor()?.getRawOptions().readOnly };
}));
const options = globalThis.agentFirstProbeOptions;
mark('code/didLoadWorkbenchMain');
options.additionalBuiltinExtensions = ['control', 'editor-only', 'mixed', 'dependent'].map(name => URI.parse(`${location.origin}/_h1/extensions/${name}`));
window.agentFirstWorkbench = await new SessionsBrowserMain(document.body, options).open();
window.agentFirstExtensionProbeReady = true;

// Writable original FileService/TextFileEditor fixture. Never a model/account task.
// This command owns only its in-memory provider and the fresh browser profile.
let reviewFixture;
disposables.add(CommandsRegistry.registerCommand('agentFirst.test.review', async (accessor, operation, name = 'project') => {
	const files = accessor.get(IFileService);
	const editor = accessor.get(IEditorService);
	const profile = accessor.get(IUserDataProfileService).currentProfile;
	const bulkEdit = accessor.get(IBulkEditService);
	const textFiles = accessor.get(ITextFileService);
	if (!reviewFixture) {
		const provider = disposables.add(new InMemoryFileSystemProvider());
		disposables.add(files.registerProvider('agent-first-fixture', provider));
		reviewFixture = { provider, resources: {
			project: URI.parse('agent-first-fixture:/project/main.js'),
			misleadingName: URI.parse('agent-first-fixture:/project/settings.json'),
			settings: profile.settingsResource, keybindings: profile.keybindingsResource,
			tasks: profile.tasksResource, mcp: profile.mcpResource, models: profile.languageModelsResource,
			instructions: joinPath(profile.promptsHome, 'fixture.instructions.md')
		} };
		for (const resource of Object.values(reviewFixture.resources)) {
			await files.createFolder(dirname(resource));
			await files.writeFile(resource, VSBuffer.fromString(resource.path.endsWith('.json') ? '{}\n' : '// fixture\n'));
		}
	}
	const resource = reviewFixture.resources[name];
	if (!resource) { throw new Error('Unknown fixture resource'); }
	if (operation === 'open') {
		const pane = await editor.openEditor({ resource, options: { pinned: true } });
		pane.focus();
		const control = pane.getControl();
		return { pane: pane.getId(), readOnly: control.getRawOptions().readOnly, inputReadonly: !!pane.input.isReadonly(), value: control.getModel().getValue() };
	}
	if (operation === 'read') {
		return { value: editor.activeTextEditorControl.getModel().getValue(), readOnly: editor.activeTextEditorControl.getRawOptions().readOnly };
	}
	if (operation === 'agentApiWrite') {
		const result = await bulkEdit.apply([new ResourceTextEdit(resource, { range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }, text: '// synthetic Agent API write\n' })]);
		await textFiles.save(resource);
		return { applied: result.isApplied, value: (await files.readFile(resource)).value.toString(), readOnly: editor.activeTextEditorControl.getRawOptions().readOnly };
	}
	if (operation === 'providerReadonly') {
		reviewFixture.provider.setReadOnly(true);
		return { readOnly: editor.activeTextEditorControl.getRawOptions().readOnly };
	}
	if (operation === 'entries') {
		const commands = ['workbench.action.files.newUntitledFile', 'workbench.files.action.compareNewUntitledTextFiles', 'workbench.action.files.setActiveEditorWriteableInSession'];
		return { registered: commands.filter(id => CommandsRegistry.getCommand(id)), newFileMenus: [MenuId.EmptyEditorGroupContext, MenuId.EditorTabsBarContext, MenuId.MenubarFileMenu].flatMap(menu => MenuRegistry.getMenuItems(menu).filter(item => item.command?.id === commands[0]).map(() => menu.id)) };
	}
	throw new Error('Unknown fixture operation');
}));

let chatFixture;
disposables.add(CommandsRegistry.registerCommand('agentFirst.test.chatInput', (accessor, operation) => {
	if (operation === 'open') {
		const store = disposables.add(new DisposableStore());
		const container = document.createElement('div');
		container.style.cssText = 'position:absolute;inset:60px;z-index:999;background:var(--vscode-editor-background)';
		document.body.append(container);
		store.add({ dispose: () => container.remove() });
		const widget = store.add(accessor.get(IInstantiationService).createInstance(ChatWidget, ChatAgentLocation.Chat, undefined, { renderStyle: 'compact' }, { overlayBackground: 'var(--vscode-editor-background)', listForeground: 'var(--vscode-foreground)', listBackground: 'var(--vscode-editor-background)', inputEditorBackground: 'var(--vscode-editor-background)', resultEditorBackground: 'var(--vscode-editor-background)' }));
		widget.render(container);
		widget.layout(600, 800);
		widget.focusInput();
		chatFixture = { widget, store };
	}
	if (operation === 'close') { chatFixture.store.dispose(); chatFixture = undefined; return; }
	return { readOnly: chatFixture.widget.inputEditor.getRawOptions().readOnly, value: chatFixture.widget.inputEditor.getValue() };
}));
