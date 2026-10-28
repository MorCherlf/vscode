<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# 上轮 M0/M1 交付复核与持久化

本轮未重新克隆、未丢弃已有源码和证据。最初工作区仍处于 `MorCherlf/vscode` 的 `codex/agent-client-roadmap`，HEAD `5d89fa5583233f7aefd2ad65db8296e775d1099b`，原有 35 个文件改动完整保留。

已读取原始 `evidence/M1/tests.log`，命令是 `npm --prefix packages/agent-host test`，实际脚本为 `node --test test/*.test.mjs`；原报告 5 tests / 5 pass / 0 fail / 0 skip，耗时 13.650 秒。前置构建命令与原始输出分别在 M1/build.log 和 build-test.log，即 `npm --prefix packages/agent-host run build`、`npm --prefix packages/agent-host run build:test`。

| 证据类别 | 原报告实际做了什么 | 不能推导的结论 |
| --- | --- | --- |
| mock/确定性 | ScriptedMockAgent、fixture.invalid 认证、会话流、双客户端、取消、元数据恢复、stdin/信号停止、端口冲突 | 不等于真实 GitHub 账户鉴权或模型行为 |
| 实际原生/worker/WASM | 普通 Node ABI 的 SQLite/PTY、Diff worker、bash/powershell WASM、ripgrep、递归 watcher 实际运行 | 不等于 macOS arm64 ABI 或干净 Mac 可分发 |
| SDK/runtime 实际握手 | 无模型任务的 SDK/runtime start/ping/getStatus/stop，版本 1.0.103-unstable.r40031404408.gba6c003 | 不等于调用真实 Copilot 模型，更不等于 T05 修改项目成功 |
| 真实 Copilot | 上轮未配置专用凭据，未运行 | M1 必须继续保持进行中 |
| Mac 与发布 | 未运行 | M0 基线、M1/M2 Mac、Keychain/WKWebView、签名与真机门禁继续保留 |

本轮再次核对 M1 manifest 的源码哈希与现有 Host 输入一致，因此复用原报告；没有为了提交/PR 而重跑无关测试。M2 新增测试另外记录，不覆盖或改写原报告。

实现分支 `codex/agent-client-implementation` 创建前已用远程 refs 和 GitHub connector 检查不存在同名分支。CLI 提交后，HTTPS push 因 `fatal: could not read Username for 'https://github.com': No such device or address` 失败；使用已连接的 GitHub API 创建相同文件树。远程提交 `31906f393148626814c5945c810462e19183cc3a` 的 tree `d3f9b47d17c0014e8c5cda598c606c03ed0379a0` 与本地提交完全一致，核对后对齐本地分支，没有丢弃文件或重置实现内容。

M0/M1 已持久化于该远程提交，草稿 [PR #2](https://github.com/MorCherlf/vscode/pull/2) 的 base 为 `codex/agent-client-roadmap`，head 为 `codex/agent-client-implementation`。本轮 M2 实现继续追加到该 PR；没有合并 main 或发布应用。
