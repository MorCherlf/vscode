<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# Agent 专用客户端 Roadmap

采用“独立 Agent Host、Tauri 验证、核心任务、扩展兼容、性能与发布”的推进顺序。首先证明客户端能脱离 VS Code 完成任务，再扩大兼容范围。既有 `src/vs/sessions` 用作行为参考，不作为整包搬运的客户端。

## 阶段与交付物

| 里程碑 | 主要目标 | 前置条件 | 可验收交付物 | 退出门禁 |
| --- | --- | --- | --- | --- |
| [M0](milestones/M0-baseline.md) | 确定能力和性能基线 | 当前源码可读；真实账户测试具备条件 | 能力矩阵、依赖清单、扩展候选清单、基线报告、首轮决策记录 | G01 至 G12 有验证计划；每项能力有首版或后续归属；性能测量能复现 |
| [M1](milestones/M1-standalone-host.md) | 独立提取和分发运行时 | M0 工程审计通过；Mac 基线另行补验 | 单独构建的 Node Agent Host、资源与原生依赖清单、真实 Copilot 连通记录 | 不依赖 VS Code 安装或 Electron 进程，完成无界面任务；测试与开发依赖不进入产物 |
| [M2](milestones/M2-tauri-client.md) | 验证 Tauri 和 AHP 路线 | M1；M0 可先准备界面原型 | Tauri 应用、进程管理、AHP 适配、登录与重连原型 | 真机完成登录、会话、流式响应、取消与重连；WKWebView 关键交互通过 |
| [M3](milestones/M3-agent-workflow.md) | 完成本地 Agent 任务流程 | M2 | 会话管理、权限交互、文件上下文、命令结果、Diff、检查点或可用的变更恢复 | 固定任务中完成读取、修改、命令、审阅、恢复；拒绝和中断路径也通过 |
| [M4](milestones/M4-agent-plugins.md) | 保留原生 Agent 扩展能力 | M3；插件适配可在 M2 后准备 | MCP、Skills、Agents、指令、Prompts、Hooks 和插件管理 | 测试插件可安装、发现、调用、禁用、卸载与重启恢复；账户与项目作用域不串用 |
| [M5](milestones/M5-extension-compatibility.md) | 保留适用的 VS Code Agent 工具扩展和富交互 | M3、M4 | 扩展兼容清单、按需 Node 扩展宿主、工具桥接、浏览器工具和 Canvas 适配报告 | 兼容样本通过，编辑器扩展不激活；首版富交互项通过，未支持项准确标示 |
| [M6](milestones/M6-performance.md) | 验证瘦身收益 | M3 至 M5 的首版能力稳定 | 依赖与包体报告、性能结果、热点优化、回归预算 | G09 性能目标和 G10 裁剪要求通过，且功能覆盖不下降 |
| [M7](milestones/M7-macos-release.md) | 交付 macOS 独立应用 | M6 | 签名与公证产物、安装更新流程、诊断包、上游同步流程和用户说明 | 全部首版目标通过；干净机器实测；升级与回退数据兼容通过 |
| [M8](milestones/M8-follow-up.md) | 其他平台和有证据的原生化 | M7 | 按分支立项的网页、Windows、Linux 或 Rust 热点替换 | 每个分支独立满足功能与性能条件，不改变首版已发布承诺 |

## 依赖图

```mermaid
flowchart LR
	M0["M0 基线与边界"] --> M1["M1 独立 Host"]
	M1 --> M2["M2 Tauri 验证"]
	M2 --> M3["M3 核心任务"]
	M3 --> M4["M4 原生插件"]
	M4 --> M5["M5 工具扩展兼容"]
	M3 --> M6["M6 性能验收"]
	M5 --> M6
	M6 --> M7["M7 macOS 发布"]
	M7 --> M8["M8 后续分支"]
```

兼容性审计和性能采样从 M0 开始贯穿全程。图中的顺序表示验收依赖，不要求所有准备工作串行；功能不完整时的性能结果只能作为诊断，不能作为 M6 最终成绩。

## 三个阶段成果

| 阶段成果 | 包含里程碑 | 应当能展示的结果 |
| --- | --- | --- |
| 技术可行性 | M0 至 M2 | 一台不运行 VS Code 的 Mac，通过 Tauri 控制独立 Copilot Agent Host |
| 日常任务可用 | M3 至 M5 | 对项目执行真实修改，审阅结果，并使用选定的 Agent 插件和工具扩展 |
| 可发布产品 | M6 至 M7 | 在保持约定能力的情况下，体积、资源和启动改善达到目标，且可独立安装更新 |

## 关键决策门禁

- M0 明确 Copilot Agent Host 与旧 Local harness 的能力差异。缺失的编辑器上下文、语言诊断或云能力必须有替代方案或后续归属。
- M1 核实 Copilot 登录、所需服务配置和运行时能否在自有应用中实际工作。源码可编译与真实账户可用分别验收。
- M2 决定是否继续使用 Tauri。若关键工具或交互依赖 Electron 专有机制，先完成替代验证；仍不可用则保留 Host 成果，记录客户端选型调整，不无限增加 Tauri 适配层。
- M5 用真实扩展依赖确定兼容上限。Agent 贡献点是候选筛选条件，运行验证才是兼容结论；无法兼容的首版必选扩展会阻塞该门禁。
- M6 验证完整能力的资源收益。不能通过删除必选扩展、漏算浏览器进程或把必需运行时改成下载项来达标。

## 范围和排期

首版平台为 macOS arm64；macOS x64、网页和其他桌面平台进入 M8。框架为 Tauri 2、Rust 外壳、TypeScript 前端和复用的 Node Agent Host。精确依赖版本在对应里程碑实现时锁定，不追踪未固定的最新版本。

实施主要在 Codex 云端推进。M0 拆分为工程审计和 Mac 基线：能力、依赖、测试设计与版本风险审计完成后，可进入 M1 的独立构建实现；缺少 Mac 的测量不能伪造或改为 Linux 成绩，M0 完整状态保持待验收。云端完成的 M1、M2 工作同样区分实现与最终验收，详见 [Codex 云端推进交接](CLOUD_HANDOFF.md)。

暂不承诺日历日期。M0 完成后以工作包估算工期；M2 和 M5 分别是客户端适配和扩展兼容的主要不确定性。计划变化必须写明受影响目标、已经投入的工作以及新的验收路径。

## 统一完成定义

- 交付物可从记录的提交构建，步骤不依赖个人目录、开发机缓存或现有 VS Code 安装。
- 目标矩阵中的对应场景通过，并提供结果记录；“暂不支持”不能代替必选能力的通过证据。
- 已记录失败场景、剩余限制与恢复方式，无未处理的数据丢失或权限绕过问题。
- 推进文档的状态、交付物和下一步同步更新。只有证据齐全才改为“已验收”。

## 2026-10-28 工程推进

M0 工程审计完成、完整基线待 Mac 验收；M1 的首个独立 Node Host 构建与确定性验证已落地于 `packages/agent-host/`。证据见 [M0](evidence/M0/README.md) 与 [M1](evidence/M1/README.md)。下一工作包为 [M1-B](evidence/M1/NEXT.md)，先闭合真实 Copilot、故障恢复和目标平台分发门禁；M2 与后续里程碑不因本次构建成功而自动完成。

用户续作授权后，M2.1–M2.3 和 M2.5 的云端工程与 M1 剩余验收并行推进：官方 AHP SDK、Tauri 外壳、进程管理和确定性测试已落地。M2.4 原生账户/Keychain 适配尚未实现，M2.6 WKWebView 与真实 Mac 生命周期未验收。见 [M2 报告](evidence/M2/README.md)，完整门禁不变。
