# H1 iteration 3 — close general-editor routes

2026-10-30. Parent: `e55b60dbe342229cd26ce942d3204b00915d4a46`. Same implementation branch / draft PR #2 / roadmap base; the commit adding this directory identifies the exact source. Existing checkout was present and clean, then fetched; no reset, clone, DSH activation, merge or publication. **H1 remains engineering in progress, pending required native/Mac/real-task gates; not ready for human acceptance.** [Human acceptance rules](../../../../HUMAN_ACCEPTANCE.md) are unchanged.

## Implemented

- Added optional, build/product-owned `agentFirst` composition flag (enabled in this product.json). It is independent of executable-extension admission and has no user-setting toggle. Omitting it or setting false preserves the original cross-window editor behavior. No account, approval or proposed API gate is changed.
- Web and desktop Sessions contributions conditionally import their **original** editor-launch actions only for ordinary products. Agent First does not load either action module or the launcher widget; toolbar/menu/command/keyboard registrations are absent rather than merely visually hidden.
- Desktop keeps the original `agents.shouldShowReturnToVSCodeEditor` capability query, returning **false** for this product because no general editor window exists. This prevents the existing sign-in flow from encountering a missing query command. No launch command is installed and no sign-in bypass is added. Ordinary products still use the original window-count query and original actions.
- Main-process `WindowsMainService.open` applies the product boundary: unambiguous empty-window requests go to original `openAgentsWindow`; one explicit local-folder URI goes there with a **new-session reveal**, preserving the folder intent. The canonical private Agents workspace continues through the original window opening path. Unsupported file/workspace/multiple-folder/diff/merge/remote/unresolved-CLI intents fail explicitly instead of silently discarding content or opening an IDE.
- A second check after native window configuration, **before new BrowserWindow creation/load**, rejects non-Sessions configurations in Agent First. This covers dispatch-bypass or restoration paths reaching that boundary. It does not reinterpret an ordinary editor configuration as an Agents window. The application bootstrap and general workbench source remain unchanged.
- Ordinary product (`agentFirst` absent/false) bypasses both restrictions and retains the existing route. Tests explicitly cover the final guard's ordinary-product behavior. Main-process native UI execution is still pending; source checks and pure route tests are not an Electron window test.
- Existing original read-only diff, shared Notebook services, original Worker EH and synthetic admission/event/dependency probes remain intact. No React UI or handwritten vscode API subset is added. DSH adapter/runtime/provider source and its disabled configuration are unchanged.

## Actual validation

| Check | Result | Scope |
| --- | --- | --- |
| `npm run build-fast -- --client-only` | PASS | Incremental client transpile/resources, not native compilation |
| `node test/unit/node/index.js --run src/vs/platform/windows/test/electron-main/agentFirstWindow.test.ts` | **18 passing** | Actual pure dispatch classifier/final guard: canonical/empty/folder, unsupported files/workspaces/CLI/diff/merge/mutations, contradictory payload, and ordinary-product control. Does not instantiate native WindowsMainService |
| Original `vscodeActions.test.ts` browser suite | **2 passing** | Existing original remote-routing helper behavior retained |
| Agent First original browser workbench probe | **PASS** | Original Worker EH control executes; four manifests scanned, denied/mixed/dependent entries not loaded; original diff reports readOnly=true. No launcher module/widget/command/accessibility button; four old commands reject through original ICommandService |
| Ordinary-product browser control | **PASS** | Same current source with test product flag false: original Web action module/command and accessible toolbar button are present. It is observed, not clicked, so no external app launches |
| Actual desktop registration module's Agent First branch, evaluated in browser | **PASS** | Query returns false, launch commands absent. No native API is mocked. **Not desktop/Electron/Mac execution**, not a positive test of the desktop ordinary-product branch |
| Targeted original graph typecheck | **PASS, exit 0** | TS7.0.2, upstream strict options / skipLibCheck=true; scope now includes Web/desktop Sessions and WindowsMainService. Electron declarations are real, checksum-verified 43.8.3 declarations. This is not an ABI/native/Mac build |
| `GOMEMLIMIT=1000MiB npm run valid-layers-check` | **PASS, exit 0, no timeout** | Both original `layersChecker.ts` and `layersTypeCheck.ts` completed. Go heap soft-limit setting allowed this run to finish; no rules/checks changed or skipped. Previous iteration's killed/137 report remains historical |
| Targeted lint, JS syntax, whitespace | PASS | Changed implementation files and probe scripts |

The original input/ChatWidget/list **590 passing, 4 pending** and manifest **46 passing** results from iteration 2 are reused because their implementation and relevant behavior inputs are unchanged. They are not counted as newly rerun results. No model task, dedicated-account login, Keychain, Mac/native EH or Mac package was validated. A fresh Unix socket capability probe still returned EPERM (raw/unix-socket.log), so no original desktop window result is inferred.

An initial expanded typecheck failed because the old `--ignore-scripts` dependency preparation had not generated `.build/typings/electron.d.ts`. Ran original `node build/npm/electronTypes.ts`, which checks `build/checksums/electron.txt`, then the targeted check passed. Raw initial diagnostics and final empty-success log are retained. No fake Electron declarations or skipped changed native TypeScript files were used.

One early UI assertion incorrectly searched the visible label “Open in Editor” as the accessible name. The original widget's actual name is “Open in VS Code Editor Window”. The corrected check uses that original ARIA name and both current/ordinary-product probes pass; no product UI label was changed to satisfy the test.

## Worker attribution

The harness now records worker names at creation and closure, and resource timing of surviving workers. It strips URL query/data content. In both final captures the three observed workers are:

| Actual name | Observed lifetime | Original source / purpose |
| --- | --- | --- |
| `editorWorkerService` | alive at snapshot | `editor/browser/services/editorWorkerService.ts` descriptor → `editor/common/services/editorWebWorkerMain.js`; original text/diff computation |
| `ExtensionHostWorker` | alive at snapshot | `workbench/services/extensions/worker/webWorkerExtensionHostIframe.html` → `workbench/api/worker/extensionHostWorkerMain.js`; original extension API execution |
| `perfBaseline` | closed before snapshot | `workbench/services/timer/browser/timerService.ts` creates this named Fibonacci calibration worker and terminates/revokes it in finally |

No worker was removed merely to improve a count. This is attribution for this fixture workload, **not universal proof for all later tasks**. Resource timing buffers may truncate, and future attribution failures are explicitly marked unavailable. No service-instance tracing or memory/performance budget claim follows. The ordinary-product and Agent First probe workloads differ by the desktop-registration capability check, so their total resource counts are not presented as a performance comparison.

## Reproduce

From repository root, with existing dependencies/outputs or the previous iteration's clean build recipe:

```sh
node build/npm/electronTypes.ts
npm run build-fast -- --client-only
node node_modules/@typescript/native/bin/tsc --project src/vs/sessions/tsconfig.agent-first.json
node test/unit/node/index.js --run src/vs/platform/windows/test/electron-main/agentFirstWindow.test.ts
AGENT_FIRST_CHROMIUM=/path/to/headless_shell node scripts/agent-first/browser-tests.cjs --browser chromium --run src/vs/sessions/test/browser/vscodeActions.test.ts --stall-timeout 45
AGENT_FIRST_CHROMIUM=/path/to/headless_shell node scripts/agent-first/web-smoke.mjs --probe-extensions
AGENT_FIRST_CHROMIUM=/path/to/headless_shell node scripts/agent-first/web-smoke.mjs --probe-extensions --legacy-editor-routes
GOMEMLIMIT=1000MiB npm run valid-layers-check
```

This cloud run used ordinary Node24.22.1 and explicitly selected Chromium141.0.7390.37 at `/tmp/h1b-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`. It is not the unavailable upstream pinned Chromium149, native Mac or WKWebView. Real account sign-in remains mandatory on original Web; no task was sent. Raw reports, source-compatible screenshots, resource/worker traces and `validation.json` are adjacent.

## Native / Mac handoff and restrictions

Use this exact iteration commit and the [iteration 2 Mac source/native-build recipe](../2026-10-30/README.md). It is still **unexecuted Mac instructions**, not a delivered runnable Mac package. Current source now defaults to Agent First product composition; `scripts/agent-first/run.sh` continues to launch original `--agents` with an isolated profile and disposable project.

Before H1 can be offered for human acceptance, on Mac arm64:

1. Build original native dependencies and launch the exact source. Verify a bare new-window action and explicit local folder-open API request produce original Agents windows/new-session folder intent; no general workbench renderer is created.
2. Try stale editor commands, keyboard/menu paths, generic file/workspace/diff/merge opens and restoration/development-host paths. Verify explicit unsupported errors or Agents behavior, never an ordinary editor renderer. The final native boundary must also reject non-Sessions configurations.
3. Verify the sign-in flow gets a false return-to-editor query and remains functional with a lawfully configured product-owned original provider/account path; no alternate product OAuth identity or personal cache. Missing provider/identity setup stays a blocker for real task acceptance.
4. Run actual native EH/VSIX activation/dependency probes, actual read/write/check/review/approval/stop/restart tasks, multi-session behavior and Chinese IME. Compare original read-only review and necessary Agent configuration against editable code-file entrances. Produce a source-matched Mac artifact and ask the user to perform H1 only after required engineering gates.

For now, unqualified positional CLI/file/workspace/remote opens without the dedicated Agents path are explicitly unsupported, not silently reinterpreted. Use original `--agents /project` / the launcher for an explicit initial project. Multiple-folder and cross-window diff/editor workflows are not added. Existing general text/settings/keybinding panes and editable-file/new-file routes **within** an Agents window still need review/scoping; this change closes general **window launch** routes, not every in-window editor operation. Full editor-only/module/service exclusion, real task, native/Mac package and user confirmation remain pending. H2–H4 and M1/M2 historical account/Mac gates do not become passed.
