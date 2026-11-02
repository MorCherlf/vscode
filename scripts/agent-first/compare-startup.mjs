/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { transform } from '../../build/node_modules/esbuild/lib/main.js';
import { excludedStartupModules } from './composition-check.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const baseline = 'de85d95570b43e1dbd5fc0674817ef929804d243';
const directory = resolve(process.argv[2] ?? '/tmp/agent-first-startup-comparison');
await mkdir(directory, { recursive: true });
const temporary = await mkdtemp(resolve(tmpdir(), 'h1-composition-baseline-'));
try {
	const source = execFileSync('git', ['show', baseline + ':src/vs/sessions/sessions.common.main.ts'], { cwd: root, encoding: 'utf8' });
	const entry = resolve(temporary, 'sessions.common.main.js');
	await writeFile(entry, (await transform(source, { loader: 'ts', format: 'esm', target: 'es2024' })).code);
	const snapshots = {};
	const exits = {};
	for (const name of ['baseline', 'current']) {
		const trace = resolve(directory, name + '.json');
		const fd = openSync(resolve(directory, name + '.log'), 'w');
		try {
			const child = spawnSync(process.execPath, [resolve(root, 'scripts/agent-first/web-smoke.mjs'), '--probe-extensions'], {
				cwd: root, env: { ...process.env, AGENT_FIRST_BASELINE_ENTRY: name === 'baseline' ? entry : '', AGENT_FIRST_TRACE: trace },
				stdio: ['ignore', fd, fd], timeout: 120000
			});
			if (child.error) { throw child.error; }
			exits[name] = child.status;
		} finally { closeSync(fd); }
		snapshots[name] = JSON.parse(await readFile(trace, 'utf8'));
	}
	assert.deepEqual(exits, { baseline: 1, current: 0 }, 'Old composition must fail exclusion; current must pass all probes');
	const previous = new Set(snapshots.baseline.scripts);
	const current = new Set(snapshots.current.scripts);
	assert.ok(previous.has('/out/vs/workbench/contrib/notebook/browser/notebook.contribution.js'), 'Baseline entry was not evaluated');
	assert.deepEqual(excludedStartupModules.filter(path => current.has(path)), []);
	const report = {
		kind: 'same-browser-original-Worker-EH-and-in-memory-diff-fixture-not-performance-or-human-acceptance',
		baseline, baselineEntrySourceSha256: createHash('sha256').update(source).digest('hex'), exits,
		baselineScripts: previous.size, currentScripts: current.size,
		baselineWorkers: snapshots.baseline.workers.length, currentWorkers: snapshots.current.workers.length,
		removed: [...previous].filter(path => !current.has(path)), added: [...current].filter(path => !previous.has(path))
	};
	await writeFile(resolve(directory, 'comparison.json'), JSON.stringify(report, null, 2));
	console.log(JSON.stringify({ directory, baselineScripts: report.baselineScripts, currentScripts: report.currentScripts, removed: report.removed.length, added: report.added.length, exits }));
} finally { await rm(temporary, { recursive: true, force: true }); }
