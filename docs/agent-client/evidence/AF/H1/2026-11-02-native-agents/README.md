# Native Claude / Codex connections — Mac engineering delivery

Source: `e4c411dfe715bd1f4349efae448cf31773851659`, including implementation `c5af79b6937de237d5aa50ce675891c7737747cc` and portable SDK packaging fix `008fe62434008405b17bd5fbf0088fe88cad73d9`. The evidence commit is separate from the application source. H1 remains engineering in progress; no human acceptance or DSH activation.

## Delivered behavior

The original Sessions command palette and account menu now offer **Agent: Configure Local Agents...**. Select Claude Code or Codex, then API Key, existing local agent configuration, or removal of the saved connection. Use the bundled runtime, a detected local executable, or the original file picker. API setup collects endpoint, model ID and a masked key. Saving offers an explicit Agent Host restart, with notice that running tasks stop, or applying at the next restart. Select Claude/Codex in a new chat after setup. Saving means configured; credentials are checked by the actual runtime when sending a task.

Claude uses an Anthropic Messages-compatible endpoint; Codex uses an OpenAI Responses-compatible endpoint. This does not implement a generic Chat Completions adapter or guarantee every gateway's protocol compatibility. API mode supplies a private runtime state directory. Local mode deliberately lets the selected official runtime resolve its own existing account and configuration. Arbitrary installed CLI versions and real consumer/subscription accounts were not validated in this run.

The implementation extends the original Claude/Codex providers, authentication channel, model selection, SDK downloader, QuickInput, file dialog, secret storage and Agent Host restart. Original ChatWidget, streaming, tools, review and permission mechanisms remain in use. It adds no replacement chat component or separate agent orchestration service. Ordinary products retain their existing branches. Production executable-extension admission remains `[]`.

The connection envelope is stored through the original secret service under product-owned keys and replayed as the authentication protocol's opaque token. Generic GitHub OAuth forwarding and revocation skip the exact native resources. Keys are passed to official subprocesses in their environment, not command arguments or user settings. A new endpoint requires entering a fresh key. API model rows represent the user's configured model rather than verified entitlement. Existing SDK workspace/global configuration discovery remains active; this is not a claim of complete SDK isolation.

## SDK packaging and upstream maintenance

The original `build/agent-sdk` producer and exact upstream lockfiles supply Claude SDK `0.3.304` (Claude Code `2.1.304`) and Codex `0.163.0`. Agent First packaging includes complete roots under `agent-sdks/`; `product.agentSdks` points to those application-relative roots. Ordinary products retain the CDN path. Cache fingerprints include the lockfile and platform target, so upstream pin changes rebuild the runtime. SDK native executable/import validation remains the original producer's check.

Packaging initially exposed Node's copy behavior rewriting a relative npm `.bin/codex` link to an absolute build-cache path. The copy now preserves relative links. Final installation checks require no external application symlinks and a strict deep ad hoc signature. This Mac preview is not Developer ID signed or notarized.

## Validation scope

| Check | Result / boundary |
| --- | --- |
| Final original Electron batch: native configuration, launch options, SDK loader, OAuth, setup banner, ClaudeAgent and CodexAgent | **557 passing** across eight selectors. This is the final unified count; earlier overlapping reruns are not added to it. |
| Original ClaudeAgent and CodexAgent suites, including startup replay / active-task rejection regressions | 338 passing. An initial assertion omitted the parser's explicit `executable: undefined`; the expected normalized fixture was corrected before the successful run. |
| Focused source and test types, build-tool types, changed-file lint, layer validation | Pass. Desktop output was regenerated through original build tooling. |
| Original AHP server + actual produced Claude/Codex runtimes + local HTTP fixtures | Both receive their fake key and configured model, return streaming text and complete a turn. No replacement provider or UI is used. |
| Actual runtime tool loop through original providers | Claude `Write` and Codex `exec_command` each create a file in a disposable project; file contents and returned tool results are checked before the final response. See [native-tools.json](native-tools.json). |
| Initial native configuration after Codex ambient startup | Pass against the actual runtime. First inactive ambient connections use the existing loss/resume transition; an active turn or a previously configured live connection still requires restart. See [native-recovery.json](native-recovery.json). |
| Mac package / install | Original desktop bundle and arm64 packaging; SDKs included; source product restored byte-for-byte after preview identity overrides; strict signature and portable-link checks. See [installed.json](installed.json). |
| Installed original Sessions UI | Pass at the final source: configure Codex, send a Chinese task, save Claude and restart the Agent Host, send a Claude task, then create another Codex chat and receive a fresh API response using its saved connection. No Codex configuration-restore error reappears. Results: [installed-ui.json](installed-ui.json); inspected [Claude response](installed-claude-final.png) and [Codex after restart](installed-recovery-final.png). Test credentials use a disposable in-memory secret store, with no personal authentication cache copied. This does not test persistence across a full application exit or a live paid model service. |

The first installed candidate (`008fe624`) returned both providers' responses but exposed a Codex credential-replay race after saving the second agent. Its error screenshot and local logs are retained separately. `e4c411d` fixes that race and is the final candidate; earlier candidate results are not silently reattributed. Early CDP connections, background QuickInput dismissal and an exact accessible-name selector required automation corrections. An existing draft retained a previously selected local-account model after its catalog changed; creating a new chat as instructed selected the configured API model. Existing `agentHostClientByokLm` / `agentHostClientProxy` channel warnings remain outside this change; successful native requests do not establish Copilot/BYOK channel health.

The mock is the HTTP model service, not the Agent Host, native SDK, tool execution or installed UI. No real model credential, billing request, account entitlement, complete approval/rejection/cancel/recovery matrix, physical IME, VoiceOver, arbitrary plugin compatibility or complete H1 acceptance is claimed.

## How to test

1. Open `/Applications/VSC Agent Preview.app` and press `Cmd+Shift+P`.
2. Run **Agent: Configure Local Agents...** and choose Claude Code or Codex.
3. Use **API Key** with the service's compatible endpoint and supported model ID, or **Use Local Agent Configuration** to delegate to an already configured runtime. The bundled runtime is the default; choose an installed executable when needed.
4. Save and restart agents, then create a chat and select that agent and model. Enter keys only in the application's masked field.
5. In a disposable project, check read → edit → run checks → original review, then approval rejection, cancellation, restart and continuation against the intended real service. These remain part of the H1 engineering / human acceptance gates.

Protocol references: [OpenAI app-server](https://learn.chatgpt.com/docs/app-server), [Claude Agent SDK TypeScript](https://code.claude.com/docs/en/agent-sdk/typescript). The repository's pinned SDK and generated protocol types govern this build; newer service documentation is not a promise of compatibility with unpinned local executables.
