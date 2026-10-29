<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# 视图边界与后续架构约束

本轮开始后用户补充：尽可能直接复用 VS Code 原组件，以插件生态及持续合并上游为基础，探索 DSH；尚未决定双运行时或更换容器。因此本轮停止扩大 React UI 或创建 vscode API 子集，保留已开始的账户/表单接线和独立 native/core 工程。可行性报告目录由主聊天负责，本轮未修改。

现有 `App.tsx` / `Transcript.tsx::InputPrompt` 是本项目 React 视图；上游主题、Codicons、CSS 资产复用不等于上游组件复用。新增表单仍是适配，不作为组件迁移完成证据，也不锁定最终客户端架构。

后续新视图实施前须检查这些实际依赖：

| 候选上游组件 | 当前直接依赖边界 | 本轮处理 |
| --- | --- | --- |
| `src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatQuestionCarouselPart.ts` | DOM、Button/InputBox/Checkbox/scrollbar、Markdown renderer、DisposableStore；chatService 问题类型与 ChatQuestionCarouselData/viewmodel；DI、主题、无障碍、hover、contextkey、keybinding、commands、配置、telemetry、terminal chat services | 已读取 import 边界；不通过伪造 vscode API 凑运行，不在本轮重写迁移 |
| `chatElicitationContentPart.ts` 与 `chatElicitationActions.ts`（同一 chat 树） | chat viewmodel / action、命令与原平台服务；仍需主聊天确认可复用运行环境 | 未实施新视图 |
| 当前原生账户适配 | GitHub OAuth + app-owned credential store + 原 Host AHP authenticate；不依赖 React、workbench 或 DSH | 继续独立交付，未来视图仅使用无凭据投影 |
| 当前协议输入/transport | 官方 AHP SDK 类型与 reducer、能力验证和进程传输 | 继续独立交付，不复制会话 reducer |

不在此推定 DSH 插件兼容、通用 VSIX 支持、最终桌面容器或双运行时边界；等待主聊天可行性结论。
