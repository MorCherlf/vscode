<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# Agent/Sessions 界面迁移推进文档

2026-10-29，用户在本机运行首个 Tauri 原型后确认：目标是移除 VS Code 的常规编辑器并保留 Agent 的使用体验。Tauri 是容器选择，不构成重新设计产品界面的理由。此前简化 React 原型只证明底层连通性，不作为最终界面基准。

## 基线与实现边界

以本仓库 `e9e25186b016b9e0704cefb953fdfb07c0304ef0` 中的 `src/vs/sessions`、共享主题和设计规范为本轮来源。保留布局层级、主题、Codicons 和核心操作习惯；逐组件拆除 Electron、通用 workbench 服务和 Monaco 编辑器的依赖。允许重写平台绑定和视图适配，但不能把独立设计的聊天网页当作已经迁移的原版界面。

本轮是第一批源代码结构和交互迁移。直接复用 Codicons 资产，按源码生成颜色快照，适配原有 Sessions CSS primitives；React 视图和宿主适配是本项目代码。没有将原版 `ChatWidget` 整体搬入，也没有运行原版 Sessions 做截图差异比较，因此不宣称完整或逐像素还原。

| 来源 | 本轮复用/适配 | 独立客户端落点 |
| --- | --- | --- |
| [Agent 颜色](../../src/vs/workbench/common/agentsColors.ts)、[Light Modern](../../extensions/theme-defaults/themes/light_modern.json)、[Dark Modern](../../extensions/theme-defaults/themes/dark_modern.json)、[列表默认色](../../src/vs/platform/theme/common/colors/listColors.ts) | 保留 shell/panel 的明暗层级；解析完整 JSONC include 链，生成本客户端所需主题 token | `scripts/sync-vscode-theme.mjs`、`src/theme-colors.css` |
| [尺寸与文字角色](../../src/vs/platform/theme/common/sizes/baseSizes.ts)、[布局常量](../../src/vs/sessions/common/layoutConstants.ts)、[浮动面板间距](../../src/vs/workbench/common/agentsSizes.ts) | 字体角色、两档字重、控件/内容/浮层半径、4px 面板间距、950px 对话内容带 | `src/style.css` |
| [Sessions shell](../../src/vs/sessions/browser/media/workbench.css)、[侧边栏](../../src/vs/sessions/browser/parts/media/sidebarPart.css)、[紧凑新建按钮](../../src/vs/sessions/contrib/sessions/browser/media/newSessionActionViewItem.css) | 左侧会话导航、浮动主面板、紧凑新建操作、低层级页脚 | `src/App.tsx`、`src/style.css` |
| [新会话样式](../../src/vs/sessions/contrib/chat/browser/media/chatWidget.css)、[输入区](../../src/vs/sessions/contrib/chat/browser/media/chatInput.css)、[欢迎语](../../src/vs/sessions/contrib/chat/common/welcomePhrases.ts) | 居中欢迎与 800px 输入带、底部项目/Agent 工具栏、同一输入区在对话中下移 | `src/App.tsx`、`src/i18n.ts`、`src/style.css` |
| 上游锁文件中的 `@vscode/codicons@0.0.46-47` | 未修改的官方字体与图标 CSS，保留 CC BY 4.0 署名和许可 | npm 锁文件、设置署名、随包 `frontend-notices/` |
| 现有官方 AHP 核心和 Rust supervisor | 继续使用原本的状态权威、帧队列与进程边界 | `src/runtime.ts`、`src/bridge.ts`，未增加第二套会话 reducer |

## 本轮实际交互

会话按 Host 返回的工作目录分组并按修改时间排序；组可展开/收起，搜索标题或项目路径。选中状态依赖资源 URI，显示名相同的会话仍能区分。箭头键、Home/End 移动会话焦点，Enter 激活；⌘/Ctrl+N 回到新会话，⌘/Ctrl+B 收放侧边栏。

新会话从欢迎页输入任务后创建。项目路径通过明确的表单输入，当前不是原生文件夹选择器。草稿按会话 URI 与新会话分别保存在内存，切换会话不串用；创建后选择失败时保留新会话和草稿，重试不额外创建另一个会话。发送和取消仍走官方客户端，断线后显式重连同步，不自动重发结果未知的任务。

对话显示用户请求、Markdown/GFM、代码块、表格、思考折叠、工具状态、审批和复制。HTML 不执行，远程图片不加载，外链和 `command:` 链接不激活。M2-B 后续已加入协议文本约束、数值/布尔/选择/freeform 与 HTTPS URL 能力检查；是已有视图的适配，不是上游原组件复用，真实服务仍待验收。已提交/历史审批不可重复操作，服务端继续决定执行权限。

外观支持跟随系统、Light Modern 和 Dark Modern，仅颜色偏好写入本应用自己的存储键。弹窗使用原生 HTML dialog 提供焦点限制、Escape 和焦点恢复。Mac 使用系统窗口按钮与 Overlay 标题栏，只给 main 窗口增加拖动权限。没有伪造窗口按钮、模型菜单、变更列表或登录成功状态。

## 交付与验收

| 编号 | 目标 | 验收标准 | 本轮状态 |
| --- | --- | --- | --- |
| UI01 | Sessions shell 与新会话 | 来源可追溯；明暗主题、中文 720×520、会话侧栏及输入区可用；无 IDE 前端入口 | 已实现并通过浏览器检查 |
| UI02 | 会话与草稿 | 两个实际临时项目创建会话；草稿往返保留；搜索/分组/切换和取消通过实际 mock Host | 已实现并通过浏览器/协议集成 |
| UI03 | 工具与对话 | 流式回答、审批拒绝、重连后历史保留；代码/表格可读；无 HTML 执行或远程图片请求 | 已实现并通过确定性验证 |
| UI04 | 键盘与无障碍 | 主题重启保持、弹窗焦点/Escape、快捷键和合成组合输入保护有证据 | 已覆盖首批场景；原生中文输入法待测 |
| UI05 | 原版界面比较 | 同提交、同主题、同窗口大小和相同任务状态下，对原版 Sessions 与客户端做截图/操作对比；每项偏差有修复或明确原因 | 待执行，不以源码规则比对代替 |
| UI06 | 原生与完整流程 | WKWebView 中验证新建、输入法、粘贴、真实账户、工具审批、原生文件夹选择、真实任务中退出 | 待执行；完整 M2 验收继续未通过 |

执行证据、截图和准确平台边界见 [本轮报告](evidence/M2-ui/README.md)。缺少 UI05/UI06 时不能称为“完整迁移 VS Code Agent 界面”。

## 下一批工作包

1. M2-B：完成自有账户认证适配、Keychain 和协议实际支持的输入表单。保持本轮布局与运行时边界，把真实账户状态接到视图；所需 OAuth 配置明确列出，未配置也要完成可独立验证的工程。
2. 界面对照：准备能运行的原版 Sessions，固定基线与主题，补 UI05；修复布局、焦点、会话状态和长内容差异，不只对比空欢迎页。
3. M3 组件迁移：文件上下文、只读代码/文本 Diff、变更统计、命令输出和恢复流程。先审计每个原组件的服务依赖，再决定保留基础组件或替换绑定；未实现的面板不做空占位。
4. Mac 真机：补原生项目选择与 WKWebView/输入法/窗口生命周期，再开展签名和干净机器验收。本机构建成功不提前关闭这些门禁。

后续每轮应交付一组可实际操作的组件与功能、来源映射、针对性测试、截图及残余偏差，更新现有实现分支和草稿 PR #2，不自动合并或发布。

最新用户约束：后续尽可能直接复用原组件，并以插件生态/持续合并上游及 DSH 可行性为基础推进。主聊天维护 `feasibility/`；不再扩大仿写 React UI 或手写 vscode API 子集。最终双运行时/桌面容器尚未决定，原主题/资产复用不作为原组件复用证明。
