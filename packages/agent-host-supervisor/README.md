<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# Native HostSupervisor

A Tauri-independent Rust library owning one local Node Host and its authenticated loopback connection. It does not contain AHP reducers or account credentials. Rust **1.90.0** was used for this delivery; Cargo.lock pins dependencies.

```sh
AGENT_HOST_TEST_DIR="$PWD/packages/agent-host/dist-test" cargo +1.90.0 test --locked --manifest-path packages/agent-host-supervisor/Cargo.toml -- --include-ignored
```

The tests include actual M1 mock Host startup, an AHP handshake, reconnect with the same PID, stale-generation rejection, stdin EOF shutdown/reap and token-file cleanup. Set `AGENT_HOST_TEST_DIR` explicitly and pass `--include-ignored`; otherwise Cargo marks the real-Host integration test ignored. The recorded delivery run includes it and has zero ignored tests. The other tests cover missing artifacts, frame size and the native receive-credit window.

Production starts only the bundled `bin/node start.mjs` with an application-owned data directory. It consumes bounded readiness, validates loopback/port/PID and a direct, non-symlink mode-0600 token file inside that directory, then authenticates the WebSocket in native memory. Stderr is drained without forwarding raw contents to WebView. The public bridge sends only generations, frame sequence numbers, AHP frames and fixed error codes.

The socket loop has a bounded 32-command queue, a 1 MiB frame limit and a 64-frame unacknowledged receive window. Overflow closes the connection and signals resynchronization. Reconnecting replaces only the socket and retains the owned Host. Stopping closes ingress, drops the Host's stdin, waits up to seven seconds, then kills and reaps that same child if necessary, reporting a forced-stop error. No PID from the renderer or an external Host is accepted.

The Tauri shell hides its window on close. Quit asks the renderer's official state projection whether to wait or stop; cancellation sends no stop command. OS-level Mac close/reopen/quit behavior, task-time shutdown and crash recovery remain acceptance items. SIGKILL skips Rust Drop; the Host's pipe-close shutdown is a design mechanism, not a claim of tested crash recovery.
