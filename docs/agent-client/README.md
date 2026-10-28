<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# Agent 专用客户端项目总览

项目目标是把当前 VS Code 仓库中的 Agent 能力做成独立应用：使用 Tauri 客户端，保留 Copilot Agent、会话、工具、结果审阅和 Agent 扩展，移除常规 IDE 工作台及编辑器扩展。优先验证 macOS，再考虑网页、Windows 和 Linux。

当前阶段：规划完成，工程里程碑尚未启动。基于源码版本 `1.145.0`、提交 `f0e704e856d` 制定，规划日期为 2026 年 10 月 28 日。文档中的性能数字是建议的验收目标，不是已有实测结果。

## 阅读入口

| 文档 | 用途 |
| --- | --- |
| [方案总结](SOLUTION.md) | 产品边界、推荐架构、复用与重写范围、主要技术取舍 |
| [Roadmap](ROADMAP.md) | 里程碑顺序、依赖、交付物和进入下一阶段的门禁 |
| [目标与验收矩阵](GOALS.md) | 统一的目标编号、验收标准、对应里程碑 |
| [验证与证据规范](VALIDATION.md) | 功能场景、性能测量口径、结果记录与发布判定 |
| [Codex 云端推进交接](CLOUD_HANDOFF.md) | 云端首个任务、执行范围、Mac 验收交接和继续推进规则 |

## 里程碑推进文档

| 编号 | 大目标 | 状态 |
| --- | --- | --- |
| [M0](milestones/M0-baseline.md) | 能力边界、依赖清单和性能基线 | 待启动 |
| [M1](milestones/M1-standalone-host.md) | 可独立分发的 Agent Host | 待启动 |
| [M2](milestones/M2-tauri-client.md) | Tauri 客户端和 AHP 通信验证 | 待启动 |
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
5. 未来实现建议放在独立的 `apps/agent-client/`、`packages/agent-host/`、`packages/agent-extension-host/` 和 `packages/agent-client-core/` 中；这些是规划位置，当前未创建工程。
6. 未来证据存入本目录的 `evidence/`；每次验收记录提交、环境、命令、结果和限制。真实账户凭据与完整聊天内容不进入仓库。

## 首版完成条件

M0 至 M7 的门禁全部通过，G01 至 G12 均有验收记录；性能在扩展关闭和兼容扩展启用两种模式下均按相同能力基线比较；安装包在没有 VS Code 和开发环境的 Mac 上完成真实任务。M8 不阻塞首版发布。

首版的“完整 Agent 流程”指目标矩阵定义的能力。任意 VS Code 扩展兼容、旧 Local harness 的全部行为、远程与云端产品能力不自动包含在这个承诺中；它们必须在 M0 能力清单中明确分类，不能在发布时才发现缺口。
