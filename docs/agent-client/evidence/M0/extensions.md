<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# 扩展兼容样本合同 v1

这是一份可执行实现前的 API 合同和候选审计，不是已通过兼容的支持清单。当前无 VSIX 兼容宿主；所有样本运行结果为待 M5。未指定第三方必选扩展，因此不擅自扩大首版承诺。

| 固定样本 / 版本 | 类型与优先级 | 必需 API、进程、资源 | 接受行为 / 拒绝行为 |
| --- | --- | --- | --- |
| fixture.agent-file-tool 1.0.0 | 文件/配置工具，首版必选合同 | extensions.activate、lm.registerTool、workspace.fs、Uri、CancellationToken；按需 Node 宿主；两个临时文件 | 列出与修改明确授权目录；取消、拒绝后不写文件；不依赖 window.activeTextEditor |
| fixture.agent-mcp-provider 1.0.0 | MCP 提供，首版必选合同 | lm.registerMcpServerDefinitionProvider、McpStdioServerDefinition、事件/Disposable；受控 Node stdio MCP | 发现、调用、禁用、卸载、崩溃和重启；不遗漏子进程 |
| fixture.agent-resources 1.0.0 | 声明式资源，首版必选合同 | package.json 的 chatPromptFiles/chatSkills/chatAgents 与受控 Markdown 资源；无需激活 JS | 验证作用域/路径、发现、开关和重启；不存在 API 必须报不支持 |
| GitHub.copilot-chat 0.73.0（本仓库 extensions/copilot） | 真实混合候选，拆分审计，非整包首版必选 | package.json 的 languageModelTools、mcpServerDefinitionProviders、chatPromptFiles、chatSkills；大量 workspace/window/语言模型与编辑器服务 | 作为上述三类真实贡献点的候选来源；需逐工具拆分，不能因 agentsWindow 声明就整包兼容 |
| vscode.configuration-editing 10.0.0（extensions/configuration-editing） | 真实配置候选，编辑器部分移除 | workspace.getConfiguration、文本编辑/命令/配置 UI | 可提取配置读写样本；编辑器命令不进入独立支持清单 |

版本来自交接提交的各扩展 package.json，未从 Marketplace 猜版本。候选清单加入第三方前必须固定 VSIX 哈希、license、真实 API 使用及资源预算。M5 按 T09 给每项兼容、拆分或阻塞结论；最小合同不代表已经存在实现。

筛选入口：`src/vs/workbench/services/extensions/common/extensionManifestPropertiesService.ts` 的 Agent 贡献点和缺失工作台特征检查。源码声明是第一道筛选，运行时 API 审计是第二道，隔离项目中的 T09 是最终门禁。
