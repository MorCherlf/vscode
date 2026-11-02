/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import * as tar from 'tar';
import { getAgentDir, getSdkTargetForBuild, getSdkVersion, getSdks } from './common.ts';
import { buildOne } from './package.ts';

/** Use the upstream pinned SDK producers for products that ship their runtimes offline. */
export function bundledAgentSdkConfiguration(platform: string, arch: string): Record<string, { version: string; bundledPath: string }> {
	return Object.fromEntries(getSdks().filter(sdk => getSdkTargetForBuild(platform, arch, sdk)).map(sdk => [sdk, {
		version: getSdkVersion(sdk), bundledPath: `agent-sdks/${sdk}`,
	}]));
}

export async function prepareBundledAgentSdks(platform: string, arch: string, appRoot: string): Promise<void> {
	const cache = path.resolve(import.meta.dirname, '../../.build/agent-sdk/bundled');
	for (const sdk of getSdks()) {
		const target = getSdkTargetForBuild(platform, arch, sdk);
		if (!target) {
			continue;
		}
		const lock = fs.readFileSync(path.join(getAgentDir(sdk), 'package-lock.json'));
		const fingerprint = createHash('sha256').update(lock).update(target).digest('hex');
		const cached = path.join(cache, `${sdk}-${fingerprint}`);
		const sentinel = path.join(cached, '.complete');
		if (!fs.existsSync(sentinel)) {
			const built = await buildOne({ sdk, sdkTarget: target, outDir: path.join(cache, 'tarballs') });
			fs.rmSync(cached, { recursive: true, force: true });
			fs.mkdirSync(cached, { recursive: true });
			await tar.x({ file: built.tgzPath, cwd: cached });
			fs.writeFileSync(sentinel, fingerprint);
		}
		const destination = path.join(appRoot, 'agent-sdks', sdk);
		fs.mkdirSync(path.dirname(destination), { recursive: true });
		fs.cpSync(cached, destination, { recursive: true, force: true });
	}
}
