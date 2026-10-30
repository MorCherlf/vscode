/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const destination = process.argv[2];
if (!destination || !path.isAbsolute(destination)) { throw new Error('Expected an absolute output directory'); }
const files = {};
for (const project of ['alpha', 'beta']) {
	files[`projects/${project}/a.mjs`] = 'export const value = 1;\n';
	files[`projects/${project}/b.mjs`] = "import { value } from './a.mjs';\nif (value !== 2) { process.exit(1); }\n";
}
for (let index = 0; index < 100; index++) {
	files[`history/session-${String(index).padStart(3, '0')}/summary.json`] = JSON.stringify({ id: index, project: index % 2 ? 'beta' : 'alpha', title: `Fixture ${index}` }) + '\n';
}
files['history/session-000/events.jsonl'] = Array.from({ length: 1000 }, (_, index) => JSON.stringify({ sequence: index, text: `Event ${index} 中文 ${'x'.repeat(64)}`, time: '2026-10-28T00:00:00.000Z' })).join('\n') + '\n';
files['diff/original.txt'] = Array.from({ length: 10000 }, (_, index) => `line ${index}`).join('\n') + '\n';
files['diff/modified.txt'] = files['diff/original.txt'].replaceAll('line 42', 'changed 42');
const manifest = { version: 'agent-client-fixture-v1', seed: 0, projects: 2, sessions: 100, events: 1000, diffLines: 10000, files: [] };
for (const [name, content] of Object.entries(files)) {
	await mkdir(path.dirname(path.join(destination, name)), { recursive: true });
	await writeFile(path.join(destination, name), content);
	manifest.files.push({ path: name, bytes: Buffer.byteLength(content), sha256: createHash('sha256').update(content).digest('hex') });
}
await writeFile(path.join(destination, 'dataset.json'), JSON.stringify(manifest, null, '\t') + '\n');
console.log(JSON.stringify({ version: manifest.version, files: manifest.files.length, bytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0) }));
