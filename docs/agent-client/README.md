<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# Agent 专用客户端项目总览

## 人工交付顺序（当前优先）

遵循 [HUMAN_ACCEPTANCE](HUMAN_ACCEPTANCE.md)：H1 剪裁后的 VSC Agent → H2 最小 DSH Bridge → H3 导入 DSH 插件 → H4 完整 Agent，分四次人工交付，不合并验收。当前先做 H1，不等 Bridge。见 [H1 工程证据](evidence/AF/H1/README.md) 与 [下一工作包](evidence/AF/H1/NEXT.md)：原组件浏览器测试和 mock Host 发现已有运行证据；原桌面云端 IPC 受限、完整加载排除/真实任务/Mac 版本仍待完成，尚不可提交人工验收。DSH 准备工作保留且未启用。只有用户明确确认才能标人工通过。 2026-10-30 已进一步裁掉五组原编辑器贡献入口，原 Worker EH 准入/依赖探针和原只读 diff fixture 通过；同探针 A/B 为 4,993 → 4,901 JS 请求，worker 数未下降，仍非完整裁剪/真实任务/Mac 门禁。见 [本轮原始证据](evidence/AF/H1/2026-10-30/README.md)。 后续 [H1 迭代 3](evidence/AF/H1/2026-10-30-editor-routes/README.md) 已关闭通用编辑器窗口入口并加入原生路由边界，18 项纯决策测试及普通 Web 产品对照通过；原生窗口未运行。全量层次检查这次返回 0；本轮三类 Worker 已有来源取证。[H1 迭代 4](evidence/AF/H1/2026-10-30-review-policy/README.md) 已接入原文本视图审阅策略，保留原 Agent API 写入与 Profile 配置编辑；原 ChatWidget/InputPart 实际键盘输入、项目代码拒绝手改、原 BulkEdit 保存及普通产品对照通过，针对性测试 47 项通过。[H1 迭代 5](evidence/AF/H1/2026-10-30-file-commands/README.md) 已移除十个手工文件修改命令及相关快捷键/菜单，增加 Explorer 拖入与迟到 drop 防护；77 项测试与原工作台普通产品对照通过，原 FileService 创建/移动/复制/删除和 BulkEdit 保存保留。H1 仍待自定义/合并编辑器与原生加载范围、真实任务、Mac 版本及人工验收。

当前产品方向是 VSC Agent First：直接复用原 Agent/Sessions 组件和原扩展宿主，禁用编辑器专用插件，不主动加载 editor-only 组件；DSH 使用自有 VS Code 插件适配器，插件继续由原 DSH 运行时加载。双方独立保留同步上游的路径。方向已由用户确认，具体边界见 [ADR-001](ADR-001-agent-first-dsh-extension.md)，方案见 [SOLUTION](SOLUTION.md)。首版优先 macOS arm64；最终容器仍待验证。

[完整可行性报告](feasibility/README.md) 与 [PoC 计划](feasibility/POC_PLAN.md) 保留调研来源；其中广泛编辑器兼容/恢复一般 IDE 的候选范围已由 ADR 收窄。新增 AF-01/02 仅有 H1 浏览器/加载基线的部分证据，AF-01–06 完整门禁均未通过，会话 API 编译探针已通过。下文原 M0–M8 状态只表示已有原型交付，不把方向调整或类型检查当成运行验收。

当前阶段（2026-10-29）：M0 工程审计已交付，完整性能基线仍待验收；M1 独立 Host 已通过 Linux 与本机 Mac 原生/确定性验证；M2 已产出 Mac arm64 Release 开发包，并交付 Sessions 界面首批迁移。真实账户、Keychain、完整 WKWebView 与原版界面对照等门禁仍未通过。规划基于源码版本 `1.145.0`、提交 `f0e704e856d` 制定；文档中的性能数字是建议的验收目标，不是已有实测结果。

## 阅读入口

| 文档 | 用途 |
| --- | --- |
| [ADR-001：Agent First 与 DSH 插件适配](ADR-001-agent-first-dsh-extension.md) | 已确认的方向、插件准入、原组件裁剪、扩展会话桥、DSH 行为和 AF 门禁 |
| [方案总结](SOLUTION.md) | 产品边界、推荐架构、复用与重写范围、主要技术取舍 |
| [VSC / DSH 双生态可行性报告](feasibility/README.md) | 新方向的原组件复用、两类插件兼容、Tauri 取舍、双上游维护与成本 |
| [双生态验证与推进计划](feasibility/POC_PLAN.md) | 七组 PoC、F0–F4 工作包、验收与失败处理；均待执行 |
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
5. 现有原型在 `apps/agent-client/`、`packages/agent-host/`、`packages/agent-client-core/` 和 `packages/agent-host-supervisor/` 保留。后续原组件/原扩展宿主沿用上游路径，DSH 特有内容集中在自有 VSIX/驱动插件；不再建设手写 API 子集的独立扩展宿主。新增目录在 AF 实现时决定并记录。
6. 执行证据存入本目录的 `evidence/`；每次验收记录提交、环境、命令、结果和限制。真实账户凭据与完整聊天内容不进入仓库。

## 首版完成条件

按新方向完成相应 M0 至 M7 与 AF-01–06 门禁，G01 至 G12 均有验收记录；VSC Agent 插件和 DSH 启用/关闭的资源按同能力基线比较；安装包在没有 VS Code 和开发环境的 Mac 上完成真实任务。M8 不阻塞首版发布。旧阶段凭据/签名/真实账户门禁继续保留，性能预算校准按 GOALS 在优化前记录。

首版的“完整 Agent 流程”指目标矩阵定义的能力。任意 VS Code 扩展兼容、旧 Local harness 的全部行为、远程与云端产品能力不自动包含在这个承诺中；它们必须在 M0 能力清单中明确分类，不能在发布时才发现缺口。

## 本次工程交付

见 [M0 审计](evidence/M0/README.md)、[M1 验证](evidence/M1/README.md)、[独立 Host 使用说明](../../packages/agent-host/README.md) 和 [下一工作包 M1-B](evidence/M1/NEXT.md)。早期云端报告的环境边界保留不变；新增 [Mac 运行时与 Sessions 界面验证](evidence/M2-ui/README.md) 单独记录本机结果。Keychain、完整 WKWebView 和签名验收仍未执行，未自动合并或发布。

M2 续作见 [执行证据](evidence/M2/README.md) 与 [下一工作包](evidence/M2/NEXT.md)。源码、锁文件和证据已通过实现分支与 [草稿 PR #2](https://github.com/MorCherlf/vscode/pull/2) 独立审阅，不以开发构建代替发布验收。
