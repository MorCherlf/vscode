<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# 原 Agent Host 后端与认证边界（源码审计）

输入为 `988fbfd2a26f7efe7050c6145718a00989d34fb3`；本工作包没有修改 provider、账户、令牌、权限或模型路由。以下是源码与官方接口核对，不是已登录、可用模型目录或真实任务验证。**GitHub OAuth 不是本地界面、原扩展准入、原组件裁剪和全部 backend 的通用前提。** 当前默认界面的 GitHub 欢迎/账户呈现也不能证明每种 backend 都需要 GitHub。

## 原调用链与注册

原 Sessions `LocalAgentHostContribution` → `LocalAgentHostSessionsProvider` → `BaseAgentHostSessionsProvider` → 原 `IAgentHostService` / `IAgentConnection` → `AgentService` → provider。具体 session type 来自当前 Host 根状态的 agent 信息，不是本产品新增的伪 provider。`src/vs/platform/agentHost/node/agentHostMain.ts` 注册 Copilot；Claude、Codex 各检查 enable 配置和 SDK 可达性。源码开发依赖是 Copilot SDK `1.0.27-unstable.40031404408.gba6c003`、Claude Agent SDK `0.3.304`、Codex `0.163.0`（根 package.json）；这些版本声明不表示本轮实际启动了 SDK。打包产品还需 `product.agentSdks`/原 downloader 的 SDK 资源闭包，本 product.json 当前没有该发行配置。

| 原路径 | 实际条件与身份边界 | 本轮结论 / 下一次真实联调输入 |
| --- | --- | --- |
| Copilot Host / Copilot 服务 | `CopilotAgent.getProtectedResources()` 默认要求 Copilot 资源；原 `agentHostAuth.ts` 通过 IAuthenticationService 解决受保护资源；`CopilotClient` 显式 `useLoggedInUser:false`。`BaseAgentHostSessionsProvider` 依据资源与模型发布逐 type 可用性。 | 选择此服务才处理 GitHub 产品身份、原认证提供者的完整激活/导入准入及专用测试账户。现生产 executable 清单 []，原 github-authentication 扩展不能被假定可执行；历史 Tauri 的 client-ID 环境变量不配置原 VSC 认证。不得为此放行整包混合 Copilot。 |
| Copilot harness / renderer BYOK LM bridge | `CopilotAgent._refreshByokModels()` 从原 bridge registry 接收模型；`AgentHostByokLmHandler` 调用原 ILanguageModelsService，列举与发送都检查 `clientByokEnabled`。`modelRequiresAgentAuthentication` 只在显式允许 signed-out 且所选模型带原 BYOK 标识时允许不要求 Copilot 资源。 | 官方 SDK 有 BYOK 不等于当前原 UI 已配置任意 OpenAI-compatible endpoint。需选定原 LM provider、准确模型/端点/产品支持的安全密钥设置和其整条扩展准入；清单 [] 时不能凭空假定 extension 提供的目录存在。未运行。 |
| Claude / native Anthropic | `ClaudeAgent.getProtectedResources()` 将 Copilot 资源标为 optional；`_fetchNativeModels()` 用同一 SDK query 的 `accountInfo()`/`supportedModels()` 决定实际目录，并关闭 query；`_ensureAuthenticated()` 根据模型 provider 选择 native 或 Copilot proxy。native 凭据由 SDK 拥有；当前适配器只提供 setup docs，没有原生登录 control request。 | 可不走 GitHub，但需要专用 Anthropic API 项目/账户、预算与安全注入 `ANTHROPIC_API_KEY`，准确 SDK 安装与隔离运行环境。不能拿用户 Mac Claude Keychain/个人缓存作为测试配置。官方 Agent SDK quickstart 对第三方产品的 claude.ai 登录有明确限制，不把 SDK 检测到个人订阅等同于产品授权。未运行。 |
| Codex / native OpenAI 或 ChatGPT | 原 `CodexAccountService`、`CodexAgent` 使用 `account/login/start`、`account/read`/通知、logout；显式选择/账户操作才启动原 app-server，ambient registration/auth replay 不能当登录。`canInitializeCodexWithoutGitHub` 对 unknown/signedIn 允许初始化，不证明已认证。`CODEX_HOME` 从 Host env 交给子进程。 | 不需要 GitHub client ID 才能研究/启动此原生账户路线。真实联调需先选定受支持的产品集成身份方式、专用 OpenAI/ChatGPT 测试账户及独立 CODEX_HOME。当前 VSC UI 登录请求是 `type:chatgpt`，不能假称所有官方 app-server auth 模式都已接入产品 UI。不得复制个人 auth.json 或固定上游 OAuth client。 |
| Codex / Copilot proxy | `codexLaunchConfig.ts` 提供 `vscode-proxy` Responses provider；模型 provider 决定 native 与 proxy，不是名字叫 Codex 就必走 OpenAI。 | 选择 proxy 模型仍需 Copilot 路线。特别是原 launch helper 把子进程 `OPENAI_API_KEY` 设为本机 proxy nonce：仅在外层 shell 设置 OPENAI_API_KEY 不能被宣称原 VSC Codex API-key 集成已完成。原 SDK 官方 API-key 登录与本产品安全配置接入要分别验证；不增加粘贴 token 入口。 |
| Copilot / on-device local model | 原 `localModelBridge/localModelProvider.ts` 与 setup service 确有 llama-server/model family 路线；平台、下载/同意、进程归属、`accountGate`、preview/AI/登录状态等均有原检查。 | 不能把“本地推理”直接推断成当前实现无账户、无下载/资源或支持任意本地 endpoint。需准确 family、模型/llama-server 版本、许可/资源、所需 accountGate 与原任务实测；本轮不绕过这些 gate。 |
| 原 Copilot Chat / Cloud Sessions 扩展 | `copilotChatSessionsProvider.ts` 独立 cloud session type；原扩展宿主路径与内建 Agent Host provider 不同。 | 默认 executable [] 不放行 GitHub.copilot-chat；native 已证实拒绝，不把 cloud 扩展身份当全部本地 Agent 的必需身份。DSH 本轮未启用。 |

## 原窗口 gate 与逐任务 gate

`src/vs/sessions/browser/sessionsAuthGate.ts` 区分 window gate 与 per-type gate；`chat.agentHost.allowSignedOutWhenUsable` 默认 false，桌面显式启用后仍看实际 session type 的资源/目录。原 Codex 的 initializationOnSelection 可允许先初始化其 own account，而不强制 GitHub。Web 的 opt-in 函数返回 false；本轮浏览器测试不是原 native SDK runtime。

`resolveAgentAuthRequirement()` 不把“空目录”当可用：资源未解析暂按 GitHub；不要求 GitHub 但模型数为零为 Unusable。`agentHostSessionHandler.ts` 在创建/发送前依据选择模型再调用 `modelRequiresAgentAuthentication()`；保留原服务和 runtime 权限/审批。**没有把欢迎页关闭、原 UI 输入可用、fixture 收到请求或编译通过等同于真实任务。** 本轮不会修改这些默认值/门禁，也不会自动启动某个 SDK 读取宿主当前账户。

## 隔离与人工输入

原 Electron `--user-data-dir`/`--extensions-dir` 只隔离 VSC profile，不能证明 Claude Keychain、Codex home、Copilot home、SDK 全局插件发现、环境凭据全部隔离。真实任务前应选一个 backend，再配置独立 OS 测试用户/受控执行环境、SDK 自己的 state home、专用项目和凭据。不要上传认证文件、将 secret 放 argv/日志/证据、或复用当前 Mac 个人账户。只回传非秘密的 backend、SDK、模型、endpoint 域名/部署名、产品集成身份配置与测试环境是否就绪；secret 由安全配置通道注入。

这不是要求现在提供所有后端配置。独立的 resolver/authoring、窗口/restore/OS、模块/worker 基线和打包工作继续；真实 read → modify → check → review / approvals / stop / restart 的 gate 在选定后端配置就绪后执行。若选 API-key native Claude 或受支持的 native Codex 路线，不再把缺少 GitHub client ID 当其统一阻塞。

## 官方接口查证（2026-10-30）

- [GitHub Copilot SDK authentication](https://github.com/github/copilot-sdk/blob/main/docs/auth/authenticate.md)：区分 signed-in user / own OAuth App / BYOK 及禁用 logged-in-user fallback；不表示上述当前 VSC bridge 已完成配置。
- [Claude Agent SDK quickstart](https://code.claude.com/docs/en/agent-sdk/quickstart)：API-key 配置与第三方 claude.ai 身份限制；不从个人 Keychain 做验证。
- [Codex app-server](https://learn.chatgpt.com/docs/app-server)：账户 read/login/start/cancel/logout 等官方接口；文档当前能力需与本仓库锁定 SDK/生成协议逐项匹配，不将最新文档新增模式自动算作 VSC 已实现。
- [Codex authentication](https://learn.chatgpt.com/docs/auth)：官方账户/凭据路径。没有在本轮调用登录或发送请求。

官方网页可能更新，仓库可执行源码/锁定依赖与精确测试版本是本产品行为证据。没有复制官方整页或令牌样例。
