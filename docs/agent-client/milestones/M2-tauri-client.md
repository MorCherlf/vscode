<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# M2 Tauri 客户端与 AHP 验证

状态：进行中（2026-10-29 已交付 Mac 开发包与首批 Sessions 界面迁移；真实账户、完整界面对照和 WKWebView 门禁未通过）。前置：M1 可运行 Host；M0 已明确首版交互。对应目标：G02、G03、G06、G11。执行角色：Rust、前端和协议测试。

## 目标

用最小 Tauri 客户端完成真实登录、创建会话、流式回答、取消和重连，证明系统 WKWebView 和宿主通信足以承载 Agent 产品。M2 是客户端技术路线门禁，不以美化空壳或 mock 聊天作为完成标准。

## 工程和责任

建议在 `apps/agent-client/` 使用 Tauri 2、React、TypeScript 和 Vite，在 `packages/agent-client-core/` 保留无 Tauri 依赖的状态与协议投影。精确版本锁定在本阶段的锁文件和构建清单中。

使用官方 AHP TypeScript 客户端维护一套协议状态。Rust `HostSupervisor` 启动和监督本地 Host，并持有连接凭据；`TauriTransport` 在 TypeScript 与 Rust 之间传递 AHP 帧。Rust 不实现另一套会话 reducer，未来网页客户端替换 transport 即可复用客户端核心。

## 工作包

| 编号 | 推进动作 | 完成产物 |
| --- | --- | --- |
| M2.1 | 建立 Tauri 主窗口和最小项目、会话、聊天界面 | 可本地构建的独立客户端 |
| M2.2 | 通过 Rust 管理 Node sidecar、readiness、端口与令牌 | 明确的启动、停止和失败状态 |
| M2.3 | 接入 AHP 握手、能力协商、快照、动作和断线恢复 | transport 合同测试和协议回放 |
| M2.4 | 对接真实登录与凭据存储，验证再次启动 | 无 VS Code 登录依赖的真实会话 |
| M2.5 | 接入流式响应、取消和用户输入请求 | T03、T04 最小任务验证 |
| M2.6 | 在 WKWebView 验证输入法、粘贴、拖放和富内容边界 | T02 记录和 Tauri 继续采用的决策 |
| M2.7 | 沿用同源码 Agent/Sessions 布局、主题、图标与核心交互，逐组件拆除工作台依赖 | [界面迁移来源、分批计划和 UI01 至 UI06](../UI_MIGRATION.md)；实际可操作的界面及对照证据 |

## 接口与故障行为

- UI 使用订阅快照和增量动作，保留真实会话与聊天身份；不按标题匹配对象，不把 provider 身份写进新的自定义会话 ID。
- 连接认证完成前不允许执行任务；协议版本或能力不兼容时准确报告，不能只按开发版本号猜测支持。
- UI 与 Rust 转发使用有界队列。背压或事件缺口触发重新同步，不静默丢弃流式内容后继续展示过期状态。
- 创建会话、发送消息和执行工具的结果在断线时可能未知；不自动重复发送副作用请求，先与 Host 状态核对。
- 关闭窗口保留应用与 Host；完整退出有活跃任务时提供等待或停止选项，取消退出就继续运行。仅停止自己创建的进程。
- 只开放应用窗口需要的 Tauri 命令；聊天内容、外链和插件视图无直接运行任意本机命令的入口。

## 交付物

可运行的 Tauri 原型、协议 transport 与状态边界说明、凭据和进程管理实现、T01 至 T04 的阶段报告及 WKWebView 适配结论。证据已存入 `evidence/M2/`。

## 验收门禁

- [ ] 界面符合 [UI01 至 UI06](../UI_MIGRATION.md)，同主题同任务与原版对照；不能仅以原型编译、空欢迎页或 mock 窗口证明完整迁移。
- [ ] 在不运行 VS Code 的 Mac 上，由 Tauri 启动 M1 Host，使用真实 Copilot 账户完成一次对话。
- [ ] 创建会话、流式输出、取消和输入请求均有真实服务证据，mock 回放覆盖错误和断线。
- [ ] 两个客户端订阅同一会话后状态收敛；连接断开恢复不造成重复任务。
- [ ] 中文组合输入不会提前发送；粘贴、拖放、键盘导航与长内容显示通过 T02。
- [ ] 令牌不进入 WebView 可见日志或进程参数，恶意富内容不能调用受保护原生能力。
- [ ] 关闭窗口、取消退出、正常退出和崩溃恢复符合生命周期合同。

## 风险与处理

遇到 Electron 专用浏览器或视图接口时，隔离为独立服务并验证替代路径，不将整个 Electron 工作台装入 Tauri。若核心交互仍无法满足，记录可复现问题和客户端选型调整，继续复用 M1 Host；M2 标为受阻，不能把无关演示认定为技术门禁通过。

## 推进记录与下一步

已实现 `apps/agent-client/`、`packages/agent-client-core/` 和 `packages/agent-host-supervisor/`。官方 AHP 1.0.0 SDK/reducer、轻量 React/TypeScript 界面、Tauri 2.12.4 外壳、凭据留在 native 的帧转发、有界队列、重连快照、取消/文本问题/工具审批、窗口隐藏与退出选择均有实际代码。Linux 完整 Rust check 与调试可执行文件构建通过，核心 6/6、supervisor 4/4、浏览器 2/2 通过；真实 Tauri 图形窗口因云端无显示环境未运行，Chromium 截图不算 WKWebView 验收。M2-B 已加入自有 OAuth device flow/refresh、原生凭据交接、credential-store/Keychain 后端、输入约束与故障工程，见 [本轮证据](../evidence/M2/M2-B/README.md)。真实账户、新版 Mac 编译/Keychain 与 M2.6 真机交互仍未验证；M2 不得标为已验收。详见 [M2 证据](../evidence/M2/README.md) 与 [M2-B](../evidence/M2/NEXT.md)。

用户后续要求优先直接复用 VS Code 原组件与插件生态、持续合并上游，并探索 DSH。主聊天负责 `feasibility/`；本轮不扩大 React 视图或实现 vscode API 子集，也不提前决定双运行时或替换容器。已有资产/主题复用与表单适配不作为原组件复用证明。
