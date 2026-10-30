<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# M1 第一工作包执行证据

2026-10-28，执行者 Codex。基于 `codex/agent-client-roadmap` 的 `5d89fa5583233f7aefd2ad65db8296e775d1099b`，实现身份为本轮可审阅工作区 diff；没有自动合并、发布或推送。M0 工程审计完成；M1 首个可构建测试版本完成，里程碑仍为进行中。

## 实际代码与构建变化

`packages/agent-host/src/host.ts` 复用 upstream `createAgentHostRuntime`、ProtocolServerHandler、WebSocketProtocolServer、模型刷新调度和 shutdown drain；`src/main.ts` 只注册现有 CopilotAgent。未重写 agent loop、权限服务或状态 reducer。测试入口用既有 ScriptedMockAgent，加仅测试的受控认证资源；生产包不包含 mock 和测试入口。

`build.mjs` 为 Host、Diff worker、递归 watcher/bootstrap 建立独立模块图，逐模块转译保持资源路径；生产 npm 依赖从子包锁文件收集，过滤开发依赖和不匹配 libc 的平台包。产物包含普通 Node、Copilot 平台 runtime/SDK、WASM、SQLite/PTY/文件操作原生模块和 shell/process 资源。没有安装或运行 Electron，没有编译完整 VS Code。

`launch.mjs` 在加载模块前注入独立产品配置，固定普通 Node 24.22.1、回环监听、随机端口、32 字节随机 token 的独占 0600 文件；stdout readiness 只给 token 文件路径。独立 user-data-dir 与 COPILOT_HOME 避免 VS Code 账户/历史缓存。stdin EOF/SIGINT/SIGTERM 复用停止接入、drain、provider shutdown、flush、dispose 顺序。

生产构建：1032 个源码模块、62 个实际安装的生产依赖包、4822 个清单文件（以 build-summary.json 为准）；清单文件内容合计 497,787,038 字节，另有 manifest 自身与文件系统占用。此数是当前 Linux 开发产物诊断，不是压缩安装包大小，更不是 Mac 性能成绩。尚保留 npm 包的原生编译支持文件，未做 M6 优化。

## 可复现命令

从仓库根运行，普通 Node 24.22.1：

```sh
npm --prefix packages/agent-host ci
npm --prefix packages/agent-host run build
npm --prefix packages/agent-host run build:test
npm --prefix packages/agent-host test
```

当前云端文件系统需要 headers 所有权恢复 workaround；本轮成功安装命令是 `npm --prefix packages/agent-host ci --nodedir=/tmp/agent-host-node-headers/node-v24.22.1 --fetch-retries=0 --fetch-timeout=20000`，headers 来自官方 `https://nodejs.org/download/release/v24.22.1/node-v24.22.1-headers.tar.gz`，通过 Python `tarfile.extractall(..., filter='data')` 提取。不要依赖该临时路径跨环境存在；普通机器使用标准 ci 即可。

将整个 `packages/agent-host/dist/` 复制到仓库外目录后，在该目录执行 `./bin/node ./start.mjs --user-data-dir /absolute/fresh-data` 并保持 stdin 打开。测试自动搬移 dist-test 到随机临时目录，使用产物自己的 Node、干净 HOME、显式用户目录与有限 PATH，测试结束清理副本。

## 实际验证结果

最终运行 **5 tests / 5 pass / 0 fail / 0 skip**，13.65 秒。见 [原始测试输出](tests.log)。

| 验证 | 实际结果 | 验收边界 |
| --- | --- | --- |
| 模块图、生产构建、测试构建 | 通过；独立产物，无 Electron/工作台前端入口；生产包排除 mock、esbuild、Mocha 等开发依赖 | T11 当前 Linux 切片，不代表所有动态服务均已认证 |
| 连接认证与账户认证 | 错误/空连接 token 被拒绝，正确 token 建连；fixture.invalid 错账户 token 被拒绝，固定账户 token 被接受；0600；stdout/stderr 不含 token 值 | T01/T07 的确定性受控认证，不能代表真实 GitHub 账户 |
| AHP、会话和流式 | 协商发布基线 1.0.0，创建会话，读取 advertised defaultChat，两客户端均收到 Hello；取消 slow turn 后超过 5s 无迟到响应 | T03/T04 的当前场景，不是完整多项目/故障矩阵 |
| 持久化和正常停止 | 自定义会话标题写入独立 user-data，stdin EOF 退出 0，token 文件删除，重新启动并用 mock seed 恢复目录后标题保持 | Host 元数据持久化通过；mock 不存真实 SDK transcript，未声称真实聊天历史恢复 |
| 生产入口 | 原 CopilotAgent 在仓库外产物注册并提供 AHP root；无 mock/Claude/Codex provider；SIGTERM 退出 0 | 启动/停止通过，未向模型发送任务 |
| worker 与 native | 真实 Diff worker 得到增 2/删 1；SQLite 内存库建表/写/读；真实 PTY 执行 shell 并返回退出码；ripgrep 可执行 | 普通 Node ABI 137，当前 Linux x64 |
| WASM 与 watcher | parser 初始化，bash/powershell grammar 解析；递归 watcher 子进程观察真实文件变化并 dispose | 资源路径已在仓库外验证 |
| SDK 与平台运行时 | SDK 加载；runtime.node/SDK/preloads 资源存在；真实 runtime 子进程 start/ping/getStatus/stop；version 等于锁定 1.0.103-unstable.r40031404408.gba6c003 | 无模型/账户任务；不以不存在的 --version 命令替代握手 |
| 启动失败 | 无效端口返回 INVALID_OPTIONS；占用端口返回 EADDRINUSE；退出 1，token 文件清理 | 错误分类和失败清理通过 |
| M0 fixture | v1 两次独立生成，107 文件、344913 字节，dataset.json 完全一致 | 固定输入，不是 Mac 基线实测 |

## 原始证据与限制

[environment.json](environment.json)、[build-summary.json](build-summary.json)、[module-graph.json](module-graph.json)、[安装输出](install.log)、[生产构建](build.log)、[测试构建](build-test.log)、[测试结果](tests.log)、[失败及修复记录](failures.md)。完整每文件 SHA256/尺寸清单在实际产物 `dist/manifest.json`，摘要中保留其哈希与输入源码/锁文件哈希。

没有配置专用 COPILOT_TEST_GITHUB_TOKEN；仅检查是否存在，没有读取个人 HOME 凭据。真实登录、失效/登出、三轮两文件修改和命令任务 T05 **未运行**。macOS arm64 原生依赖、无系统 Node/VS Code 的干净 Mac、B0/B1 性能、WKWebView、Keychain、签名/公证和真机验收 **未运行**，分别登记在 [Mac 交接表](../M0/baseline.md)。

当前没有文件日志/诊断导出；仅保留现有 OTLP 内存日志。尚未认证 Host/SDK 崩溃、任务中停止及所有子进程异常清理。共享服务图仍含 lazy Claude/Codex 支持代码，SDK 不分发；Windows registry 与 Kerberos 集成代理认证明确列为 omitted externals。未提供通用 VSIX 兼容，也未执行全仓类型检查。Node 二进制来源/发行许可完整性和目标平台最低系统依赖留待分发验收。上述限制不影响本轮已验证的独立工程切片，不能据此宣称整个 M1 已验收。

下一步：[M1-B 真实任务与分发闭包验收](NEXT.md)。

## 续作持久化

上述报告是原始 M1 验证记录，测试结果未改写。后续用户授权提交/推送后，本实现已持久化于 `codex/agent-client-implementation` 的 `31906f393148626814c5945c810462e19183cc3a`，并创建以 roadmap 为 base 的 [草稿 PR #2](https://github.com/MorCherlf/vscode/pull/2)。M2 云端工程在同分支继续；真实账户与 Mac 门禁仍待验收，见 [本轮复核](../M2/prior-validation.md)。
