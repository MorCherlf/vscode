/* Copyright (c) Microsoft Corporation. All rights reserved. */
/* Licensed under the MIT License. See LICENSE.txt in the project root for license information. */
import { readFile, cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const source = new URL('../../../packages/agent-host/dist/', import.meta.url);
const target = new URL('../src-tauri/resources/agent-host/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', source), 'utf8'));
if (manifest.testing || manifest.platform !== process.platform || manifest.arch !== process.arch) { throw new Error('Build a matching production Host first'); }
await rm(target, { recursive: true, force: true }); await mkdir(target, { recursive: true });
await cp(fileURLToPath(source), fileURLToPath(target), { recursive: true });
console.log(JSON.stringify({ platform: manifest.platform, arch: manifest.arch, modules: manifest.modules, resourcesPrepared: true }));
