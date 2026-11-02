<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# 本轮失败与修复记录

| 阶段 | 原始错误 / 结果 | 归因及修复 |
| --- | --- | --- |
| 环境发现 | `fatal: not a git repository (or any of the parent directories): .git` | 当前目录未挂载仓库；远程 refs 与 GitHub connector 成功后，实际 shallow clone 指定分支 |
| 第一版图发现脚本 | `Must use "outdir" when there are multiple input files` | 构建脚本错误；为只分析、不写出的多入口 graph 指定 outdir |
| 原生依赖安装 | `TAR_ENTRY_ERROR EINVAL: invalid argument, fchown` | node-gyp 解包恢复所有权受云文件系统限制；官方同版本 headers 用 Python tarfile 的 data filter 提取，随后 ci 指定 nodedir |
| 一次重试调度 | `ENOENT ... @vscode/sqlite3/build/node_gyp_bins` | 执行者误让安装重试与前一次原生编译重叠，不能据此归咎仓库；后续等待退出后，以锁文件串行 clean ci 成功 |
| 首轮运行测试 | `Cannot read properties of undefined (reading 'toLowerCase')`，configurationRegistry.js | 独立产品配置遗漏 extensionId/chatExtensionId；补齐源码要求的配置字段，生产入口通过 |
| 首轮资源 probe | `copilot-runtime: unsupported argument '--version'` | 测试错误假设 runtime 提供 CLI version 选项；改用真实 SDK RuntimeConnection.forStdio + start/ping/stop，不虚构命令支持 |
| 次轮 SDK probe | ping 返回 `pong: fixture` 而非 `fixture` | 修正测试期望，保留实际服务响应语义 |
| mock 鉴权 | AHP `-32007 Authentication failed for resource: https://api.github.com` | 既有 ScriptedMockAgent 不声明 protected resources，不能假扮 GitHub 成功；测试专用子类声明 fixture.invalid，固定接受/拒绝条件，不改生产认证 |
| mock 取消 | `Condition timed out` | 测试帧遗漏协议要求的 duration，且需等待前一 turn complete；按协议补齐，验证第二客户端收到取消，超过 mock 的 5s 定时窗口仍无迟到 Slow response |

这些是实际出现的失败。最终成功证据只引用修复后对应输入的测试，不把早期失败删除后冒称首轮全部通过。没有运行 Mac 或真实账户任务。
