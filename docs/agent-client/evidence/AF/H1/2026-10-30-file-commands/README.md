# H1 iteration 5 — original manual file-command admission

**Engineering checkpoint only; H1 not ready for human acceptance.** Parent `04337e455b2a53abbcdc695220c6c49e972e2dc5`; exact source is the commit adding this directory on `codex/agent-client-implementation`, draft [PR #2](https://github.com/MorCherlf/vscode/pull/2), base `codex/agent-client-roadmap`. No merge, publication or Mac artifact. Existing Host/auth/protocol and inactive DSH work retained. H2–H4 remain separate.

## Actual code

The product's `agentFirst` switch now excludes registration of ten original manual mutation commands, their keyboard bindings and associated File/Explorer/editor/command-palette menu entries. The original handlers and file APIs are retained for other products/programmatic work, not copied or replaced. Normal save, read/open/search/compare and copy commands remain.

| Command IDs | Product behavior |
| --- | --- |
| `workbench.action.files.saveAs`, `workbench.action.files.newFile` | No manual Save As/new-file dialog registration |
| `explorer.newFile`, `explorer.newFolder`, `explorer.upload` | No Explorer create/import registration |
| `renameFile`, `moveFileToTrash`, `deleteFile` | No manual rename/delete registration |
| `filesExplorer.cut`, `filesExplorer.paste` (including `^` paste binding) | No manual Explorer move/paste registration |

`FileDragAndDrop` uses original injected IProductService to disable drag-over despite `explorer.enableDragAndDrop=true`, and rejects a stale native drop directly before target lookup or file operations. It does not depend on menu visibility or reconfigure the user's settings. Ordinary products keep original behavior. Original ChatWidget/InputPart, Profile text editing and file/diff review stay intact.

This is a **UI/command capability reduction**, not an OS sandbox, filesystem permission policy or approval implementation. FileService/BulkEdit/TextFile APIs retain writes. Agent permissions and side effects remain owned by original Agent services; no tool requests are redirected to fake handlers or silently approved. No new UI, React components, API shim, DSH business logic or borrowed credentials were introduced.

## Commands and results

Linux x64; Node 24.22.1; original source 1.145.0; Chromium **141.0.7390.37 explicit fallback**, not pinned149, native Electron/EH, Mac or WKWebView. Original real runtime services with ephemeral fixture files/profile; no real account/model request.

```sh
npm run build-fast -- --client-only
node node_modules/@typescript/native/bin/tsc -p src/vs/sessions/tsconfig.agent-first.json
node node_modules/@typescript/native/bin/tsc -p docs/agent-client/evidence/AF/H1/2026-10-30-file-commands/raw/test-types.json
export AGENT_FIRST_CHROMIUM=/path/to/headless_shell
node scripts/agent-first/browser-tests.cjs --browser chromium --runList docs/agent-client/evidence/AF/H1/2026-10-30-file-commands/raw/test-list.txt --stall-timeout 45
node scripts/agent-first/web-smoke.mjs --probe-extensions
node scripts/agent-first/web-smoke.mjs --probe-extensions --legacy-editor-routes
npm run eslint -- src/vs/workbench/contrib/files/browser/fileActions.contribution.ts src/vs/workbench/contrib/files/browser/fileCommands.ts src/vs/workbench/contrib/files/browser/fileActions.ts src/vs/workbench/contrib/files/browser/views/explorerViewer.ts src/vs/workbench/contrib/files/test/browser/explorerView.test.ts
GOMEMLIMIT=1000MiB npm run valid-layers-check
```

| Raw evidence | Result and boundary |
| --- | --- |
| `raw/build.log`, `raw/types-source.log`, `raw/types-tests.log` | Incremental original client build, targeted common/web/desktop and focused original test types pass; empty type logs mean exit 0. Not Mac/native/full product build. |
| `raw/unit-final.log` | **77 passing**, no pending: 76 original Files/Explorer action/search/reveal/name tests and one injected-product drag-over/stale-drop regression. Normal original handler algorithms remain testable. The unit browser runner does not import this product's flags; an initial conditional test was pending, recorded in `raw/unit-initial-product-undefined.log` and not counted. Final test injects IProductService rather than mutating globals, and actually executes the Agent First branch with drag/drop enabled and no target roots. |
| `raw/original-current.log` | Original Sessions DI/Worker EH and ICommandService: **0/10 registered mutation commands, 0 bindings, 0 associated menu rows**, ten stale calls reject as command not found. Read/copy/normal-save remain registered. Original ChatWidget/InputPart keyboard input, readonly project typing, editable Profile inputs, original BulkEdit→TextFile save and diff pass. |
| `raw/original-ordinary.log` | Same original runtime with test-only flag false: **10/10 commands, 7 bindings, 13 menu rows** remain; project typing works; original ChatInput/Profile/BulkEdit/diff/EH checks pass. No destructive manual commands are invoked in this control. |
| Both runtime logs | Actual original FileService fixture creates → moves → copies → reads content → deletes own resources successfully, with all three paths absent afterward. These are synthetic API operations, **not a model/tool/approval task**. Production admission is unchanged/empty; Worker EH explicitly admits a synthetic control ID only in diagnostics. |
| `raw/lint.log`, `raw/layers.log`, `validation.json` | Targeted lint/syntax/layer checks and explicit final statuses. Previous unrelated checks are not counted as newly rerun. |

## Scope audit and remaining routes

| Original path | Finding / next boundary |
| --- | --- |
| `fileCommands.ts`, `fileActions.contribution.ts`, `fileActions.ts` | Product-gated registrations; shared file services, save and original handler implementations preserved. Runtime checks inspect actual registered IDs, not just source text or disabled menu contexts. |
| `views/explorerViewer.ts: FileDragAndDrop` | Actual class regression covers product guard with drag/drop enabled and direct late event; not a physical OS/native drag experiment. |
| `chatEditingSession.ts` | Original checkpoint delegate performs rename using its original file service; these command registrations are not that delegate. Synthetic FileService lifecycle/BulkEdit evidence confirms API preservation, not real Agent checkpoint correctness. |
| Original `editorDropTarget.ts` | Separate editor-group/resource-open drop path remains; not conflated with Explorer mutation drops. Original text review policy and prior window guards remain, but native drop/restore/file-open needs native execution. |
| Original `mergeEditor`/`multiDiffEditor` and custom resources | Still composed/shared as before. Resolver, writable merge/custom pane and Agent review workflow need explicit audit/tests. Empty executable extension admission is not proof every original pane is readonly. |
| Workspace-local Agent configuration/instructions | Outside exact canonical Profile exceptions remains readonly; no filename/scheme blanket permission was added. Required authoring needs an explicit trusted workflow rather than making arbitrary project files editable. |

## Mac/native handoff and human gates

Use the exact commit containing this evidence. With repo `.nvmrc`, upstream Xcode/Python/native prerequisites and clean dependency setup:

```sh
npm ci
npm ci --prefix build
npm run build-fast -- --client-only
npm run electron
bash scripts/agent-first/run.sh
```

This is original Electron **development source launch**, not a packaged/signed Mac candidate. The launcher creates dedicated project/profile/extension directories. Do not import personal caches or share standalone Host node_modules/ABI. Demonstrate original project file review, absence of the ten commands/shortcuts/menus, native Explorer drag/drop rejection if the original tree is reachable, original Files search and config/chat editing. With a lawful dedicated configured original provider, demonstrate real read→modify→check→review/approval/rejection/stop/restart/multi-session. A fixture cannot satisfy this task gate. Existing original task/sign-in gate is not bypassed.

H1 / AF-01/02 remain partial: native windows/EH/VSIX, remaining custom/merge/editor-group drop paths, complete task-time load/service/worker exclusion, real account/task and Mac arm64 artifact/IME/VoiceOver/human acceptance pending. Historical Unix socket EPERM still explains the native cloud limitation; it is not a new runtime pass. H2–H4/DSH and M1/M2 account/Mac/WKWebView/Keychain gates unchanged. No signing/notarization/release. Continue [NEXT](../NEXT.md); only the user's explicit confirmation can mark human passed.
