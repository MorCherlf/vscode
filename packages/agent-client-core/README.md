<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# Shared Agent client core

Uses the official `@microsoft/agent-host-protocol` **1.0.0** client, types, version registry and root/session/chat reducers. There is no Tauri import in this package. The thin projection indexes explicitly subscribed resources by their exact advertised identity; it does not derive a chat from a session URI or rebuild a reducer in Rust.

```sh
npm --prefix packages/agent-client-core ci
npm --prefix packages/agent-client-core run build
npm --prefix packages/agent-client-core test
```

Integration tests require the M1 `packages/agent-host/dist-test` artifact (`npm --prefix packages/agent-host run build:test`). They run its existing scripted mock provider and use a Node implementation of the `NativeBridge` interface. This exercises the official SDK plus the same bounded TypeScript transport against the actual Host, while the Rust crate separately tests the real native supervisor. Neither test is an end-to-end WebView IPC test or a real Copilot model task.

`AgentClient` negotiates the SDK's released compatibility list, consumes snapshots and official action envelopes, and buffers actions that arrive during a snapshot request. Global server sequence gaps can legitimately occur on unsubscribed channels; the client does not mistake every numeric gap for lost data. Snapshot watermarks suppress duplicate actions. Transport/IPC failure invalidates readiness and requires a new connection plus fresh snapshots of retained subscriptions. In-flight create/send outcomes are unknown; mutations are never replayed automatically.

`TauriTransport` accepts a native bridge without a token or authenticated URL in its interface. It bounds inbound frames to 128 / 8 MiB, single frames to 1 MiB and pending outbound calls to 32. Native credit is acknowledged when a frame is consumed. Old-generation messages are ignored. Overflow clears queued data, closes the connection, and fails with a resync-required error rather than continuing from silently dropped events.

The current UI adapter supports text questions, simple acceptance/refusal, cancellation and tool confirmation through the Host's protocol. Other typed elicitation forms and URL authentication are explicitly unavailable in the UI. Host/SDK permission enforcement remains authoritative.
