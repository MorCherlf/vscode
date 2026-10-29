# H1 engineering checkpoint — 2026-10-29

**Status: engineering in progress; pending Mac build/verification. Not ready for human acceptance, not human accepted.** Rules and demos: [HUMAN_ACCEPTANCE](../../../HUMAN_ACCEPTANCE.md). H2–H4 remain separate; no DSH activation is required for H1.

Source: implementation branch, parent `61586cca264f12c9676182618fb948d15d257103` (fast-forward integrated without resetting existing work). This checkpoint's exact commit is the commit adding this directory; subsequent inactive DSH preparation does not change its H1 source. Original source version 1.145.0. Electron 43.8.3 / Node 24.22.0 / ABI 148; standalone fixture Host uses ordinary Node 24.22.1. Linux x64; no Mac artifact produced here.

## Implemented

- Original Sessions composition replaces its direct `editor.all` barrel with original core commands, code editor widget, diff contribution, clipboard, context menu, cursor undo and word operations. No component copy, React view, or replacement API. This is an initial composition reduction, **not complete editor-only exclusion**.
- Product-owned `agentFirstExecutableExtensions` admission runs before built-in heuristics, contribution auto-enable and user overrides. An empty list currently admits **zero executable extensions**, including mixed/built-in and DSH; declarative assets retain original rules. Upstream products omitting the field keep existing behavior. Auditing an entire activation/import/dependency graph is required before adding an executable ID. This is not an OS sandbox.
- `scripts/agent-first/run.sh` launches the original Electron Agents window with a fresh profile/extension directory and disposable failing-test project. It does not use personal VS Code caches. Dedicated real provider setup is still required for actual tasks. All executable extensions are currently denied; the independent native Agent Host path is not an extension admission.
- `web-smoke.mjs` embeds **original** `sessions.web.main.internal → web.factory → SessionsBrowserMain → createSessionsWorkbench`, original DI/services. The original `isSessionsWindow` workspace payload is required. It contains no replacement chat UI or mock workbench services. Optional `--mock-host` starts the existing M1 standalone mock Host with its actual Node/native components and original AHP endpoint. Fixture connection token is ephemeral, not an account token, and is redacted from diagnostics. Child stops on stdin EOF; fixture home is removed.
- `audit.mjs` records conservative source imports and manifest admission. Browser smoke separately captures requested script/worker resources, not extension activation or all later code paths.

## Executed evidence

| Command / raw report | Result and actual boundary |
| --- | --- |
| `npm ci --ignore-scripts`; `npm ci --prefix build --ignore-scripts` | Dependency preparation; not full product verification |
| `npm run build-fast -- --client-only` / `raw/build-fast.log` | PASS, 10,860 TS files transpiled + 2,362 resources. Transpile is not typecheck |
| `npm run electron` | PASS, original Electron downloaded; native rebuild command below |
| `node test/unit/node/index.js --run src/vs/workbench/services/extensions/test/common/extensionManifestPropertiesService.test.ts` / `raw/extension-admission.log` | **46 passing**, original service unit tests, including product admission vs overrides/built-in/mixed/activation declarations. Not EH activation |
| Original browser runner: `chatInputPart.test.ts` / `raw/chat-input.log` | **32 passing** |
| Original browser runner: `chatWidget.test.ts` / `raw/chat-widget.log` | **135 passing, 4 pending**; pending tests not counted as passed |
| Original browser runner: `sessionsList.test.ts` / `raw/sessions-list.log` | **423 passing** |
| Targeted `npm run eslint -- ...` / `raw/lint.log` | PASS, four changed original TS files |
| `node scripts/agent-first/web-smoke.mjs --mock-host` / `raw/original-web-host.log`, screenshot | Original window instantiated and discovered named real mock Host. Original account sign-in gate remains. **No task sent, no account or model validated** |
| `node scripts/agent-first/audit.mjs` / `raw/static-inventory.json` | 5,663 conservative reachable modules; no `editor.all` path found. 578 candidate review paths, 35 executable manifest entries including inactive DSH prep, zero admitted. Not runtime exclusion proof |
| `raw/browser-resource-load.json` | 4,870 requested JS resources, 2 worker URLs; no `editor.all`; **208 editor contribution resources and 288 notebook/debug/testing/search candidate resources remain**. Notebook contribution is actually requested. AF-02 **not passed**; classify required diff/Monaco vs editor-only before removing |
| `npm run typecheck-client` / `raw/typecheck-killed.log` | **Failed: memory killed**, no full typecheck claim |
| Original Electron + Xvfb / `raw/electron-blocked.log` | **Blocked** at single-instance IPC `listen EPERM /tmp/af-probe-profile/1.14-main.sock`, before original window. Managed cloud forbids Unix sockets. Temporary ignored-output instrumentation localized failure and was restored. Minimal Electron/Xvfb worked but is not H1 evidence |

Browser tests use original runner with explicit existing **Chromium 141.0.7390.37** executable; upstream Playwright download of pinned Chromium149 returned invalid/truncated zip. Reproduction wrapper accepts `AGENT_FIRST_CHROMIUM`; do not call this the pinned browser, WKWebView, or native Mac. Tests use their original mocks/fixtures; not a real task. Input/layout tests do not exercise native Chinese IME.

## Reproduce cloud checks

From repository root after client build:

```sh
node test/unit/node/index.js --run src/vs/workbench/services/extensions/test/common/extensionManifestPropertiesService.test.ts
# Use Playwright's installed default, or explicitly set AGENT_FIRST_CHROMIUM to a known executable.
node scripts/agent-first/browser-tests.cjs --browser chromium --run src/vs/workbench/contrib/chat/test/browser/widget/input/chatInputPart.test.ts
node scripts/agent-first/browser-tests.cjs --browser chromium --run src/vs/workbench/contrib/chat/test/browser/widget/chatWidget.test.ts
node scripts/agent-first/browser-tests.cjs --browser chromium --run src/vs/sessions/contrib/sessions/test/browser/sessionsList.test.ts
node scripts/agent-first/audit.mjs > /tmp/agent-first-static.json
# Requires previously built packages/agent-host/dist-test; this remains an explicit fixture.
node scripts/agent-first/web-smoke.mjs --mock-host
```

Native Linux rebuild used downloaded original Electron headers plus upstream `build/npm/gyp/custom-headers/*`, extracted libxkbfile/libsecret sysroot:

```sh
PATH="/tmp/m2b-tools:$PATH" PKG_CONFIG_SYSROOT_DIR=/tmp/m2b-sysroot \
PKG_CONFIG_PATH=/tmp/m2b-sysroot/usr/lib/x86_64-linux-gnu/pkgconfig \
npm rebuild @vscode/sqlite3 @vscode/spdlog @vscode/native-watchdog @vscode/policy-watcher @vscode/fs-copyfile @vscode/deviceid @parcel/watcher node-pty \
--nodedir=/tmp/af-electron-headers/node_headers
```

These temporary Linux paths are evidence of this run, not Mac instructions. Original native extension rebuild is needed after changing Node/Electron ABI. The standalone Host has separate dependencies and ordinary Node ABI; do not share them.

## Mac arm64 handoff (not executed)

Use this checkpoint commit on the implementation branch; preserve other checkouts. Install repo `.nvmrc` Node and upstream macOS prerequisites (Xcode command line tools, Python, native build tools). In this checkout:

```sh
npm ci
npm ci --prefix build
npm run build-fast -- --client-only
npm run electron
bash scripts/agent-first/run.sh
```

The launcher intentionally skips prelaunch after explicit build. If native ABI errors occur, rebuild the named native modules for the downloaded Electron headers using upstream native-build prerequisites before retrying. Do not reuse the Linux rebuilt `node_modules`. This is a source/dev launch, **not an arm64 .app package or signed release**. Record actual command/ABI/error rather than assuming Mac compilation passed. Existing old Tauri .app is unrelated to this source version.

Use the printed temporary project. Initial `npm test` must fail (`2-3` instead of `2+3`). Through a separately configured, lawful original Agent/provider, request read → fix → run checks → inspect original diff. Demonstrate stream/stop/approve/reject, restart and continue, list switching, multi-line/paste/Chinese IME. Do not enable unaudited executable extensions just to get a reply. Core provider availability/account setup and the complete activation/import exclusion must be resolved **before** offering H1 for user acceptance.

## Remaining gates / next work

See [NEXT](NEXT.md). No real provider credentials, model tasks, EH activation negative test, native desktop window, Mac package, Keychain, WKWebView, signing or human acceptance was validated. Original sign-in UI stays intact. AF-01 partially exercised in browser; AF-02 baseline captured, exclusion incomplete; AF-03–06 unchanged/not passed. M1/M2 historical pending account/Mac gates remain pending. H2 code preparation remains disabled and separate from H1 evidence; no VSIX/runtime compatibility claim.
