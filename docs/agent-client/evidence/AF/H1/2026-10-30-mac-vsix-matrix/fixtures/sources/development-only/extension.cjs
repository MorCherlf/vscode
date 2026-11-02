/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
const fs = require('node:fs');
const path = require('node:path');
fs.appendFileSync(path.join(__dirname, '.h1-module.jsonl'), JSON.stringify({ kind: 'module', pid: process.pid, time: new Date().toISOString() }) + '\n');
exports.activate = context => {
 fs.appendFileSync(path.join(__dirname, '.h1-activation.jsonl'), JSON.stringify({ kind: 'activation', pid: process.pid, time: new Date().toISOString() }) + '\n');
 const vscode = require('vscode');
 context.subscriptions.push(vscode.commands.registerCommand("h1.native.development-only", () => 'native-fixture-only'));
};
