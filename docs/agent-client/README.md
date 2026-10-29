<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# Agent 专用客户端项目总览

项目目标是把当前 VS Code 仓库中的 Agent 能力做成独立应用：使用 Tauri 客户端，保留 Copilot Agent、会话、工具、结果审阅和 Agent 扩展，移除常规 IDE 工作台及编辑器扩展。优先验证 macOS，再考虑网页、Windows 和 Linux。

当前阶段（2026-10-29）：M0 工程审计已交付，完整性能基线仍待验收；M1 独立 Host 已通过 Linux 与本机 Mac 原生/确定性验证；M2 已产出 Mac arm64 Release 开发包，并交付 Sessions 界面首批迁移。真实账户、Keychain、完整 WKWebView 与原版界面对照等门禁仍未通过。规划基于源码版本 `1.145.0`、提交 `f0e704e856d` 制定；文档中的性能数字是建议的验收目标，不是已有实测结果。

## 阅读入口

| 文档 | 用途 |
| --- | --- |
| [方案总结](SOLUTION.md) | 产品边界、推荐架构、复用与重写范围、主要技术取舍 |
| [Roadmap](ROADMAP.md) | 里程碑顺序、依赖、交付物和进入下一阶段的门禁 |
| [目标与验收矩阵](GOALS.md) | 统一的目标编号、验收标准、对应里程碑 |
| [验证与证据规范](VALIDATION.md) | 功能场景、性能测量口径、结果记录与发布判定 |
| [界面迁移推进文档](UI_MIGRATION.md) | VS Code Agent/Sessions 的组件来源、分批迁移和界面对照门禁 |
| [Codex 云端推进交接](CLOUD_HANDOFF.md) | 云端首个任务、执行范围、Mac 验收交接和继续推进规则 |

## 里程碑推进文档

| 编号 | 大目标 | 状态 |
| --- | --- | --- |
| [M0](milestones/M0-baseline.md) | 能力边界、依赖清单和性能基线 | 待验收（工程审计完成） |
| [M1](milestones/M1-standalone-host.md) | 可独立分发的 Agent Host | 进行中（Linux/Mac 原生与确定性验证通过，真实任务待验收） |
| [M2](milestones/M2-tauri-client.md) | Tauri 客户端和 AHP 通信验证 | 进行中（Mac 开发包与首批界面迁移已交付，账户/完整界面和真机交互待验收） |
| [M3](milestones/M3-agent-workflow.md) | 完整的本地 Agent 任务流程 | 待启动 |
| [M4](milestones/M4-agent-plugins.md) | Agent 原生插件与自定义能力 | 待启动 |
| [M5](milestones/M5-extension-compatibility.md) | Agent 工具扩展及富交互兼容 | 待启动 |
| [M6](milestones/M6-performance.md) | 体积、启动、内存和交互优化 | 待启动 |
| [M7](milestones/M7-macos-release.md) | macOS 独立发布与可维护性 | 待启动 |
| [M8](milestones/M8-follow-up.md) | 网页、其他平台与按热点原生化 | 后续阶段 |

## 推进规则

1. 先执行 M0 的能力与依赖审计，确认工程边界和扩展兼容清单，再进入代码实现。云端可在工程审计通过后推进 M1，不必等待 Mac 基线；M0 的完整验收仍需 Mac 证据，规则见云端交接。
2. 每个推进文档包含目标、输入、任务、交付物、验收和失败处理；接手者从文末的下一步开始。
3. 状态统一为“待启动、进行中、待验收、已验收、受阻”。完成代码不等于已验收；验收必须有可复现证据。
4. `GOALS.md` 定义全局标准，`VALIDATION.md` 定义测量方式，里程碑文档细化本阶段执行。改变标准时同步更新受影响文档和决策记录。
5. 未来实现建议放在独立的 `apps/agent-client/`、`packages/agent-host/`、`packages/agent-extension-host/` 和 `packages/agent-client-core/` 中；其中 `packages/agent-host/`、`packages/agent-client-core/`、`apps/agent-client/` 已创建，Rust 进程管理在 `packages/agent-host-supervisor/`，扩展宿主仍是规划位置。
6. 执行证据存入本目录的 `evidence/`；每次验收记录提交、环境、命令、结果和限制。真实账户凭据与完整聊天内容不进入仓库。

## 首版完成条件

M0 至 M7 的门禁全部通过，G01 至 G12 均有验收记录；性能在扩展关闭和兼容扩展启用两种模式下均按相同能力基线比较；安装包在没有 VS Code 和开发环境的 Mac 上完成真实任务。M8 不阻塞首版发布。

首版的“完整 Agent 流程”指目标矩阵定义的能力。任意 VS Code 扩展兼容、旧 Local harness 的全部行为、远程与云端产品能力不自动包含在这个承诺中；它们必须在 M0 能力清单中明确分类，不能在发布时才发现缺口。

## 本次工程交付

见 [M0 审计](evidence/M0/README.md)、[M1 验证](evidence/M1/README.md)、[独立 Host 使用说明](../../packages/agent-host/README.md) 和 [下一工作包 M1-B](evidence/M1/NEXT.md)。早期云端报告的环境边界保留不变；新增 [Mac 运行时与 Sessions 界面验证](evidence/M2-ui/README.md) 单独记录本机结果。Keychain、完整 WKWebView 和签名验收仍未执行，未自动合并或发布。

M2 续作见 [执行证据](evidence/M2/README.md) 与 [下一工作包](evidence/M2/NEXT.md)。源码、锁文件和证据已通过实现分支与 [草稿 PR #2](https://github.com/MorCherlf/vscode/pull/2) 独立审阅，不以开发构建代替发布验收。
