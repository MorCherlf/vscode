/* Copyright (c) Microsoft Corporation. All rights reserved. */
/* Licensed under the MIT License. See LICENSE.txt in the project root for license information. */
// Read-only source audit. This conservative closure includes type imports and is not a bundle or runtime measurement.
import { createRequire } from 'node:module';
import { readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const require = createRequire(path.join(root, 'apps/agent-client/package.json'));
const ts = require('typescript');
const entries = [
	'src/vs/sessions/contrib/chat/browser/chatView.ts',
	'src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts',
	'src/vs/workbench/contrib/chat/browser/widget/input/chatInputPart.ts',
	'src/vs/sessions/contrib/sessions/browser/views/sessionsList.ts',
	'src/vs/workbench/api/common/extHost.api.impl.ts',
	'src/vs/workbench/api/browser/extensionHost.contribution.ts',
];
const cache = new Map();
const resolutions = new Map();
async function resolve(from, specifier) {
	if (!specifier.startsWith('.')) { return { external: specifier }; }
	const base = path.resolve(path.dirname(from), specifier);
	if (resolutions.has(base)) { return resolutions.get(base); }
	let result;
	const candidates = base.endsWith('.js') ? [base.slice(0, -3) + '.ts', base] : path.extname(base) ? [base] : [base + '.ts', base + '.js', path.join(base, 'index.ts')];
	for (const candidate of candidates) {
		try { await access(candidate); result = /\.[cm]?[jt]s$/.test(candidate) ? { file: candidate } : { asset: path.relative(root, candidate) }; break; } catch { /* Try the next source form. */ }
	}
	result ??= { unresolved: path.relative(root, base) };
	resolutions.set(base, result); return result;
}
async function scan(file) {
	if (cache.has(file)) { return cache.get(file); }
	const text = await readFile(file, 'utf8');
	const imports = ts.preProcessFile(text, true, true).importedFiles.map(item => item.fileName);
	const references = await Promise.all(imports.map(item => resolve(file, item)));
	const result = { imports, references, services: [...new Set([...text.matchAll(/@(I[A-Z]\w+)/g)].map(match => match[1]))].sort(), sha256: createHash('sha256').update(text).digest('hex') };
	cache.set(file, result); return result;
}
function category(file) {
	const relative = path.relative(root, file);
	for (const prefix of ['src/vs/base/', 'src/vs/platform/', 'src/vs/editor/browser/', 'src/vs/editor/common/', 'src/vs/workbench/api/', 'src/vs/workbench/services/', 'src/vs/workbench/contrib/chat/', 'src/vs/workbench/', 'src/vs/sessions/']) { if (relative.startsWith(prefix)) { return prefix; } }
	return 'other';
}
const results = [];
for (const entry of entries) {
	const initial = path.join(root, entry); const pending = [initial]; const visited = new Set(); const external = new Set(); const assets = new Set(); const unresolved = new Set(); const categories = {};
	while (pending.length) {
		const file = pending.pop(); if (visited.has(file)) { continue; } visited.add(file);
		categories[category(file)] = (categories[category(file)] ?? 0) + 1;
		const record = await scan(file);
		for (const item of record.references) {
			if (item.file && !visited.has(item.file)) { pending.push(item.file); }
			if (item.external) { external.add(item.external); }
			if (item.asset) { assets.add(item.asset); }
			if (item.unresolved) { unresolved.add(item.unresolved); }
		}
	}
	const direct = await scan(initial);
	results.push({ entry, sha256: direct.sha256, directReferences: direct.imports.length, constructorDecoratorCandidates: direct.services, conservativeSourceClosure: visited.size, categories, externalPackages: [...external].sort(), referencedAssets: assets.size, unresolvedRelative: [...unresolved].sort() });
	console.log(JSON.stringify({entry, references:direct.imports.length,decoratorCandidates:direct.services.length,closure:visited.size}));
}
const output = { sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), typescript: ts.version, interpretation: 'Conservative source-reference graph, including type imports and side-effect contributions. Not emitted bundle size, runtime dependency proof, memory or extraction effort.', results };
await writeFile(new URL('vscode-import-audit.json', import.meta.url), JSON.stringify(output, null, '\t') + '\n');
