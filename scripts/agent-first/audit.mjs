/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
// Conservative static import inventory, NOT proof of runtime exclusion or extension activation.
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const entry = 'src/vs/sessions/sessions.desktop.main.ts';
const parents = new Map([[entry, null]]);
const pending = [entry];
for (let i = 0; i < pending.length; i++) {
	const path = pending[i];
	const text = await readFile(resolve(root, path), 'utf8');
	for (const match of text.matchAll(/(?:\b(?:import|export)\s+(?:[^;'"\n]*?\s+from\s*)?|\bimport\s*\()\s*['"]([^'"]+)['"]/g)) {
		if (!match[1].startsWith('.')) { continue; }
		const target = relative(root, resolve(root, dirname(path), match[1].replace(/\.js$/, '.ts')));
		if (target.startsWith('src/') && existsSync(resolve(root, target)) && !parents.has(target)) {
			parents.set(target, path); pending.push(target);
		}
	}
}
const chain = path => { const result = []; while (path) { result.unshift(path); path = parents.get(path); } return result; };
const product = JSON.parse(await readFile(resolve(root, 'product.json'), 'utf8'));
const extensions = [];
for (const entry of await readdir(resolve(root, 'extensions'), { withFileTypes: true })) {
	const path = resolve(root, 'extensions', entry.name, 'package.json');
	if (!entry.isDirectory() || !existsSync(path)) { continue; }
	const pkg = JSON.parse(await readFile(path, 'utf8'));
	const id = `${pkg.publisher}.${pkg.name}`;
	extensions.push({ id, executable: !!(pkg.main || pkg.browser), admitted: product.agentFirstExecutableExtensions?.some(v => v.toLowerCase() === id.toLowerCase()) ?? null, activationEvents: pkg.activationEvents ?? [], extensionDependencies: pkg.extensionDependencies ?? [], entry: { main: pkg.main, browser: pkg.browser } });
}
const candidates = pending.filter(p => /editor\.all\.ts$|\/editor\/contrib\/|\/contrib\/(debug|notebook|testing|scm|search)\//.test(p));
console.log(JSON.stringify({ kind: 'static-overapproximation-including-type-imports-not-runtime-proof', entry, modules: pending.length, editorAllPaths: pending.filter(p => p.endsWith('/editor.all.ts')).map(chain), sharedMonaco: pending.filter(p => /\/editor\/(common|browser)\//.test(p)).length, candidatesForReview: candidates, extensions }, null, 2));
