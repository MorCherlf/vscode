/* Copyright (c) Microsoft Corporation. All rights reserved. */
/* Licensed under the MIT License. See LICENSE.txt in the project root for license information. */
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const app = fileURLToPath(new URL('../', import.meta.url));
const notices = new Map();
for (const root of [app, path.resolve(app, '../../packages/agent-client-core')]) {
	const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
	for (const [location, metadata] of Object.entries(lock.packages)) {
		if (!location.startsWith('node_modules/') || metadata.dev || metadata.link) { continue; }
		const directory = path.join(root, location);
		let files;
		try { files = await readdir(directory); } catch (error) { if (metadata.optional && error.code === 'ENOENT') { continue; } throw error; }
		const info = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
		const id = info.name + '@' + info.version;
		if (notices.has(id)) { continue; }
		const licenses = files.filter(file => /^(licen[sc]e|copying|notice)([._-].*)?$/i.test(file));
		const text = await Promise.all(licenses.map(async file => file + '\n' + await readFile(path.join(directory, file), 'utf8')));
		notices.set(id, { id, license: info.license, licenseFiles: licenses, text: text.join('\n\n') });
	}
}
const output = path.join(app, 'src-tauri/resources/frontend-notices');
await mkdir(output, { recursive: true });
const attribution = 'Codicons copyright Microsoft Corporation. Icons/font used unmodified from @vscode/codicons 0.0.46-47, licensed CC BY 4.0. Source: https://github.com/microsoft/vscode-codicons. License: https://creativecommons.org/licenses/by/4.0/.\n\n';
await writeFile(path.join(output, 'THIRD_PARTY_NOTICES.txt'), attribution + [...notices.values()].map(notice => notice.id + '\nDeclared license: ' + notice.license + '\n\n' + notice.text).join('\n\n--------------------\n\n'));
await writeFile(path.join(output, 'dependencies.json'), JSON.stringify([...notices.values()].map(({ text, ...notice }) => notice), null, '\t') + '\n');
console.log(JSON.stringify({ frontendNotices: notices.size, missingLicenseFiles: [...notices.values()].filter(notice => !notice.licenseFiles.length).map(notice => notice.id) }));
