# H1 iteration 4 — original file review and writable Agent APIs

**Engineering checkpoint only. H1 is not ready for human acceptance; H1–H4 have no human pass.** Parent/source baseline: `183ae252f1d422520e9cbf50cb5b5488e06758f7`; exact source is the commit adding this evidence directory, on `codex/agent-client-implementation`, draft [PR #2](https://github.com/MorCherlf/vscode/pull/2). Existing Host/auth/protocol work and inactive DSH preparation are retained. No merge, release or Mac package.

## Actual implementation

Original `AbstractTextEditor` combines its existing input/provider readonly flag with a small product-gated review policy; no component is copied. In Agent First, original file/text/diff panes are view-only, with exact current/default Profile settings/keybindings/tasks/MCP/language-model resources and normalized Profile prompts descendants remaining editable. A project file called `settings.json` or `AGENTS.md`, another scheme/authority, a sibling prefix or a parent traversal does not gain a Profile exception. A diff does not gain the modified Profile resource's exception. Profile switches re-evaluate open text panes. Original provider readonly is combined, never relaxed.

Original ChatWidget/InputPart are not file-review panes and remain editable. The ordinary product (`agentFirst=false`) keeps its original behavior and service graph. File/model write capability is unchanged: Agent-facing BulkEdit/TextFile/FileService APIs can still modify and save files. This is a view policy, **not filesystem confinement, approval enforcement, an OS security boundary or a claim that every manual mutation command has been audited**. Save As, rename/delete, custom resource editors and remaining command surfaces require further scope review. Workspace-local configuration/instructions outside canonical Profile resources currently open as read-only; this is an explicit limitation, not an extension-based exception.

The original New Untitled command/keybinding, scratch comparison and writable-toggle actions are not registered for Agent First. New Text File menu entries and Files-tab New File/Cmd+N/double-click paths are omitted. The original Files tab, file search/Open File, text/diff rendering and Agent configuration remain. Existing Files accessibility help describes the review policy instead of advertising the removed New File action. No replacement chat UI, API subset, DSH business logic or sessions reverse dependency was introduced.

## Reproducible validation

Linux x64, ordinary Node 24.22.1; original source 1.145.0. Browser **141.0.7390.37** via explicit `AGENT_FIRST_CHROMIUM` fallback, **not upstream pinned 149, Electron, WKWebView or Mac**. Fresh ephemeral browser profile only; no personal cache or account credentials. Existing Node/native/SDK handshake evidence was not rerun or upgraded into a real-task result.

```sh
npm run build-fast -- --client-only
node node_modules/@typescript/native/bin/tsc -p src/vs/sessions/tsconfig.agent-first.json
# Use an installed Chromium executable; record its version.
export AGENT_FIRST_CHROMIUM=/path/to/headless_shell
node scripts/agent-first/browser-tests.cjs --browser chromium --runList docs/agent-client/evidence/AF/H1/2026-10-30-review-policy/raw/test-list.txt --stall-timeout 45
node scripts/agent-first/web-smoke.mjs --probe-extensions
node scripts/agent-first/web-smoke.mjs --probe-extensions --legacy-editor-routes
node node_modules/@typescript/native/bin/tsc -p docs/agent-client/evidence/AF/H1/2026-10-30-review-policy/raw/test-types.json
GOMEMLIMIT=1000MiB npm run valid-layers-check
```

| Evidence | Result / boundary |
| --- | --- |
| `raw/build.log`, `raw/types-source.log` | Incremental original client transpile and targeted common/web/desktop source typecheck pass (empty type log is exit 0). Not full product/native/Mac compilation. |
| `raw/unit-final.log` | **47 passing**: 4 new review-policy tests and 43 original Sessions editor contribution tests. Scope, traversal, scheme/authority, diff, ordinary product and Profile switch; original file search, focus/keyboard/actions and double-click behavior. Unit service fixtures, not real tasks. Some original isolated action-layout tests deliberately register their own New File fixture; product absence is separately checked by real runtime registry probes. |
| `raw/original-current.log` | Actual original Sessions DI + Worker EH fixture. Original ChatWidget/InputPart instantiated and physically typed `CHAT_INPUT_MARKER`; writable original FileService provider opened in original TextFileEditor, input capability remains writable but UI readonly; physical project typing has no effect. Original BulkEdit applies and original TextFile save persists the synthetic write. Six Profile resources/paths open editable; instruction input physically typed. Project `settings.json` remains readonly. Removed commands and three menu registrations absent. Original diff and prior editor-route/admission checks pass. |
| `raw/original-ordinary.log` | Same runtime workload with test-only `agentFirst=false`: project UI is writable and physical keyboard marker appears; commands and menu entries present. Original ChatInput/Profile editing/API write/diff/EH remain operational. Not a different product release or native comparison. |
| `raw/lint.log`, `raw/layers.log`, `validation.json` | Targeted lint of nine TS files and full module/layer checks pass (exit 0); explicit statuses in validation. |

The runtime fixture uses the **original** InMemoryFileSystemProvider, FileService, TextFileEditor, BulkEditService, TextFileService and original UI controls. It is not an alternative workbench service implementation. It simulates an API edit, **not an Agent tool call, approval, model task or real provider compatibility**. Chat fixture renders the actual original widget with original DI, sends no request and does not bypass the existing sign-in/task gate. Worker EH uses explicitly admitted test-only extension IDs in the diagnostic product; production executable admission remains empty.

Raw failed development attempts are retained: invalid async accessor use fixed by capturing services synchronously, an invalid DOM `.readonly` assertion replaced with the original control's options, initial test selector, teardown ordering and unavailable base Profile persistence fixture corrected. The Profile switch test now uses original `toUserDataProfile` and `UserDataProfileService`, not an invented persistence service. Initial ad hoc test typechecks omitted ambient declarations/Node assertions or introduced incompatible Node timer globals. The final reproducible `raw/test-types.json` includes original assertion declarations without Node timer globals, and passes with an empty `raw/types-tests-final.log` (exit 0); no declarations were fabricated. These failures are not counted as passes.

## Mac/native demo handoff — not executed

Use the exact commit containing this directory, preserving existing checkouts and personal profiles. With repo `.nvmrc`, upstream Xcode/Python/native prerequisites and network setup:

```sh
npm ci
npm ci --prefix build
npm run build-fast -- --client-only
npm run electron
bash scripts/agent-first/run.sh
```

This is an original Electron **development source launch**, not a packaged/signed Mac candidate. Use upstream Electron ABI rebuild instructions if a named native module fails. Do not reuse standalone Host node_modules/ABI. The launcher creates a dedicated disposable project/profile/extension directory and starts original `--agents` mode. See [historical native IPC limitation](../2026-10-30-editor-routes/README.md); the browser does not verify native windows.

On Mac, demonstrate original Files search → open test `sum.js` → typing rejected with original readonly explanation, no New File/untitled shortcut or double-click; Profile settings/instructions editable, original chat typing/paste/multiline/Chinese IME usable. With a lawful dedicated configured original Agent provider (not a fixture), request read → fix `sum.js` → run `npm test` → readonly diff, then approval/rejection/stop/restart/multi-session. Do not admit mixed/built-in extensions before full activation/import/dependency audit. Do not borrow Copilot product identity or import personal caches. No credentials were configured or tasks run here.

## Gate status / next work

AF-01 partially runtime exercised in a browser; AF-02 partial trimming and negative Worker EH evidence, **not complete startup/service/worker exclusion**. Native EH/VSIX, real account/task, native window routing/restore, Mac arm64 candidate/IME/accessibility and human acceptance remain pending. AF-03–06 unchanged; DSH inactive; H2/H3 not claimed. M1/M2 account/Mac/WKWebView/Keychain pending gates unchanged. Signing/notarization/publication unperformed.

Continue [H1 NEXT](../NEXT.md) before claiming a runnable Mac acceptance delivery. Keep each human gate separate and leave confirmation to the user.
