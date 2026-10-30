# H1 — native enablement product-admission fix

**Source fix and Linux regression evidence; corrected native EH must still be revalidated on Mac. H1 remains engineering in progress, not ready for human acceptance.** Parent is the user's documentation commit `a40ddffacee049ed650bde1d77ec782b345af270`, integrated by fast-forward without resetting existing work. Exact fixed source is the commit adding this directory, on the same implementation branch / draft PR #2, base `codex/agent-client-roadmap`. No merge/publication.

## Imported Mac result and actual defect

[Mac native report](../2026-10-30-mac-native/README.md) remains unchanged and attributed to product source `0bec73fa99db00cb1bcccadf71326f5c72adc8b2`: macOS27.2 arm64 / Node24.22.1 / Electron43.8.3; original complete build, IPC, Sessions window/native EH, Chinese multiline DOM paste and one readonly file path passed. It was a source launch, not an independent package. No account login, personal auth cache or real model task. Five absent paths among 5,445 controlled-reload resources do not prove full task-time loading exclusion.

The same report's native EH actually activated `GitHub.copilot-chat` with the empty product executable list. This is a product source failure, not Linux IPC or missing OAuth. Original `_isDisabledBySessionsWindow` returned early for builtin chat and workspace choices before the manifest check. The builtin activation is reproduced native evidence; saved-workspace and development paths below are source/service regressions, not claimed external VSIX reproductions. [Imported checksum verification](mac-evidence-integrity.json) confirms the original record/assets are retained; it is not a new Mac test.

## Actual implementation

- Reuse one product-admission predicate in the original manifest service, independent of general capability/configuration heuristics. No duplicate ID matcher/parser or new user setting/admin policy.
- Original ExtensionEnablementService enforces it at the start of `_computeEnablementState`, before cached/cyclic placeholders, builtin chat, workspace enable, auto-enable, configuration/capability overrides and environment enable flags. Rejected executable code is `DisabledByEnvironment`, not a user-enableable workspace preference.
- Original `setEnablement` rejects enabling a denied extension, including recursively included dependency/pack requests, before storing choices. Existing dependency state evaluation blocks admitted direct/transitive/cyclic dependents of rejected code.
- Original Extension Service's development-extension shortcut is retained only when Sessions has no product admission policy (or outside Sessions). With policy configured, development descriptors also go through original enablement/dependency evaluation; `ignoreWorkspaceTrust` cannot bypass the product ceiling.
- Unconfigured products retain original builtin-chat/workspace/auto-enable/development behavior. Outside Sessions remains unchanged. Exact admitted IDs remain subject to original settings/enablement; declarative themes keep original rules. **Actual product executable list stays empty**. No mixed Copilot/editor package was admitted, no proposed API globally enabled, no OAuth identity borrowed, no Agent tool/file API or model approval changed.

This is an existing product capability boundary in original workbench enablement, not a new SDK/runtime enterprise permission or configuration-policy schema. No policy-data generation/schema change applies. The new narrow internal enablement predicate and fixture double are not a hand-written `vscode` API.

## Regression proof and commands

Linux x64 / Node24.22.1. Browser tests and original Worker EH probe use Chromium **141.0.7390.37 explicit fallback**, not the Mac report's Electron Chromium150 or pinned149. No real Copilot extension/model/task executed in these tests.

```sh
npm run build-fast -- --client-only
node node_modules/@typescript/native/bin/tsc -p src/vs/sessions/tsconfig.agent-first.json
node node_modules/@typescript/native/bin/tsc -p docs/agent-client/evidence/AF/H1/2026-10-30-native-admission-fix/raw/test-types.json
export AGENT_FIRST_CHROMIUM=/path/to/headless_shell
node scripts/agent-first/browser-tests.cjs --browser chromium --run src/vs/workbench/services/extensionManagement/test/browser/extensionEnablementService.test.ts --stall-timeout 45
node scripts/agent-first/browser-tests.cjs --browser chromium --run src/vs/workbench/services/extensions/test/browser/extensionService.test.ts --stall-timeout 45
node test/unit/node/index.js --run src/vs/workbench/services/extensions/test/common/extensionManifestPropertiesService.test.ts
node scripts/agent-first/web-smoke.mjs --probe-extensions
node scripts/agent-first/web-smoke.mjs --probe-extensions --legacy-editor-routes
GOMEMLIMIT=1000MiB npm run valid-layers-check
```

| Raw evidence | Actual result / boundary |
| --- | --- |
| `raw/service-red-initial.log` | Before product-source fix, actual enablement class admits builtin chat and saved-workspace/mixed/cyclic fixtures. Initial run has 2 passes/8 failures; three failures were fixture `enableExtensions` interfering with disable controls, not additional product vulnerabilities. These fixture errors were corrected rather than counted as source defects. |
| `raw/service-first-fix-failures.log` | First enforcement attempt fixed state evaluation but setter rejection tests still failed; final code also guards enable requests. Contains the same fixture-control failures, recorded explicitly. |
| `raw/service-final.log` | **154 passing** full original ExtensionEnablementService suite, including **11 new service regressions**: builtin chat main/browser with empty/absent policy (also capability override false), saved workspace enable, true/list auto-enable, configuration override, environment force-enable after user disable, admitted/transitive/cyclic dependencies, declarative resources, case-insensitive IDs, user disable ceiling, development/ignore-trust filtering and legacy controls. Real service and original storage/config/dependency logic; synthetic manifests/management services, not a launched native EH or external VSIX. |
| `raw/extension-service.log`, `raw/manifest.log` | **11 original Extension Service tests** and **46 manifest tests** pass, separately scoped. Manifest helper tests alone are not the native-bypass fix proof. |
| `raw/original-worker-current.log`, `raw/original-worker-control.log` | Actual original Sessions DI and Worker EH load only the admitted synthetic control. Startup/language/command **and newly added chat-participant activation event** requests do not load rejected/mixed/dependent fixtures. Original chat input/Profile editing, file/multi-diff review, file API/BulkEdit lifecycle and command-route/composition checks pass. Browser Worker EH remains different from native EH; builtin-chat role is explicitly covered by the service regressions, not presented as a real Copilot Worker test. |
| `raw/build.log`, `raw/types-source.log`, `raw/types-tests.log`, lint reports, `raw/layers.log` | Targeted build/source+test types/lint/full layer checks pass; empty type logs mean exit0. A missing test-double implementation discovered by typing was fixed; initial report retained. No new dependency install or full Mac build. |

One development browser attempt with an unnecessary test-only default-chat identity injection failed physical Profile typing (`raw/fixture-focus-failure.log`); asynchronous sign-in/focus interference was suspected, not proven. The injection was removed. Original sign-in gates were not hidden/dismissed/relaxed to make it pass. Final probes retain the original product identity, never send a prompt, and pass. All original native results remain separately scoped; no native fix pass is inferred.

## Native call chain / continued loading work

Original native initial EH data provider calls `checkEnabledAndProposedAPI(..., ignoreWorkspaceTrust=true)` → `filterEnabledExtensions` → original enablement states. Both development shortcut and ordinary state calculation are now governed before enablement can admit executable code. The service regression invokes that same exported filter with `ignoreWorkspaceTrust=true`, including a development dependency cycle. No reverse sessions import was added.

The original loading probe now explicitly requests a chat-participant activation alongside startup/language/command events while retaining a positive executable control. This continues AF-02's deterministic loading work; it does not prove full native task-time module/service/worker exclusion. No editor-only extension, builtin or mixed package is waived merely for contributing Agent capabilities. DSH stays inactive; H2–H4 separate.

## Required Mac follow-up — no OAuth needed for this fix

Use the exact delivered fixed SHA in the existing Mac checkout if clean, preserving local dependency/output caches; otherwise create a separate worktree with its own dependencies. Fetch/fast-forward without resetting local changes, verify HEAD, run `npm run build-fast` and reuse/check `npm run electron` as in the [original Mac report](../2026-10-30-mac-native/README.md). Launch a **fresh isolated test profile and disposable project** with the original launch skill/controller approach. Do not use a profile from another running product or import credentials. No account login/model request is necessary.

Confirm renderer Sessions=true / Agent First=true / executable list=[] / development=false, original Sessions window and native EH actually start, original Chat draft and readonly file path still work. Reproduce the original new-chat/input path that triggered `onChatParticipant:github.copilot.editsAgent`, then inspect **that run's** complete native EH startup/activation log for rejected executable extensions, especially `GitHub.copilot-chat`. Empty/truncated logs, a non-started EH or an unexercised path do not establish success. If original UI depends on missing contributions, collect that failure; do not re-admit the whole mixed extension to restore it.

Add a separate external executable VSIX saved-EnabledWorkspace/auto-enable negative case when native test packaging is available; current service fixtures are not that manual reproduction. Preserve source SHA, flags, same-run log provenance, UI/function outcomes and resource/worker scope. Keep the old failed native record; write new evidence instead of editing its status.

H1 is **not ready for human acceptance**. Remaining native window/restore/resource/group-drop paths and full load attribution, original provider-owned auth/dedicated real tasks, system IME, independent Mac arm64 package and human acceptance stay pending. Product-owned OAuth/real tasks remain a separate gate and do not block this source fix or native no-account regression. M1/M2 account/Mac/Keychain/WKWebView and signing/notarization/publication gates are not promoted.
