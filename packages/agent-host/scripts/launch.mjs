/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

/** Initializes product and resource paths before evaluating upstream modules. */
export async function launch(entry) {
	const root = path.dirname(fileURLToPath(import.meta.url));
	let tokenFile;
	try {
		if (process.versions.electron || process.versions.node !== '24.22.1') { throw Object.assign(new Error('Expected ordinary Node 24.22.1'), { code: 'RUNTIME_VERSION' }); }
		const options = { 'user-data-dir': path.join(os.homedir(), '.morcherlf-agent'), port: '0', 'shutdown-timeout': '4500' };
		for (let index = 2; index < process.argv.length; index += 2) {
			const name = process.argv[index].replace(/^--/, '');
			if (!Object.hasOwn(options, name) || !process.argv[index].startsWith('--') || !process.argv[index + 1]) { throw Object.assign(new Error('Invalid launch options'), { code: 'INVALID_OPTIONS' }); }
			options[name] = process.argv[index + 1];
		}
		const port = Number(options.port);
		const shutdownTimeout = Number(options['shutdown-timeout']);
		if (!Number.isInteger(port) || port < 0 || port > 65535 || !Number.isInteger(shutdownTimeout) || shutdownTimeout < 1 || shutdownTimeout > 2147483647) { throw Object.assign(new Error('Invalid port or shutdown timeout'), { code: 'INVALID_OPTIONS' }); }
		const userData = path.resolve(options['user-data-dir']);
		await mkdir(userData, { recursive: true, mode: 0o700 });
		const token = randomBytes(32).toString('base64url');
		tokenFile = path.join(userData, `.connection-${process.pid}-${randomBytes(8).toString('hex')}`);
		await writeFile(tokenFile, token, { flag: 'wx', mode: 0o600 });
		process.once('exit', () => { try { unlinkSync(tokenFile); } catch { /* Already removed. */ } });
		delete process.env.VSCODE_DEV;
		process.env.VSCODE_DEV_INJECT_NODE_MODULE_LOOKUP_PATH = path.join(root, 'node_modules');
		process.env.COPILOT_HOME = path.join(userData, 'copilot');
		globalThis._VSCODE_FILE_ROOT = path.join(root, 'src');
		globalThis._VSCODE_PRODUCT_JSON = JSON.parse(await readFile(path.join(root, 'product.json'), 'utf8'));
		globalThis._VSCODE_PACKAGE_JSON = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
		const { main } = await import(new URL(entry, import.meta.url));
		await main({ userData, port, shutdownTimeout, token, tokenFile });
	} catch (error) {
		process.stderr.write(JSON.stringify({ type: 'error', code: error.code ?? 'STARTUP_FAILED', message: error.message }) + '\n');
		process.exit(1);
	}
}
