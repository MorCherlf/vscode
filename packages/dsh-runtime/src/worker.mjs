/* Copyright (c) Microsoft Corporation. All rights reserved. */
/* Licensed under the MIT License. See LICENSE.txt in the project root for license information. */
import { DeepSeekHarness } from '@deepseek-ai/dsh-sdk-client';
import { readFile } from 'node:fs/promises';
import readline from 'node:readline';
import { RuntimeBridge } from './bridge.mjs';
if (process.versions.node !== '24.22.1' || process.versions.electron) { throw new Error('DSH_NODE_VERSION_MISMATCH'); }
for (const name of ['dsh', 'dsh-sdk-client']) {
	const metadata = JSON.parse(await readFile(new URL(`../node_modules/@deepseek-ai/${name}/package.json`, import.meta.url), 'utf8'));
	if (metadata.version !== '0.2.2-alpha.2') { throw new Error('DSH_RELEASE_MISMATCH'); }
}
const write = value => { if (!process.stdout.write(JSON.stringify(value) + '\n')) { input.pause(); process.stdout.once('drain', () => input.resume()); } };
const bridge = new RuntimeBridge(config => new DeepSeekHarness({ cwd: config.cwd, dshHome: config.home, profile: config.profile, patches: config.patches, provider: config.provider, model: config.model, approvalRequests: false, env: { ...process.env, HOME: config.home, DSH_HOME: config.home }, onUserQuestion: async () => { throw new Error('USER_QUESTION_UI_UNSUPPORTED'); } }), event => write({ event }));
const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity }); let pending = 0;
input.on('line', line => {
	if (Buffer.byteLength(line) > 262144 || pending >= 16) { process.exitCode = 1; input.close(); return; }
	let frame; try { frame = JSON.parse(line); } catch { input.close(); return; }
	pending++;
	void bridge.request(frame.method, frame.params).then(result => write({ id: frame.id, result }), error => write({ id: frame.id, error: error.message })).finally(() => pending--);
});
input.on('close', () => { void bridge.request('shutdown').catch(() => {}).finally(() => process.exit()); });
