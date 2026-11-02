/* Copyright (c) Microsoft Corporation. All rights reserved. */
/* Licensed under the MIT License. See LICENSE.txt in the project root for license information. */
// Test-only parent: killing it must close the real Host's stdin even during a turn.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { AgentClient, TauriTransport } from '../../agent-client-core/dist/index.js';
const [root, data, task] = process.argv.slice(2);
const host = spawn(path.join(root, 'bin/node'), [path.join(root, 'start-test.mjs'), '--user-data-dir', data], { stdio: ['pipe', 'pipe', 'ignore'] });
let output = ''; host.stdout.on('data', chunk => { output += chunk; });
const until = async condition => { for (let i = 0; i < 1000; i++) { if (condition()) { return; } await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error('fixture deadline'); };
await until(() => output.includes('"ready"')); const ready = JSON.parse(output.trim()); const token = await readFile(ready.tokenFile, 'utf8'); let socket;
const bridge = { open: async receive => { socket = new WebSocket(`ws://127.0.0.1:${ready.port}/?tkn=${token}`); let sequence = 0; socket.onmessage = event => receive({ kind: 'frame', generation: 1, sequence: ++sequence, text: event.data }); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }); return 1; }, send: async (_, text) => socket.send(text), ack: async () => {}, close: async () => socket.close() };
const client = new AgentClient(); await client.connect(await TauriTransport.connect(bridge));
const session = await client.createSession('mock', pathToFileURL(data).href); const chat = await client.selectSession(session); client.send(chat, task);
await until(() => task === 'permission' ? JSON.stringify(client.getChat(chat)).includes('pending-confirmation') : !!client.getChat(chat)?.activeTurn);
process.stdout.write(JSON.stringify({ active: task, pid: ready.pid, tokenFile: ready.tokenFile }));
