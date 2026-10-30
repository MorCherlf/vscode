<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# M2-B 原生账户、输入与故障工程

2026-10-29，Linux x86_64 云端。恢复来源为 `MorCherlf/vscode` 的已提交实现分支 `28eb53a537f541dcc45fc69ebda9af276e783257`，新空目录与搜索结果说明见 [environment.json](environment.json)。没有找回或覆盖丢失的未提交文件。M1/M2 继续未验收；本轮未运行真实账户、模型任务或 Mac 程序。

## 实际代码

- `packages/agent-host-supervisor/src/account.rs`：原生 OAuth device flow；自有应用 client ID 配置、未配置、等待授权、取消、拒绝、超时、slow_down、到期提前刷新、服务端撤销后的新凭据获取、恢复和登出。设备代码、access/refresh token 只在原生层。页面投影仅含阶段、用户验证码、固定验证页与截止时间；不含 device_code 或账户令牌。原生后台轮询不依赖 WebView 可见性。
- `credentials.rs`：窄 `CredentialStore`、内存 fixture、macOS Security.framework generic-password 后端。命名空间为本应用专用 `com.morcherlf.agent.github-oauth` / `primary`。保存/读取/清理失败区分拒绝、交互受限/锁定、不可用及损坏；没有明文磁盘回退。Linux 系统后端明确返回 unavailable，而非用内存冒充持久存储。敏感原生记录不实现 Debug，丢弃时清零自身字符串；不宣称网络/第三方库内部全部内存副本均已清零。
- supervisor 使用独立原生 WebSocket 完成官方 `initialize` / `authenticate`，账户令牌不经过 renderer transport，不进入启动参数。连接令牌仍独立生成。native 仅允许页面使用现有必要 AHP 方法，阻断 authenticate、OTLP 日志订阅、未知方法及 batch；不改变官方 reducer。Host 子进程不继承常见账户 token 环境变量，GitHub CLI 配置路径固定到本应用目录。
- 原生层启动自有进程组；正常停止、发现 Host 崩溃和启动失败后清理该组，等待并回收自有 Host。不会按进程名杀其他应用。stdin EOF 保持原有 Host drain/disposal。父进程 SIGKILL 本身无法执行 Rust Drop，因此单独验证真实 EOF 路径。
- `packages/agent-client-core/src/input.ts`：按 AHP 1.0.0 实际定义处理文本长度/格式、number/integer 范围与有限值、布尔 false、单选、多选、freeform、required/default/skip。未知类型/格式不可用。`AgentClient` 检查活跃请求，提交保留去重记录；断线后仍开放的同一 turn/request 不重发结果未知的回答。完成/撤销/结束轮次后旧回答不可操作。
- URL 请求只允许明确打开无 userinfo 的 HTTPS 地址；打开和批准是两个操作，不能自动批准。其他 scheme/过大 URL/未知输入明确不可用。AHP 没有请求级到期时间字段，因此不捏造本地“超时批准”；服务器完成/取消/结束轮次使请求失效。OAuth device deadline 则按服务端 expires_in 验证。
- 已开始的 Sessions 表单与账户投影接入保留在现有结构内；这是 React 视图适配，**不是 VS Code 原组件复用**。按最新用户约束，不继续扩大此路径或实现 vscode API 子集；依赖边界见 [view-boundary.md](view-boundary.md)。`docs/agent-client/feasibility/` 未修改；DSH、双运行时和最终容器均未作决定。

## 认证依据与所缺配置

核对日期 2026-10-29；参考官方 [SDK OAuth 接入](https://github.com/github/copilot-sdk/blob/main/docs/setup/github-oauth.md)、[GitHub OAuth device flow 与 refresh](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)。官方支持由自有应用取得 OAuth 用户令牌交给 SDK；生命周期由应用负责。device flow 及其 refresh 不需要在桌面内嵌 client secret。本实现仅支持 GitHub.com OAuth App device flow，不借用 GitHub CLI、VS Code 或其他产品 client ID；GHES/其他认证模式没有宣称支持。

源码核对：`src/vs/platform/agentHost/common/githubEndpoints.ts` 中 Copilot resource 为 API base URI、支持 `read:user user:email`；`copilotAgent.ts::authenticate` 已支持 `expiresIn` 和空令牌撤销，SDK 构造已设 `useLoggedInUser: false`。本轮继续使用这一实现，没有替换其认证服务图。锁定 SDK `1.0.27-unstable.40031404408.gba6c003` / runtime `1.0.103-unstable.r40031404408.gba6c003`。

尚缺**本产品自己的 GitHub OAuth App 注册及其 client ID**。注册产品真实名称/Homepage/受控 callback URL，在应用设置启用 Device Flow；device flow 不使用 callback，但注册信息必须归本产品。原生启动环境配置 `MORCHERLF_GITHUB_OAUTH_CLIENT_ID`（公开配置，不是 secret）。请求 scopes 固定 `read:user user:email offline_access`，不额外请求 `repo`；离线 scope 用于官方支持的 expiring token/refresh，没有 refresh 的响应也能按非过期令牌处理，撤销后重新登录。需专用测试账户有效 Copilot 订阅及组织批准/网络访问。没有 client ID 时明确 unconfigured，不能声称真实登录通过。Finder 启动不会自动获得终端环境，正式打包配置方式仍待架构/发布阶段确定。

登出停止本应用 Host 并清除本地 Keychain 项；如果清理被拒绝/锁定，报告失败，不能声称已清除。此处不等于远端撤销 OAuth 授权；用户可在 GitHub 应用授权页撤销。重新登录停止旧 Host，避免旧进程继续使用先前账户。真实 Copilot entitlement 是否可用仍以服务端结果为准，Account authorized 不代表模型任务已验收。

## 新验证

| 检查 | 结果与准确范围 | 原始证据 |
| --- | --- | --- |
| core | **11/11**：官方 AHP、输入约束、去重/失效、断线后快照、两个真实 mock Host 客户端的待审批重连/拒绝/取消收敛 | [core-tests.log](core-tests.log) |
| Rust supervisor | **15/15，0 ignored**，含内存账户状态机/存储错误、native 实际 mock Host 账户交接与崩溃重启、512 KiB × 65 帧触发 64-credit 背压、超限帧、peer 异常断开 | [supervisor-tests.log](supervisor-tests.log) |
| Host / SDK 故障 | **2/2**：父进程 SIGKILL 后活跃/待审批 mock Host EOF 停止；实际 SDK/runtime start/ping 后 SIGKILL，下一请求失败、stop 完成。后者没有账户或模型任务 | [host-sdk-faults.log](host-sdk-faults.log) |
| 浏览器 | **6/6**；保留原有真实 M1 mock Host UI 流程，新增输入控件/URL 显式打开后仍需用户决定。新增表单测试使用组件 fixture；不是原生 URL 启动、账户登录或 WKWebView | [browser-tests.log](browser-tests.log) |
| 前端 | TypeScript + Vite 构建通过 | [frontend-build.log](frontend-build.log) |
| Tauri | **Linux cargo check --locked 通过**，包含原生命令与后台账户调度；不是 Mac cfg 分支编译或 GUI 运行 | [linux-tauri-check.log](linux-tauri-check.log) |
| Host 产物 | 当前 Linux production/test 独立构建与 prepare:host 通过 | [测试构建](host-test-build.log)、[生产构建](host-production-build.log)、[资源准备](prepare-host.log) |
| 真实模型 runner | 已编译；未 opt-in 时返回 `PROBE_NOT_OPTED_IN`，**没有运行真实账户任务** | [real-runner-not-run.log](real-runner-not-run.log) |

旧 Mac Host 5/5、core 6/6、supervisor 4/4、UI 5/5 和 456.81 MiB Release 包继续引用 [M2-ui 的原始报告](../../M2-ui/README.md)，归属于原输入；本轮改动后的 native/core/UI 不借这些旧结果宣称新版 Mac 通过。浏览器截图归本目录，不覆盖旧报告。

## 命令

```sh
npm ci --prefix packages/agent-client-core
npm --prefix packages/agent-client-core run build
npm ci --prefix packages/agent-host
npm --prefix packages/agent-host run build:test
npm --prefix packages/agent-host run build
npm --prefix packages/agent-client-core test
node --test packages/agent-host/test/faults.test.mjs
AGENT_HOST_TEST_DIR="$PWD/packages/agent-host/dist-test" cargo test --locked --manifest-path packages/agent-host-supervisor/Cargo.toml --all-targets -- --include-ignored
npm ci --prefix apps/agent-client
npm --prefix apps/agent-client run build
PLAYWRIGHT_BROWSERS_PATH=/tmp/agent-client-browsers node apps/agent-client/node_modules/playwright/cli.js install chromium-headless-shell
AGENT_CLIENT_UI_EVIDENCE="$PWD/docs/agent-client/evidence/M2/M2-B" PLAYWRIGHT_BROWSERS_PATH=/tmp/agent-client-browsers npm --prefix apps/agent-client test
npm --prefix apps/agent-client run prepare:host
cargo check --locked --manifest-path apps/agent-client/src-tauri/Cargo.toml
```

云端 Node 为 24.22.1，Rust 1.90.0 在 `/tmp/agent-client-cargo` / `/tmp/agent-client-rustup`。首次 node-gyp 解包因 `fchown EINVAL` 失败，使用官方 Node headers 的 Python data-filter 解包和 `npm ci --nodedir=/tmp/agent-host-node-headers/node-v24.22.1` 后成功；不是产品失败。Linux GTK/WebKit dev 依赖用 apt download-only 提取到 `/tmp/m2b-sysroot`，没有系统安装。check 使用 `PATH=/tmp/m2b-tools:/tmp/agent-client-cargo/bin:$PATH`、`CARGO_HOME=/tmp/agent-client-cargo`、`RUSTUP_HOME=/tmp/agent-client-rustup`、`PKG_CONFIG_SYSROOT_DIR=/tmp/m2b-sysroot`、`PKG_CONFIG_PATH=/tmp/m2b-sysroot/usr/lib/x86_64-linux-gnu/pkgconfig:/tmp/m2b-sysroot/usr/lib/pkgconfig:/tmp/m2b-sysroot/usr/share/pkgconfig`、`LD_LIBRARY_PATH` / `LIBRARY_PATH` 指向该 sysroot `usr/lib/x86_64-linux-gnu`。初期失败与修复见 [failures.md](failures.md)。

## Mac 与真实账户待验收

1. 在本提交的 macOS arm64 checkout 重新构建 Host production/test，执行上面的 core/native 测试及 `cargo check --locked --manifest-path apps/agent-client/src-tauri/Cargo.toml`。Linux 排除 Mac cfg 不是 Mac 编译结果；本轮仅检查了下载的 security-framework 3.5.1 源码函数签名，没有交叉编译结论。
2. 注册自有 App 后，在终端设置公开 client ID，`npm --prefix apps/agent-client run prepare:host`、`npm --prefix apps/agent-client run tauri -- dev`。验证未配置、首次登录、取消、拒绝、设备码过期、refresh rotation、进程重启恢复、GitHub 服务端撤销、Keychain 拒绝/锁定/损坏与登出清理失败；只记录错误类别，不记录验证码或凭据。结果回填 `evidence/M2/macos-keychain/`。Keychain 本机授权提示及后台交互受限的实际行为须补验。
3. 登录专用测试账户后可用以下 runner，读取本应用 Keychain；没有粘贴/环境变量 access-token 入口，不读取 VS Code 或 CLI 缓存。`AGENT_PROBE_DATA_DIR` 必须为不存在的新目录，项目必须是显式专用临时目录；成功只输出类别，不输出原始帧/回答。该 runner 只是一轮无工具 smoke，不能替代完整 T01/T03/T04/T05。

```sh
MORCHERLF_GITHUB_OAUTH_CLIENT_ID=<本产品公开客户端ID> \
MORCHERLF_RUN_COPILOT_TESTS=1 \
AGENT_HOST_PRODUCTION_DIR="$PWD/packages/agent-host/dist" \
AGENT_PROBE_DATA_DIR=/tmp/morcherlf-real-probe-new \
AGENT_PROBE_PROJECT_URI=file:///tmp/explicit-copilot-test-project \
cargo run --locked --manifest-path packages/agent-host-supervisor/Cargo.toml --example account_probe
```

4. 完整真实矩阵继续待验收：两个项目/三个会话、创建/流式/取消/拒绝、真实服务中断和 SDK 活跃任务崩溃、三轮 T05 两文件任务；未知副作用不重发。云端 mock 活跃任务、真实 SDK 无账户崩溃不能替代这些场景。跨 Mac 父进程异常退出与自有进程树回收也须重复。
5. WKWebView 原生输入法/粘贴/拖放、窗口/Dock/Cmd-Q、原版 Sessions 组件可行性和截图对照、性能/干净 Mac、签名公证均保持待验收；不合并、不发布。下一步见 [NEXT](../NEXT.md)。
