<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# Standalone Agent Host: first M1 implementation

This package reuses the repository's Node Agent Host runtime, AHP transport, shutdown drain and Copilot adapter. It does not build the desktop application, launch Electron, or import the Sessions/workbench frontend. The production entry registers Copilot only. This is a development artifact, not a signed release or a claim of completed M1 acceptance.

## Build and verify

Use ordinary Node **24.22.1**, matching `.nvmrc`. From the repository root:

```sh
npm --prefix packages/agent-host ci
npm --prefix packages/agent-host run build
npm --prefix packages/agent-host run build:test
npm --prefix packages/agent-host test
```

The prefix isolates installation from the root Electron `.npmrc` and desktop installation hooks. Native compilation needs a C/C++ toolchain, make and Python. Do not install with `--ignore-scripts` and then claim the native components work. On this cloud filesystem, node-gyp's default headers extraction failed restoring ownership (`TAR_ENTRY_ERROR EINVAL: fchown`). Extract the official matching headers using a method that does not restore ownership, then run `npm --prefix packages/agent-host ci --nodedir=/absolute/node-v24.22.1`. This is an environment workaround, not a different ABI or a source patch to node-gyp.

`dist/` contains the production artifact; `dist-test/` adds the existing scripted mock adapter and resource probe for testing. Both contain their own ordinary Node binary, production npm dependency closure, platform Copilot SDK/runtime, Diff worker, recursive watcher bootstrap, WASM and terminal/process scripts. The build discovers the TypeScript graph with esbuild, then transpiles individual modules preserving relative paths and `import.meta.url`. It is not a whole-repository type check. It never invokes root gulp/build-fast or Electron.

Move **dist as a whole** outside the checkout, then run:

```sh
./bin/node ./start.mjs --user-data-dir /absolute/agent-data
```

No system Node, repository node_modules or VS Code installation is used by this command. Keep stdin open while the Host should run. Optional flags: `--port <0..65535>` (default 0) and `--shutdown-timeout <1..2147483647>` (default 4500 ms). Binding is fixed to IPv4 loopback; no unauthenticated or remote-listen switch is exposed.

## Supervisor contract

- stdout publishes one JSON readiness frame: `{ "type": "ready", "host": "127.0.0.1", "port": 12345, "pid": 123, "tokenFile": "/absolute/agent-data/.connection-..." }`. No token value or authenticated URL is printed.
- The launcher creates a fresh 32-byte random token in an exclusive mode-0600 file. Read it in the native supervisor, connect using the existing AHP WebSocket `tkn` query contract, and keep it away from WebView state and logs. The file is removed at normal process exit; SIGKILL may leave a stale file, which cannot authenticate a later process.
- Account credentials travel through the upstream AHP `authenticate` request, separately from connection authentication. There is no login-cache import or command-line account-token option. `COPILOT_HOME` and the Host user-data directory are rooted under this application's data path. Real account login UI/Keychain remain future work.
- Startup failures emit stderr JSON with `type: error`, `code`, and `message`, then exit 1. Examples include `INVALID_OPTIONS`, `EADDRINUSE`, missing dependencies and `RUNTIME_VERSION`. Readiness is emitted only after the listener is bound and the protocol handler exists.
- Closing stdin, SIGTERM or SIGINT stops ingress, drains protocol/provider work and persistence through the upstream shutdown helper, disposes owned resources and exits 0. The timeout is a bounded best effort; the upstream helper logs drain/flush failures through the OTLP log channel and does not give a separate durable-flush exit status. Crash recovery is not yet certified.
- Logs use the existing in-memory OTLP channel. This first slice has no independent file-logger/diagnostic-export implementation. Native components and SDK child stderr remain subject to follow-up diagnostic redaction testing.

`manifest.json` records source commit and source hashes, lockfile hash, Node/ABI/platform, entry points, resource paths, dependency versions/integrities and per-file sizes/hashes. `module-graph.json` records the source closure and externals. Tests use a fresh relocated directory and the artifact's own Node, including native SQLite reads/writes, PTY, actual worker requests, WASM parsers, recursive file watcher, SDK/runtime ping, mock auth/session flow and shutdown.

## Scope and remaining gates

Linux x64/glibc is the platform verified in this delivery. A copied runtime binary still depends on the target operating system's libraries; this is not a cross-platform build or a libc portability certificate. The build filters incompatible optional libc packages. It retains npm-distributed native build/support files, so size is not optimized.

The shared upstream service graph still contains lazy Claude/Codex support code; their providers and SDKs are not enabled. Windows registry and Kerberos integrated proxy authentication are explicitly omitted externals. No generic VSIX compatibility is implemented. Root product notices and dependency licenses are retained, but a release-specific license/provenance review is still required for the copied Node/runtime distribution.

The tests distinguish deterministic mock authentication from real GitHub authentication. A successful SDK ping does not call a model or certify T05. No dedicated `COPILOT_TEST_GITHUB_TOKEN` was configured in this environment; no personal credentials were read. Real Copilot login/expiration/logout and three full file/command tasks remain required, as do macOS arm64/clean-machine, WKWebView, Keychain, signing and notarization checks. See [M1 evidence](../../docs/agent-client/evidence/M1/README.md) and [next work package](../../docs/agent-client/evidence/M1/NEXT.md).
