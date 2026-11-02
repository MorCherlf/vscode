<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# 能力与验收归属

所有源码路径相对仓库根；此表为静态审计，不声明运行兼容。AH 指现有 Copilot Agent Host；Local 指旧编辑器内 harness。

| 用户行为 / 能力 | 来源及现状 | 编辑器依赖与独立形态 | 首版归属 | 验证 / 目标 |
| --- | --- | --- | --- | --- |
| 独立启动、账户登录 | agentHostServerMain.ts、node/copilot/copilotAgent.ts | 复用 runtime；账户经 AHP authenticate，连接令牌另管 | 必选 M1/M7 | T01/T12，G01/G06 |
| 项目/会话/模型、多 chat、取消和恢复 | node/agentService.ts、agentHostStateManager.ts、common/agent.ts | AH 持有状态与 providerData；UI 不重写 reducer | 必选 M2/M3 | T03/T04，G03/G11 |
| 搜索、读取、写多文件、命令 | node/copilot/copilotSessionLauncher.ts、agentHostTerminalManager.ts | SDK 工具加 Host PTY；不需要编辑器 UI | 必选 M1/M3 | T05/T07，G04 |
| 工具审批/用户问题/计划 | common/state/protocol、node/protocolServerHandler.ts | 权限仍由 Host/SDK 执行；前端呈现交互 | 必选 M2/M3 | T03/T07，G03/G06 |
| 文件/文本上下文、Diff、恢复 | node/diffComputeService.ts、diffWorkerMain.ts、agentHostCheckpointService.ts | 仅保留 editor/common 算法；文件显式选择、只读审阅 | 必选 M3 | T06，G05 |
| 自动活动编辑器上下文 | extensions/copilot/src/extension；Local 的编辑器服务 | AH 无活动编辑器；显式附件替代 | 自动行为移除，显式选择必选 M3 | T06，G05 |
| 未保存缓冲区 | Local 编辑器文档模型 | 不能声称磁盘文件含未保存内容；后续显式文本附件 | 后续；首版文本附件必选 M3 | T06，G05 |
| 自动语言诊断 | Local 语言/诊断服务 | 用项目检查命令提供首版可验证结果，不声称等价 IDE 诊断 | 自动诊断后续；检查命令必选 M3 | T05，G04 |
| 调试器上下文、补全、编辑器扩展 | Local workbench/debug/editor | 不导入通用 IDE | 移除 | T02/T11，G02/G10 |
| MCP、Skills、Agents、Instructions、Prompts、Hooks、插件 | node/copilot/customizations、agentPluginManager.ts、copilotSessionLauncher.ts | SDK 格式、作用域和生命周期逐项验证；不等同 VSIX | 必选 M4 | T08，G07 |
| 文件/配置工具 VSIX | workbench 扩展 API、lm tools | 按需精简 Node 宿主，限制 API | 受控合同必选 M5 | T09，G08 |
| MCP 提供 VSIX | mcpServerDefinitionProviders 贡献点 | 需要 Node 扩展 API 桥接 | 受控合同必选 M5 | T09，G08 |
| 声明式 Agent 资源 VSIX | chatPromptFiles/chatSkills | 解析清单和资源，不启动 IDE | 受控合同必选 M5 | T09，G08 |
| 浏览器工具 | Copilot 工具与客户端富交互路由 | 本地测试站点导航、截图、交互、取消，需独立适配 | 必选 M5 | T10，G08 |
| Canvas | SDK/客户端 capability | 未证实当前 Host 提供完整 Canvas 生命周期；明确不可用 | 首版可选；未支持不得显示成功 | T10，G08 |
| 云端会话、远程连接 | missionControl、remoteAgentHost 服务 | 服务图有代码不等于产品已启用或可用 | 后续 M8 | T04/T12 的独立扩展验证 |
| 自动化调度、Computer Use | Host automations、客户端权限桥 | 不因服务图存在就承诺 UI/平台支持 | 后续 M8 | 专项权限/生命周期验证 |
| 性能、裁剪、无孤儿进程 | GOALS/VALIDATION | B1/C0/C1 同能力、全部子进程计入 | 必选 M6 | P01–P06/T11，G09/G10 |
| 退出、崩溃、重连和持久化 | agentHostShutdown.ts、sessionDatabase.ts | 复用 ingress→drain→provider→flush→dispose | 必选 M1/M2/M7 | T04/T12，G11 |
| 签名/安装/更新/回退、上游同步 | 待建分发工程 | 独立产品身份、依赖组合和数据兼容 | 必选 M7 | T12/T13，G12 |

源码前缀：未写全的 Host 路径位于 `src/vs/platform/agentHost/`；扩展筛选依据 `src/vs/workbench/services/extensions/common/extensionManifestPropertiesService.ts`。Sessions 的完整编辑器入口 `src/vs/sessions/sessions.common.main.ts` 仅作行为参考，不进入客户端工程。
