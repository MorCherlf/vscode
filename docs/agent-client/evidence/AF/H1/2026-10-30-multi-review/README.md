# H1 iteration 6 — original multi-file review; native handoff

**H1 remains engineering in progress, not ready for human acceptance. Manual platform/account input is now required for the native/real-task gate.** Parent `e6927023c49b0c4c8573a2145a0490a73b16a01e`; exact source is the commit adding this directory. Same implementation branch and draft PR #2; no merge/release/Mac artifact. Prior Host/auth/protocol/DSH preparation retained and DSH inactive.

## Implemented and actually run

- Agent First Sessions no longer loads the original standalone Merge Editor contribution/view or registers its pane. Ordinary product control retains it through original dynamic import; no component is copied. Shared merge algorithms needed by Agent edits are not deleted. Original multi-file and ordinary text diff review remain.
- Original MultiDiffEditorInput now combines its source readonly with the product review flag, using the same original readonly explanation as text panes. Readonly is applied after editor/diff configuration, so configuration cannot relax a source or product restriction. Underlying model/file APIs and original save/revert logic are unchanged.
- Actual original Multi Diff pane/control opens writable FileService fixture resources: Agent First's embedded modified editor reports readonly and physical keyboard input has no effect; ordinary product reports writable and the same marker appears. A deliberately false `diffEditor.readOnly` input does not bypass policy. Original ChatWidget/InputPart keyboard input, Profile editing, FileService lifecycle, BulkEdit save, diff, Worker EH and ten-command rejection checks also pass in the same runs.
- A narrow `preflight.mjs` reports only source identity, platform, public product flags, compiled-output presence and an owned temporary Unix socket probe. It never reads account credentials/caches, launches a model/task or claims native execution/acceptance. Current cloud probe returns **Linux x64 / IPC EPERM / exit 2**. Dirty=true in the raw report accurately identifies this iteration before commit; no historical commit is presented as the full tested source.

## Reproduction / evidence

```sh
npm run build-fast -- --client-only
node node_modules/@typescript/native/bin/tsc -p src/vs/sessions/tsconfig.agent-first.json
export AGENT_FIRST_CHROMIUM=/path/to/headless_shell
node scripts/agent-first/browser-tests.cjs --browser chromium --runList docs/agent-client/evidence/AF/H1/2026-10-30-multi-review/raw/test-list.txt --stall-timeout 45
node scripts/agent-first/web-smoke.mjs --probe-extensions
node scripts/agent-first/web-smoke.mjs --probe-extensions --legacy-editor-routes
npm run eslint -- src/vs/sessions/sessions.common.main.ts src/vs/workbench/browser/parts/editor/textEditorReviewPolicy.ts src/vs/workbench/contrib/multiDiffEditor/browser/multiDiffEditorInput.ts
GOMEMLIMIT=1000MiB npm run valid-layers-check
node scripts/agent-first/preflight.mjs
```

| Raw report | Result / scope |
| --- | --- |
| `raw/build.log`, `raw/types-source.log` | Incremental original client build and common/web/desktop source types pass; no full/native/Mac build claim |
| `raw/unit.log` | **19 passing**, original MultiDiff input/configuration and review-policy suites; browser runner's ordinary default product, explicit review-policy service fixture |
| `raw/original-current.log`, `raw/original-ordinary.log` | Actual original composition/panes/controls and real keyboard input, original writable-provider API fixtures; original standalone Merge pane/module exclusion/control asserted. Chromium **141.0.7390.37 explicit fallback**, not pinned149, Electron/EH or Mac |
| `raw/lint.log`, `raw/layers.log`, `validation.json` | Targeted lint, layer check and explicit final statuses; prior 77/47/component/manifest results remain historical, not newly counted |
| `raw/native-preflight.json` | Fresh Unix IPC EPERM and non-Mac platform, **expected blocked exit 2**; not a failed model/auth test or native window run |

No model request, real account, approval/tool task, native Electron/EH/VSIX, Mac build/IME/VoiceOver/Keychain/WKWebView or human acceptance was performed. Fixture writes are not real Agent edits. Native socket success on another machine would prove only the socket prerequisite.

## Why manual input is required now

See [MANUAL_INTERVENTION](MANUAL_INTERVENTION.md) for concrete actions. The selected executor is Linux x64 and cannot create the original app's Unix IPC socket. This thread has no native Mac executor; cross-compilation/typechecking/browser tests cannot satisfy original macOS window/EH/IME/packaging gates.

The original built-in GitHub authentication extension contains a fixed upstream client ID in `extensions/github-authentication/src/config.ts`. It is **not admitted** (production executable allowlist remains empty), and must not be enabled to borrow that product's identity. Earlier `MORCHERLF_GITHUB_OAUTH_CLIENT_ID` config belongs to the historical Tauri native account adapter; setting it does **not** configure the original VSC extension or prove H1 login. A product-owned OAuth registration/public client ID and safely configured dedicated eligible test account are needed before completing original-provider native authentication/task verification. No account tokens/secrets should be sent here.

Cloud work is not declared complete: custom/resource/group-drop/native restore and full task-time module/service/worker exclusion still need coverage. The remaining native/account input is required to exercise those real task lifecycles and produce a source-matched Mac candidate, not a reason to lower gates or mark H1 ready. Work may continue independently while these inputs are prepared; H2–H4 stay separate. Signing/notarization/publication unperformed.
