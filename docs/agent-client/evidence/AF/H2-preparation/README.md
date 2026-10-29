# Inactive H2 preparation — not an H2 delivery

Saved separately after H1 checkpoint `404134a07e84a35c67c99c5f3c12a6744e022e48` so begun work is durable. Product admission stays empty, no DSH proposed API product allowlist is enabled, and **extensionSessions contribution is not imported** by Sessions entry points. H1 remains priority. This is neither H2/H3 runtime compatibility nor human acceptance.

## Preserved implementation

- Product-owned `morcherlf.dsh-adapter` VS Code extension, independent `morcherlf-dsh` session type, original session item controller/content provider/chat participant and original history turn constructors. Exact proposal declarations: `chatSessionsProvider` + `chatParticipantPrivate`. No copied UI, webview chat, Copilot identity or API emulation. No global proposed API enablement.
- Ordinary Node process boundary to an isolated `packages/dsh-runtime`, own node_modules/home/profile and lock. Original `@deepseek-ai/dsh-sdk-client` **0.2.2-alpha.2**, original CLI transitive version checked at worker startup, source investigation pinned to **f3803c96974ad4a94195fb97e5c637e9c2a3afe3**. Original SDK `DeepSeekHarness.run` owns DSH loop, Cordis/profile/plugins; adapter does not reimplement it. No runtime/model was started in this checkpoint.
- Generic Sessions provider routes to original workbench `IChatSessionsService` controller and `IChatService` content/request path. No DSH imports in core/shared UI; workbench never imports Sessions. Quick chat only; workspace configuration/moves/forks/delete/model changes explicitly unavailable. Product session-type allowlist is separate from extension execution admission.
- Confirmed display projection is not DSH's canonical session log. On restore, original `session/resume` must succeed before displaying confirmed projection; unknown outcomes block new sends. This is not complete canonical history recovery. No guessed log parser.
- SDK has no per-session cancellation RPC. Cancel capability is explicitly false/unsupported; no empty cancel handler or killing a shared runtime as session cancellation. Full cancellation requires a public DSH-side Agent service driver in a later package.
- Projection persistence is serialized (concurrent creates previously shared a temporary file); initialization single-flight; running/unknown history reports incomplete; failures never resend prompts. Child stderr is drained privately, runtime errors mapped to narrow codes, bounded native JSON transport and owned-child stop ladder are preparation, not crash/backpressure integration acceptance.

## Actually run

| Command | Result | Boundary |
| --- | --- | --- |
| `npm install --prefix packages/dsh-runtime --ignore-scripts` | PASS; isolated locked SDK/CLI dependency tree | Installation only, no harness/model run |
| `npm run build --prefix extensions/dsh-adapter` | PASS TypeScript **6.0.2**, strict, skipLibCheck=false | Original stable/proposed declarations; no EH load |
| `node node_modules/@typescript/native/bin/tsc --project src/vs/sessions/contrib/providers/extensionSessions/tsconfig.check.json` | exit **0**, TS **7.0.2** | Targeted provider graph; inherits upstream skipLibCheck=true. Not full client typecheck, not runtime |
| `npm test --prefix packages/dsh-runtime` | **5/5 fixture tests** | Injected harness, NOT original DSH compatibility: concurrent persistence, resume call, unknown-result no replay/restart, busy/unsupported cancel, single-flight initialization |
| `npm run package --prefix extensions/dsh-adapter` | PASS, local VSIX **6.59 KiB** | Packaging only, no install/load/UI routing/runtime/tool validation; not published |

Raw results adjacent. Local ignored VSIX can be reproduced; its digest is in validation.json. There are no account tokens or personal caches in these artifacts.

## Before enabling / H2 next

Finish H1 native task/load-exclusion gates independently. For H2, audit this extension's complete activation/import/dependencies, implement provider refresh/disposal/reconciliation and targeted original-service fixture tests, integration-test owned process failure/oversized frames, and implement original runtime canonical history/tool notification boundary. Review SDK cancellation/approval/user-question limitations before exposing any capability. Add only this own extension ID to the product's executable admission, Sessions allowlist and **exact** two-proposal product API allowlist after audit; add only its type to session projection allowlist and import generic contribution. Do not enable all proposals or borrow Copilot's ID.

Then use a platform with original Extension Host IPC to install this actual VSIX and exercise new/list/send/recover through original Agent UI. Run actual pinned DSH/profile with a safely configured dedicated provider and at least one built-in tool, verify file effect and original session log recovery. No such real chain has run. Model credentials are not needed for fixture work; absence does not justify inventing real results. External plugin import and hooks/context remain H3, not this fixed-profile preparation. Mac build, Keychain/WKWebView, real account, human gates remain pending under original documents.
