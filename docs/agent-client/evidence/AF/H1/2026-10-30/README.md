# H1 iteration 2 — original contribution trimming and Worker Extension Host

2026-10-30. **H1 remains engineering in progress / pending Mac build and verification. Not ready for human acceptance; no H1–H4 human acceptance recorded.** [Human gates](../../../../HUMAN_ACCEPTANCE.md) remain unchanged. H2 is not a prerequisite for this delivery; DSH source/configuration/evidence from `de85d95570b43e1dbd5fc0674817ef929804d243` is preserved and unmodified.

## Source and environment

Parent is `de85d95570b43e1dbd5fc0674817ef929804d243`, branch `codex/agent-client-implementation`, draft PR #2, base `codex/agent-client-roadmap`. The commit adding this evidence directory identifies this iteration exactly. No application/package publication or merge.

The old `/workspace/scratch/11910be6d76c/vscode-restored` checkout was absent. Initial execution at that cwd failed with `exec-server rejected request (-32603): No such file or directory (os error 2)`; execution at `/` succeeded. A bounded directory inventory found no surviving vscode checkout (unrelated repositories were not reused). Restored the already-pushed implementation branch into the new empty `/workspace/scratch/11910be6d76c/vscode-h1-continued` using `git clone --filter=blob:none --single-branch --branch codex/agent-client-implementation https://github.com/MorCherlf/vscode.git ...`. Initial HEAD and remote both matched the parent above; initial status was clean. **This restores committed files, not lost uncommitted work.** Runtime skill was read; its environment-status tool and `/etc/codex/network-policy.json` are unavailable, so no secret-readiness claim follows from this environment.

Linux x64, ordinary Node 24.22.1. Original browser components run in **Chromium 141.0.7390.37**, explicitly selected from Playwright 1.56.1's headless-shell. Upstream pinned Chromium149 download again returned invalid/truncated ZIP; no pinned-browser/Mac/WKWebView claim. No real model/account credentials were consumed, and no personal VS Code cache was read.

## Actual implementation

- Removed original notebook, interactive-window, REPL, Search Editor and inline-completion contribution barrels from **Sessions only**. Original general workbench entry and upstream feature source files are retained. This removes their editor pane/action/startup registrations rather than merely hiding a menu.
- Added `services/notebook/browser/notebookServices.ts`: registers the **original** delayed Notebook services and interactive document/history services required by chat attachments/edit models and the original Extension Host notebook API. It does not copy their implementations or register notebook editors, execution/debug UI or REPL. Original service descriptors and class names are checked at runtime. Descriptor registration is not proof that a service instance or worker was never created; some Notebook widget/model modules remain shared dependencies and still evaluate.
- Replaced inline-completion rename tracking with the existing upstream `NullRenameSymbolTrackerService` (also used by the standalone editor). No new null API/reducer or copied component is introduced.
- `composition-check.mjs` checks actual resource requests and original registries: a scoped set of ten excluded startup modules is absent; Notebook/interactive/REPL/Search Editor panes and selected execution commands are absent; original text diff pane and original delayed Notebook service remain. This is a scoped regression contract, **not complete AF-02 exclusion**.
- `extension-probe.mjs` instantiates the original `SessionsBrowserMain`/DI and original Worker EH. Four synthetic test extensions are supplied through the original web embedder's `additionalBuiltinExtensions`. A test-only product instance admits `h1-fixture.control` and `h1-fixture.dependent`; the real product's empty executable allowlist is unchanged. The editor-only and mixed-tool samples declare Agent support and user overrides; the admitted dependent requires the denied editor-only sample. No proposed API or DSH identity is enabled.
- The probe explicitly emits `*`, `onStartupFinished`, `onLanguage:agent-first-fixture` and `onCommand:agentFirst.fixture.denied` through the original Extension Service. All four manifests are scanned, **only control's executable file is requested**, and only control activates. Its `require('vscode')` and registered `vscode.commands` command actually execute in the original Worker EH and return `control`. This is stronger than a manifest unit test, but is **Web Worker EH with synthetic extensions**, not native Node EH or arbitrary VSIX compatibility.
- Through original `IModelService`/`IEditorService`, a synthetic in-memory before/after pair opens in original `workbench.editors.textDiffEditor`, waits for diff computation and reports `readOnly: true`. Screenshot and values are retained. This verifies rendering/routing survived trimming; it is **not an Agent-produced edit or a real task**. Test resources/disposables are owned by the fixture page.
- Added repeatable A/B runner and targeted TS project. Test server supports `.mjs`/HTML/WASM MIME types, bounded extension probe waits, token redaction and owned-process cleanup. No React UI changes or handwritten vscode API subset.

## Matched A/B evidence

`compare-startup.mjs` reads the exact parent Sessions entry using `git show`, transpiles it to a temporary file, and serves that one pinned entry for baseline only. All other outputs, browser, test admission, original Worker EH and diff workload are the same. Temporary baseline output is removed afterward; no source checkout/reset or second component implementation is created. **The old baseline must fail the new exclusion assertions**, providing a positive control for the negative test.

| Same workload | Parent entry | Current entry |
| --- | ---: | ---: |
| JS resource requests | 4,993 | 4,901 |
| Worker URLs observed | 3 | 3 |
| Exclusion/probe command exit | **1, expected exclusion assertion** | **0** |

93 previous resources disappear and one original-service composition module is added: net **92 fewer requested JS modules**. Full lists, source hash and logs are in `raw/comparison.json`, `baseline-resources.json`, `current-resources.json`, `baseline-expected-failure.log` and `worker-eh-and-diff.log`. This measures resource requests during this workload, **not bundle size, evaluated-module count, service-instance count, memory or performance**. Initial no-EH captures were 4,870 → 4,778; those cannot be mixed with these later EH/diff captures. Worker count did not decrease.

## Commands and actual results

```sh
# Fresh restore had no dependencies or outputs; no existing build task was replaced.
npm ci --ignore-scripts
npm ci --prefix build --ignore-scripts
npm run build-fast -- --client-only
node node_modules/@typescript/native/bin/tsc --project src/vs/sessions/tsconfig.agent-first.json
npm run eslint -- src/vs/sessions/sessions.common.main.ts src/vs/sessions/services/notebook/browser/notebookServices.ts
node test/unit/node/index.js --run src/vs/workbench/services/extensions/test/common/extensionManifestPropertiesService.test.ts
AGENT_FIRST_CHROMIUM=/path/to/headless_shell node scripts/agent-first/browser-tests.cjs --browser chromium --runList docs/agent-client/evidence/AF/H1/2026-10-30/browser-tests.txt --stall-timeout 45
AGENT_FIRST_CHROMIUM=/path/to/headless_shell node scripts/agent-first/compare-startup.mjs /tmp/h1-comparison-new
AGENT_FIRST_CHROMIUM=/path/to/headless_shell node scripts/agent-first/web-smoke.mjs --probe-extensions
```

| Check | Result / boundary |
| --- | --- |
| Client cold build + incremental trim | PASS; transpile/resources, not full typecheck |
| Targeted composition graph | **PASS, exit 0**, TS7.0.2, strict upstream settings and inherited skipLibCheck=true; all source ambient declarations included. An initial temporary config omitted ambient Monaco/DebugProtocol declarations and failed; corrected committed config does not omit them. This is not full `typecheck-client` |
| Targeted lint / `node --check` / diff whitespace | PASS |
| Original input + ChatWidget + session-list suites, batched | **590 passing, 4 pending**, original browser test mocks; all 4 pending remain pending |
| Manifest service suite | **46 passing** |
| Actual Worker EH probe + actual original diff + scoped module/registry assertions | **PASS**; synthetic extensions and in-memory models, no model task |
| `npm run valid-layers-check` | **NOT PASS: killed, exit 137**, raw log/status retained. Earlier attempt warned about unsettled top-level await in its async compiler API. No completed global layer verdict; targeted import lint and scoped typecheck are separate evidence |
| Independent M1 mock Host build/discovery | PASS; ordinary Node/native components rebuilt, original window discovers Host. Original sign-in modal remains. No task sent |
| Current Unix socket capability | **EPERM**, raw current probe retained; original desktop cannot use required single-instance Unix IPC here. This run did not recreate the old Electron window experiment or claim native UI success |

M1 dependency rebuild first failed because node-gyp header extraction called unsupported `fchown` in this executor. Recovery downloaded the same official Node24.22.1 headers with curl and extracted with Python's `tarfile` data filter, then rebuilt against `--nodedir=/tmp/h1b-node-headers/node-v24.22.1`. Raw failure and successful rebuild/build reports are retained. Temporary paths are evidence of this Linux run, not Mac paths.

The original `sessionsAuthGate.ts` deliberately enforces sign-in on Web. An exploratory optional-auth mock did not make that modal dismissible; those temporary fixture changes were removed and the existing protected M1 fixture was restored/rebuilt. **No account gate, approval or provider identity was bypassed.** There is no `--fixture-task` option; unknown smoke options fail explicitly. The Web EH/diff test can run with no Host while its window gate is unresolved; that does not grant a model/account or permit a real task.

## Mac arm64 build/verification handoff — not executed

Use this exact iteration commit, repo Node24.22.1, Python3.12+ and Xcode command line tools. Use clean platform-specific dependencies; do not copy this Linux `node_modules`. The following dev-build recipe includes the Electron header workaround and native modules; it is **unverified Mac instructions, not a delivered Mac .app**:

```sh
npm ci --ignore-scripts
npm ci --prefix build --ignore-scripts
npm run electron
H1_HEADERS_DIR="$(mktemp -d)"
curl -fL https://artifacts.electronjs.org/headers/dist/v43.8.3/node-v43.8.3-headers.tar.gz -o "$H1_HEADERS_DIR/headers.tar.gz"
python3 - "$H1_HEADERS_DIR" <<'PY'
import sys, tarfile
with tarfile.open(sys.argv[1] + '/headers.tar.gz') as archive:
    archive.extractall(sys.argv[1], filter='data')
PY
cp build/npm/gyp/custom-headers/* "$H1_HEADERS_DIR/node_headers/include/node/"
npm rebuild @vscode/sqlite3 @vscode/spdlog @vscode/native-watchdog @vscode/policy-watcher @vscode/fs-copyfile @vscode/deviceid @parcel/watcher node-pty native-keymap --nodedir="$H1_HEADERS_DIR/node_headers"
npm run build-fast -- --client-only
bash scripts/agent-first/run.sh
```

The pinned Electron header version is 43.8.3 from this source's `.npmrc`; review/update it with upstream, not independently. Record missing native modules/toolchain or ABI errors accurately; do not mark this recipe compiled just because Linux checks pass. The launcher creates a fresh profile/extensions directory and a disposable broken-sum test project. Original model/provider authentication and executable-extension audit/admission still need completion; the commands alone do not make H1 ready for real tasks.

For native EH, rerun the four fixture scenarios with actual native/VSIX loading and original APIs. For H1 task acceptance, use a safely configured dedicated original provider to read → modify → run checks → inspect original read-only diff, then exercise stream/stop/approve/reject/restart, session switching and Chinese IME. No personal cache import, pasted account token or third-party OAuth application identity. Capture actual activation/module/worker/service evidence and a source-version-matched Mac artifact. H1 is offered to the user only after required engineering gates; user confirmation alone records human acceptance.

## Remaining / next

[H1 NEXT](../NEXT.md) tracks the remaining full editor-only classification, native EH, real provider task and Mac package. Current final workload still requests 205 Monaco editor-contribution resources and 211 debug/notebook/testing/search candidate resources; these are **candidates**, not automatically all editor-only. Some are necessary original API/model/diff dependencies. Remaining general text/configuration/editor panes also appear in the registry report, and the original “Open in Editor” route is still visible. These are explicit remaining H1 scope, not a completed Agent-only shell. No full exclusion/worker/service gate or performance goal is marked passed. DSH H2/H3 remains inactive preparation; M1/M2 account/Mac gates and signing/notarization/publication gates remain open.
