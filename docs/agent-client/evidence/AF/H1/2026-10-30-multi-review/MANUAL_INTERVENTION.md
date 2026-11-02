# H1 manual input — not human acceptance

This checkpoint requires **Mac execution and a product-owned account configuration**, not permission to push/merge. Dedicated-branch push and draft PR #2 are already authorized. No acceptance is assumed.

## 1. Mac arm64 native prerequisite and source launch

On the user's Mac, preserve existing working trees. Fetch the implementation branch and create a separate empty worktree at **the exact SHA delivered with this report** (do not reset/overwrite a dirty checkout):

```sh
git fetch origin codex/agent-client-implementation
# Replace the value with the exact SHA in this checkpoint's chat delivery.
H1_SOURCE_SHA='REPLACE_WITH_EXACT_DELIVERED_SHA'
git worktree add ../vscode-h1-native "$H1_SOURCE_SHA"
cd ../vscode-h1-native
# Install/use the version in .nvmrc; upstream macOS/Xcode/Python/native prerequisites apply.
npm ci
npm ci --prefix build
npm run build-fast -- --client-only
npm run electron
node scripts/agent-first/preflight.mjs > /tmp/h1-native-preflight.json
bash scripts/agent-first/run.sh
```

If a named native module reports an Electron ABI mismatch, stop that launch and report its module/error; rebuild it using upstream Electron headers/instructions rather than sharing Host node_modules or forcing an ordinary Node binary. `preflight` exit 0 means only Mac arm64/socket prerequisites; it is not application/test success. Any failure must retain the failing command/exit code and sanitized diagnostic. This source-launch sequence does **not** produce an installable `.app` candidate; native execution must work before source-matched packaging and H1 acceptance delivery.

Return only the non-secret `/tmp/h1-native-preflight.json`, whether the original Agent window opens, and any startup/ABI/IPC error. Do not return account logs, token files, personal VS Code caches or whole environment dumps. Current cloud source reports Linux/EPERM, not a Mac result.

Before account setup, observe only startup/window routing/file review/configuration surfaces that are actually reachable. Do not bypass the original sign-in gate. Later native checks include new window/local folder vs rejected file/workspace/diff/merge/remote payloads, restore, original EH admission, file/group/OS drag, multi-diff typing rejection, original chat paste/multiline/Chinese IME/VoiceOver and source-matched Mac packaging. These are separate pending results.

## 2. Product-owned authentication information

Confirm whether a **product-owned GitHub OAuth App with Device Flow enabled** exists, and provide its **public client ID only** plus confirmation that a dedicated test account with the needed Copilot entitlement/organization approval can be configured locally. Do not send client secrets, access/refresh tokens, credentials or browser/session caches. If no app exists, it must be registered under the product owner with the actual product name/Homepage/controlled registration URL; another product's client ID must not be copied.

Original H1 VSC authentication integration still needs that configuration and whole activation/import/dependency audit before precisely admitting an auth extension. The fixed upstream ID in `extensions/github-authentication/src/config.ts` is not an authorized fallback. The historical Tauri adapter's `MORCHERLF_GITHUB_OAUTH_CLIENT_ID` variable is **not a switch for original VSC H1 authentication**. Do not run an actual login via that extension until a product-owned path is wired and reviewed.

Once the lawful original-provider path is available, run a real task in the disposable project created by `run.sh`: fix sum.js, run npm test, inspect original read-only diff; then approval/rejection/stop/restart/multiple sessions and runtime loading traces. Keep account values local and provide sanitized results. No fixture success substitutes for these tasks.

## Status to retain

H1: engineering in progress; **not ready for human acceptance, not human passed**. H2/H3/H4 unchanged and separate. Existing M1/M2 account/Mac/Keychain/WKWebView gates remain pending. No merge, signed/notarized package or publication is authorized by this handoff.
