/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
// Browser integration probe of the original workbench, DI, Extension Service and Worker EH.
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
