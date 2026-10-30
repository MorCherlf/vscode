<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# Tauri Agent client — Sessions migration

A Tauri **2.12.4** shell, React **19.2.0** / TypeScript **6.0.2** / Vite **7.1.12** interface, and shared official AHP client. It exposes projects, sessions, conversation/tool activity, text input requests, approvals and cancellation without loading the general workbench or `editor.all`. Native GitHub.com OAuth device authorization, refresh, sign-out and a macOS Keychain backend are implemented; the product-owned OAuth client ID must be configured. Real login and the new Mac backend remain unverified. M2 is **in progress**, not accepted.

The current UI follows this checkout's Agent/Sessions shell and composer structure, uses the pinned upstream Codicons and generated Light/Dark Modern tokens, and adds project grouping/search, session drafts, keyboard navigation, safe Markdown/GFM and tool cards. It is the first adapted component slice; the full upstream ChatWidget, native folder chooser, model picker and change-review views have not been migrated. Source mapping and comparison gates are in [UI migration](../../docs/agent-client/UI_MIGRATION.md).

## Build

Use ordinary Node 24.22.1 and Rust 1.90.0. On Linux, install the GTK 3/WebKit2GTK 4.1, librsvg, appindicator development packages and pkg-config using your environment's package manager. On macOS use the supported Xcode tooling. Existing M1 Host and core dependencies/builds must be present:

```sh
npm --prefix packages/agent-host ci
npm --prefix packages/agent-host run build
npm --prefix packages/agent-host run build:test
npm --prefix packages/agent-client-core ci
npm --prefix packages/agent-client-core run build
npm --prefix apps/agent-client ci
npm --prefix apps/agent-client run build
npm --prefix apps/agent-client run prepare:host
cargo +1.90.0 check --locked --manifest-path apps/agent-client/src-tauri/Cargo.toml
cargo +1.90.0 build --locked --manifest-path apps/agent-client/src-tauri/Cargo.toml
```

`prepare:host` copies the entire matching production M1 artifact into ignored Tauri resources; it rejects test/cross-platform artifacts and does not compile VS Code. It also generates frontend notices from the locked installed dependencies; Tauri build/dev prepares notices automatically. The local Node executable is a managed application resource; no shell plugin or arbitrary executable path is exposed to WebView. Build assets and the generated Tauri schemas are ignored. The app icon derives from the checked-in SVG; UI icons reuse Codicons with attribution in Settings and the packaged notices.

For development: `npm --prefix apps/agent-client run tauri -- dev`. This runs a local Vite server on 127.0.0.1:1420 and the Rust shell. `npm --prefix apps/agent-client run dev` alone is an offline browser preview: native connection and quit controls are disabled. Do not advertise it as a real Host conversation. `npm --prefix apps/agent-client run tauri -- build --bundles app --no-sign --ci -- --locked` produces a local unsigned Mac development app. A Mac arm64 Release build has passed; no application is signed, notarized or published.

Theme snapshots are checked in; run `npm --prefix apps/agent-client run sync:theme` when updating the upstream theme/size baseline. Session drafts stay in memory; only the color preference is stored under this app's own key. Closing an old app window hides it: use Settings → Quit to exit the old executable before opening the rebuilt app.

## Validation

```sh
npm --prefix packages/agent-client-core test
AGENT_HOST_TEST_DIR="$PWD/packages/agent-host/dist-test" cargo +1.90.0 test --locked --manifest-path packages/agent-host-supervisor/Cargo.toml -- --include-ignored
node apps/agent-client/node_modules/playwright/cli.js install chromium-headless-shell
npm --prefix apps/agent-client test
```

If using a custom Playwright browser cache, pass the same `PLAYWRIGHT_BROWSERS_PATH` to installation and tests. Current UI tests build a separate test-only entry into a temporary directory and connect the same App/official client to the actual M1 mock Host through a Node proxy. The Host connection token remains in the Node fixture. Tests require this checkout's matching Host dist-test and dependencies; production assets exclude the fixture. Prior Mac 5/5 UI groups, original 6/6 core and 4/4 Rust results, platform boundaries and screenshots are in [prior evidence](../../docs/agent-client/evidence/M2-ui/README.md). Browser screenshots and synthesized composition events do not validate native Tauri IPC, real WKWebView input methods or a real model account. Original Linux setup details remain in [M2 evidence](../../docs/agent-client/evidence/M2/README.md).

## State, credentials and lifecycle

The shared TypeScript layer uses the official SDK and reducers; Rust owns process and transport state only. Its IPC channel returns no connection token or authenticated URL. Flow control uses native credits and bounded TypeScript queues; overflow or lost connection requires synchronization. Unknown side-effect outcomes are never automatically retried. Mac titlebar integration grants main-window dragging only.

The application-scoped data path and production Host directory are selected natively, not supplied as renderer command arguments. Every custom command checks the main window and local origin. The main capability grants event listen/unlisten and window dragging only; no shell, filesystem, HTTP or remote-webview permission is enabled. Markdown renders to React nodes with raw HTML skipped; links cannot navigate, images cannot fetch remote content, and plugin frames remain disabled.

Closing the window hides it and keeps the Host alive. Quit presents keep-working, wait and stop choices; active/uncertain connection state prevents treating the task as definitely idle. The wait path keeps processing state updates; stop tears down only the owned Host. Actual Mac close/reopen/Cmd-Q, active-task quit and crash behavior require the test matrix in M2 evidence.

AHP text constraints, numeric/boolean/selection/freeform answers and explicitly opened HTTPS requests have adapters; unknown types fail closed and opening never approves. Native account configuration, exact scopes, storage errors, runner and fresh Linux tests are documented in [M2-B](../../docs/agent-client/evidence/M2/M2-B/README.md). Missing `MORCHERLF_GITHUB_OAUTH_CLIENT_ID` produces an explicit unconfigured state. No pasted-token path or VS Code/CLI personal cache is used. Mac compilation/Keychain, real login/model tasks, WKWebView and clean Mac acceptance remain pending.

Current React views are application adapters, not directly reused VS Code components. Further view expansion is paused pending the main feasibility report on upstream component/plugin reuse and DSH; this change does not decide the final runtime/container architecture.
