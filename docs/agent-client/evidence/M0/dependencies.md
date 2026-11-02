<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# 依赖、动态资源和构建边界

| 对象 | 源码定位 | 决定 / 风险 |
| --- | --- | --- |
| 服务构造与持久化 | agentHost/node/agentHostBootstrap.ts:createAgentHostRuntime、serviceBootstrapping.md | 保留一套原有 DI 图、foundation/composition/contributions；不复制内部服务清单 |
| 原入口 | agentHost/node/agentHostServerMain.ts:main/parseServerOptions/reportReady | 复用行为，不直接使用多 provider 激活与含令牌 URL 日志；新增 packages 入口绑定 Copilot |
| base/platform、editor/common | 独立生成 module-graph.json | 保留可追踪的运行依赖；不编译 editor.all、workbench 前端或 Electron |
| Node 与 ABI | .nvmrc；根 .npmrc | 固定 24.22.1，禁止 Electron；子包 npm 安装绕过根 Electron headers/runtime/target 配置 |
| SQLite | agentHost/node/{agentHostDatabase,sessionDatabase}.ts:openDatabase | 动态 @vscode/sqlite3；必须按普通 Node 编译并真实读写，不以 import 成功代替数据库验证 |
| PTY、xterm headless | agentHost/node/agentHostTerminalManager.ts:getNodePty | node-pty 原生库和 spawn-helper；shell integration scripts 独立复制，需实际终端验证 |
| Diff worker | agentHost/node/diffComputeService.ts:_ensureWorker / diffWorkerMain.ts | 显式构建额外入口，保留 FileAccess 路径；执行真实 worker 请求 |
| 文件递归 watcher | files/node/watcher/watcherClient.ts:createWatcher | 动态 bootstrap-fork + watcherMain + @parcel/watcher；作为额外入口，不依赖开发树 |
| WASM 命令解析 | agentHost/node/commandAutoApprover.ts:loadTreeSitterResources | @vscode/tree-sitter-wasm 的 parser、bash、powershell wasm 全部随生产包；真实 init/load |
| Copilot SDK/runtime | agentHost/node/copilot/copilotRuntimePaths.ts:resolveCopilotRuntimePaths | 不 bundle SDK：保留平台包 prebuilds/{platform}/copilot-runtime、runtime.node、copilot-sdk/index.js、extension.js、preloads/extension_bootstrap.mjs |
| node_modules 位置 | agentHost/node/appNodeModules.ts:getAppNodeModulesUri | launcher 绑定产物内 node_modules；不能依赖工作区依赖查找注入 |
| 提示词 | agentHost/node/copilot/prompts/*.ts | 模块图包含 TS 常量；用户 override 是项目/账户资源，不复制个人提示词 |
| 文件/归档/搜索 | base/node/{pfs,zip,ripgrep,processes}.ts | fs-copyfile、yauzl/yazl、ripgrep 平台程序；terminateProcess.sh 纳入资源 |
| 网络与认证 | agentHost/node/agentHostAuthenticationService.ts；request/node/requestService.ts | 连接认证与账户认证分开；HTTP(S) proxy 包保留；Kerberos 是额外待验收能力，不假装企业集成已支持 |
| 遥测、设备 ID、加密 | telemetry/node、base/node/id.ts、agentHost/node/missionControl | 本版遥测关闭；服务图仍静态引用 1ds/deviceid/hpke/libsodium，清单说明保留，不能误算为已启用云功能 |
| Claude/Codex | agentHost/node/agentHostServices.ts 的公共图 | 非 Copilot provider 不激活、不安装 SDK；图中仍有 lazy Claude SDK import、Codex 恢复/配置代码，列为后续裁剪，不能声称所有其他 provider 源码已移除 |
| Windows registry | base/node/{id,windowsVersion}.ts | 平台门控，不分发到 Linux/macOS；Windows 为 M8 |
| 产品配置 | platform/product/common/product.ts | launcher 在动态加载前注入独立 product/package，隔离数据与 COPILOT_HOME；不读取开发机 VS Code 缓存 |

所有未写全路径以前缀 `src/vs/platform/` 开始，base 路径为 `src/vs/base/`。`packages/agent-host/scripts/build.mjs` 以 esbuild 解析得到 TS 静态及字面量动态闭包，再逐模块转译以保持相对路径；模块图仅作闭包发现，发布不依赖 bundle 后被改变的 import.meta.url。

静态图不能发现变量动态入口和 FileAccess 资源，所以 worker、watcher、shell 资源另列。依赖完整性最终以仓库外目录、随包 Node 的运行验证为准。第一版不保证任意宿主服务和企业认证路径都闭合；报告分别列实际覆盖与余留项。
