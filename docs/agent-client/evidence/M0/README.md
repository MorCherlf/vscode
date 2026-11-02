<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# M0 工程审计（2026-10-28）

执行者：Codex。基线分支 `codex/agent-client-roadmap`，提交 `5d89fa5583233f7aefd2ad65db8296e775d1099b`，源码产品 `1.145.0`。本轮实现以此提交的工作区 diff 为身份，不冒称新的已提交版本。

工程边界评审结论：允许进入 M1 的独立构建与确定性验证。M0 完整验收保持待验收；没有 Mac 基线、真实账户或扩展运行兼容结果。性能预算不调整。

## 环境及连接诊断

最初 `/workspace/scratch/11910be6d76c` 没有仓库，`git rev-parse --show-toplevel` 返回 `fatal: not a git repository (or any of the parent directories): .git`。GitHub connector 成功读取仓库元数据、根 AGENTS.md 和交接文档，`git ls-remote` 返回目标分支等于交接 SHA；随后 `git clone --depth 1 --single-branch --branch codex/agent-client-roadmap https://github.com/MorCherlf/vscode.git vscode` 成功。环境创建页和设置聊天的服务端错误日志不在当前环境中，不能据此推断其根因，也不能宣称修好了页面。可用的替代工程环境已经实际检出。

运行平台：Linux x86_64，内核 6.18.55；普通 Node v24.22.1（ABI 137），npm 11.9.0；gcc、make、Python 3.12.14 可用；无可用 cargo 命令、macOS、WKWebView、Keychain、签名或公证环境。只安装 `packages/agent-host` 依赖，不执行根目录 Electron 安装钩子。

已读根 AGENTS.md、.github/copilot-instructions.md、CLOUD_HANDOFF.md、README/SOLUTION/ROADMAP/GOALS/VALIDATION、M0/M1 推进文档，以及 Agent Host 的局部架构和 serviceBootstrapping 指令。新增实现放在 packages，未修改协议、provider 的服务图和提示词预算。

## 证据索引

- [能力矩阵](capabilities.md)：M0.1、G01–G12 的归属与场景。
- [依赖与资源审计](dependencies.md)：M0.2，静态与动态闭包、适配边界。
- [扩展样本](extensions.md)：M0.3，受控最低合同和真实仓库候选。
- [数据集和基线交接](baseline.md)：M0.4/M0.6，固定数据及 Mac 步骤。
- [版本与决策](risks.md)：M0.5，阻塞项和实现顺序。
- [M1 执行报告](../M1/README.md)：构建与运行结果；静态审计不等于运行通过。
