#!/usr/bin/env bash
# Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# Use a new dedicated profile and extension directory; never import personal VS Code state.
AGENT_FIRST_HOME="$(mktemp -d "${TMPDIR:-/tmp}/vsc-agent-first.XXXXXX")"
mkdir -p "$AGENT_FIRST_HOME/extensions" "$AGENT_FIRST_HOME/project"
cat > "$AGENT_FIRST_HOME/project/package.json" <<'JSON'
{"name":"agent-first-acceptance","private":true,"scripts":{"test":"node --test"},"type":"module"}
JSON
cat > "$AGENT_FIRST_HOME/project/sum.js" <<'JS'
export const sum = (a, b) => a - b;
JS
cat > "$AGENT_FIRST_HOME/project/sum.test.js" <<'JS'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sum } from './sum.js';
test('sum adds two numbers', () => assert.equal(sum(2, 3), 5));
JS
printf 'Dedicated test project/profile: %s\n' "$AGENT_FIRST_HOME"
printf 'Expected initial check: npm test fails; ask an explicitly configured Agent to fix sum, run checks, review diff.\n'
cd "$ROOT"
VSCODE_SKIP_PRELAUNCH=1 bash scripts/code.sh --agents --user-data-dir="$AGENT_FIRST_HOME/profile" --extensions-dir="$AGENT_FIRST_HOME/extensions" "$AGENT_FIRST_HOME/project" "$@"
