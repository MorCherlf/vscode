/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
import assert from 'node:assert/strict';

// A scoped exclusion set, not a claim that all remaining editor modules are necessary.
export const excludedStartupModules = [
	'/out/vs/editor/editor.all.js',
	'/out/vs/workbench/contrib/notebook/browser/notebook.contribution.js',
	'/out/vs/workbench/contrib/notebook/browser/controller/executeActions.js',
	'/out/vs/workbench/contrib/notebook/browser/contrib/debug/notebookBreakpoints.js',
	'/out/vs/workbench/contrib/interactive/browser/interactive.contribution.js',
	'/out/vs/workbench/contrib/replNotebook/browser/repl.contribution.js',
	'/out/vs/workbench/contrib/searchEditor/browser/searchEditor.contribution.js',
	'/out/vs/workbench/contrib/inlineCompletions/browser/inlineCompletions.contribution.js',
	'/out/vs/workbench/contrib/inlineCompletions/browser/renameSymbolTrackerService.js',
	'/out/vs/workbench/contrib/debug/browser/repl.js'
];

export async function checkComposition(page, scripts) {
	const registry = await page.evaluate(async () => {
		const { Registry } = await import('/out/vs/platform/registry/common/platform.js');
		const { EditorExtensions } = await import('/out/vs/workbench/common/editor.js');
		const { CommandsRegistry } = await import('/out/vs/platform/commands/common/commands.js');
		const { getSingletonServiceDescriptors } = await import('/out/vs/platform/instantiation/common/extensions.js');
		return {
			panes: Registry.as(EditorExtensions.EditorPane).getEditorPanes().map(pane => pane.typeId).sort(),
			commands: ['notebook.cell.execute', 'interactive.open', 'repl.execute', 'search.action.openNewEditor'].filter(id => CommandsRegistry.getCommand(id)),
			sharedServices: getSingletonServiceDescriptors().filter(([id]) => /notebook|interactive|renameSymbol/i.test(id.toString())).map(([id, descriptor]) => ({ id: id.toString(), ctor: descriptor.ctor.name, delayed: descriptor.supportsDelayedInstantiation }))
		};
	});
	assert.deepEqual(excludedStartupModules.filter(path => scripts.has(path)), [], 'Excluded startup module requested');
	assert.deepEqual(registry.panes.filter(id => /notebook|interactive|repl|searchEditor/i.test(id)), [], 'Editor-only pane registered');
	assert.deepEqual(registry.commands, [], 'Editor-only command registered');
	assert.ok(registry.panes.includes('workbench.editors.textDiffEditor'), 'Original text diff pane missing');
	assert.ok(registry.sharedServices.some(service => service.id === 'notebookService' && service.ctor === 'NotebookService' && service.delayed), 'Original shared notebook service missing');
	return { excludedStartupModules, registry };
}
