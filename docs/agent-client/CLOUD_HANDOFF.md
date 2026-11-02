<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# Codex 云端推进交接

## 人工交付顺序（当前优先）

遵循 [HUMAN_ACCEPTANCE](HUMAN_ACCEPTANCE.md)：H1 剪裁后的 VSC Agent → H2 最小 DSH Bridge → H3 导入 DSH 插件 → H4 完整 Agent，分四次交付；只有用户明确确认才标人工通过。当前先闭合 H1，DSH 保留且未启用。

已整合远端 `988fbfd2`：保留 [Mac 外部 VSIX 矩阵](evidence/AF/H1/2026-10-30-mac-vsix-matrix/README.md) 的 checkout78b70f4/product09c0374 实际安装、六次启用拒绝与重启对照；保留 [native 窗口 API 修复](evidence/AF/H1/2026-10-30-mac-native-window-api/README.md) product20c9dc7 的正常目录/canonical 两正向与六拒绝。历史 0bec73f、96fa875 失败按原版本保留，不把旧开发扫描结果归到更新后的入口策略。

最新 [原资源 resolver/占位视图工作包](evidence/AF/H1/2026-10-30-provider-resource/README.md) 防止无 owner 的旧 custom-editor cache 在 Sessions 产品准入前注册；Agent First 不再加载 Test Custom View 占位贡献，保留原服务和普通产品行为。6 项原 resolver 回归、47 项原 custom view/editor resolver/auth gate 测试、原界面两路对照、类型/构建/lint/layers 通过，属于 Linux/browser/fixture 证据。后端真实路径见 [backend/认证调查](evidence/AF/H1/2026-10-30-provider-resource/BACKENDS.md)：GitHub OAuth 不作为所有 backend、本地界面或裁剪工程的通用前置；本轮未启动真实 SDK/账户任务。

H1 仍为工程进行中，尚不可提交人工验收。剩余原生 OS/CLI/旧恢复/custom pane、真实 provider 任务、完整任务时加载归因、IME/VoiceOver、独立 Mac 包等门禁保留。见 [H1 证据索引](evidence/AF/H1/README.md) 与 [NEXT](evidence/AF/H1/NEXT.md)。生产 executable 清单 []，DSH/H2–H4 未启用，不合并或发布。

用户已经授权把 Agent 客户端路线转交 Codex 云端实施。目标仓库为 `MorCherlf/vscode`，初始交接分支为 `codex/agent-client-roadmap`。云端从该分支中的规划开始推进，不把本地未推送文件或其他聊天历史当作必要输入。

## 当前接力（2026-10-30）

当前权威方向是 [ADR-001](ADR-001-agent-first-dsh-extension.md)，用户已确认 VSC Agent First、禁用编辑器专用插件、不主动加载 editor-only 组件；DSH 尽量由一个自有 VS Code 插件适配，保留原 runtime/profile/插件行为和独立上游升级。SOLUTION/GOALS/ROADMAP/VALIDATION 已同步，原报告保留研究候选。不要恢复一般 IDE 兼容区；不要继续扩大仿写 React UI 或手写 vscode API 子集。

会话注册/工具调用的严格编译探针已通过，但AF-01/02 已有 H1 浏览器/加载基线的部分证据，所有 AF-01–06 完整运行门禁尚未通过。接手优先闭合 H1 / AF-01/02 原组件与裁剪运行，AF-03 的独立准备可保留但不能阻塞 H1，并记录 AF-02 加载基线：原 `chatSessionsProvider` 接口是 proposed，需要产品级精确 allowlist；原 Agents Window 不自动列出任意扩展会话，必要时只增加通用 `extensionSessions` provider，DSH 特有逻辑留在 VSIX/驱动层。DSH loop 不替换为 VSC 模型 provider，SDK 逐会话取消缺口按原 Cordis 驱动补足。最终容器仍候选。

继续现有实现分支 `codex/agent-client-implementation` 与草稿 PR #2，base 保持 `codex/agent-client-roadmap`。M0/M1 首轮和 M2 初始工程已经提交；本机又交付 Mac 原生/确定性验证及 Sessions 界面首批迁移。先读 [当前报告](evidence/M2-ui/README.md)、[界面目标与来源](UI_MIGRATION.md) 和 [M2-B](evidence/M2/NEXT.md)，不要把下面的首轮任务重新执行一遍。

M2-B 已交付上述原生账户、存储边界、协议输入与故障工程，见 [M2-B 证据](evidence/M2/M2-B/README.md)。与新架构独立的本提交 Mac 编译/Keychain、专用真实账户与未覆盖故障验收可以继续；保留已验证的协议/进程边界，新增界面工作按原组件 PoC 评估。原生自有 OAuth client ID 未配置时明确 unconfigured；没有真实凭据时继续独立可验证工程；不能宣称真实登录通过。原版界面对照、WKWebView 和性能门禁另行补验。

如果旧云端工作区路径消失，先检查当前任务的可用工作区，保留任何已有 checkout 与未提交改动。确认没有可继续的仓库后，可以从 GitHub 已提交的实现分支恢复到一个新目录并记录来源；这不等于恢复丢失的未提交文件。不要重置或覆盖现有目录，也不要仅因旧挂载缺失要求用户手动恢复而停止所有推进。

## 首个任务（历史记录）

首个任务完成 M0 的工程审计，并推进 M1 独立 Agent Host 的第一个可构建、可测试实现。交付必须包含实际源码或构建配置变化、针对性验证和审计证据，不能只重写规划或把缺少 Mac 当成停止所有工作的理由。

先读根目录 `AGENTS.md`、适用的 `.github/copilot-instructions.md`，再读本目录的 `README.md`、`SOLUTION.md`、`ROADMAP.md`、`GOALS.md`、`VALIDATION.md`、M0 与 M1 推进文档。进入 Agent Host 或其他子目录前读取对应的局部指令。若云端环境提供运行说明或技能，先按其要求确认网络、工具和依赖。

## 首个任务的工作顺序

1. 记录检出的分支、提交、系统、Node、包管理器和可用工具。确认全部规划文档存在且可读；报告实际环境，不假定 Linux 或 Mac。
2. 审计独立 Host 入口与服务构造，追踪静态和动态导入、worker、WASM、原生模块、SDK、运行时、产品配置及认证。明确独立构建需要保留和适配的部分。
3. 在 `docs/agent-client/evidence/M0/` 新增能力矩阵、依赖清单、扩展兼容样本和版本风险记录。源码结论附具体位置；不能把静态阅读标成运行验证。
4. 确认工程边界后实现 M1 的独立构建入口和资源清单。优先在 `packages/agent-host/` 建立适配，按仓库约定调整必要的构建配置；避免搬入完整 Electron 或工作台构建。
5. 为当前云端平台构建并验证 Host、worker 与原生依赖。优先使用现有受控或 mock provider 验证 readiness、鉴权、会话、停止和资源路径，补充与实际改动相关的最小测试。
6. 如果环境已安全配置 Copilot 测试凭据，完成真实模型和任务验证；没有凭据则保留明确的待验收项，继续构建、协议和资源验证，不读取本地个人凭据或制造令牌。
7. 更新 M0、M1 状态、证据索引和下一步。保留实际 diff、验证命令与失败信息，形成可审阅的成果；按云端现有工作流提交结果，不自动合并或发布。

若独立构建依赖尚未闭合，交付已实现的构建工作和准确阻塞点，给出下一个具体工作包。不能为了凑完成状态返回空实现或只用文字模拟构建成功。

## 云端与 Mac 分工

| 工作 | 云端可以推进的部分 | 需要 Mac 或其他外部条件的验收 |
| --- | --- | --- |
| M0 | 能力、依赖、扩展、版本与风险审计；受控数据集和采样脚本 | B0、B1 的 macOS 真实启动、内存与交互基线 |
| M1 | 独立构建、资源闭包、当前平台运行、鉴权和确定性协议测试 | macOS arm64 依赖、真实 Copilot 账户和干净 Mac 运行 |
| M2 | Tauri 工程、共享前端、transport、状态和生命周期实现；当前平台允许的检查 | WKWebView、中文输入法、Keychain 和 Mac 进程行为 |
| M3 至 M5 | 核心流程、插件、扩展与富交互适配及确定性测试 | 受平台限制的真机与真实账户场景 |
| M6 | 依赖与包体分析、热点诊断、采样与回归工具、当前平台性能报告 | 约定硬件上同能力 macOS 性能目标 |
| M7 | 打包流程、版本清单、诊断和升级恢复实现 | 发布凭据、签名公证、隔离属性与干净 Mac 测试 |

M0 工程审计通过后可开展 M1 实现，不以缺少 Mac 基线阻塞无关工程工作。最终仍遵循原有验收门禁：M0、M1 等里程碑缺少必需证据时保持进行中或待验收，不因云端完成可做部分就改为已验收。

## 执行约束

- 原阶段 Tauri/轻量界面保留历史原型。执行 ADR-001 的原组件与 Agent First 准入，混合插件默认不自动启用，不将“带有 Agent contribution”视为放行全部激活路径。原版 Electron/Web 的必要基线实验可执行，最终容器经门禁决定，不擅自全量改写 Rust 后端。
- 新增工程代码时遵循适用指令；独立 Host 常规迭代采用最小安装与验证范围。原组件/插件基线若需要原工作台构建，按新 PoC 范围执行并记录输入，不重复启动已有构建任务。
- 保留现有源文件以方便对照与上游同步；裁剪发布和激活清单，不批量删除编辑器源码。
- 不把网络受限、缺少测试凭据、缺少原生系统依赖与产品缺陷混为一谈，分别记录失败来源。
- 真实凭据只通过云端环境的秘密配置使用，不写入仓库、提示词、日志和证据。
- 不把 Linux、mock、静态检查和真实 Mac 结果混用。性能目标沿用 `GOALS.md`，不能为达标追溯降低标准。
- 原生插件与经验证的工具扩展按既定分层推进，不声明任意 VSIX 兼容，不以空 API 冒充实现。

## 任务输出和后续交接

任务结果应说明实际实现、验证、证据、未完成验收项以及下一个工作包。后续从已交付提交继续，以当前 ADR/AF 门禁为先；既有 M1 构建/认证等独立缺口可继续闭合，复用已通过且输入未改变的结果。

Mac 待验收清单记录测试名、所需产物、精确运行步骤、预期结果和结果回填位置，使本地执行者无需重新调研即可接手。云端任务结束只代表该次交付完成，不代表整个 roadmap 自动完成。

架构边界以 ADR-001 为准，原主题/资产复用不等于原组件复用。双运行时由 VSIX/驱动层衔接，原会话/插件包与数据保持各自权威，两个上游分别锁版回归；编译、静态分析、确定性 fixture、真实 DSH、Mac 和真实账户结果分别报告。
