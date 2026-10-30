<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# M2 云端工程执行报告

最新交付：[M2-B 原生账户、输入与故障工程](M2-B/README.md)。下文保留首轮历史报告与原始边界；本轮源码已改变，不能用旧平台结果宣称新版 Mac 或真实账户通过。M1/M2 仍未验收。

2026-10-28，执行者 Codex。复用当前工作区，未重克隆或丢弃 M0/M1。M0/M1 已推送至实现分支 `codex/agent-client-implementation` 的 `31906f393148626814c5945c810462e19183cc3a`；本轮 M2 在相同分支追加，以 [草稿 PR #2](https://github.com/MorCherlf/vscode/pull/2) 独立审阅，base 为 `codex/agent-client-roadmap`。最终提交身份见 Git 分支/PR；被测源码和依赖由 source-hashes.json 精确识别。

**状态：M2 进行中。** M2.1–M2.3/M2.5 云端切片已有实际实现；M2.4 原生账户/Keychain 适配未实现，M2.6 WKWebView、真实账户与 Mac 进程行为未验收。M1 继续等待真实账户任务和 Mac 验收；上轮 5/5 的准确边界见 [复核](prior-validation.md)，不是 5 个真实模型任务。

## 实际工程

| 位置 | 实现与边界 |
| --- | --- |
| apps/agent-client | Tauri 主窗口、独立资源配置、React/TypeScript/Vite 轻量项目/会话/对话/工具界面；无通用 workbench 或 editor.all |
| packages/agent-client-core | 官方 @microsoft/agent-host-protocol 1.0.0 的 AhpClient、发布兼容列表与 root/session/chat reducers；按精确资源身份管理快照/动作投影，不推导远端 chat 身份 |
| core/transport.ts | TauriTransport 与 NativeBridge；不接收连接 token 或 authenticated URL；128 帧/8 MiB 入队、单帧 1 MiB、32 个待完成发送；消费后 ACK；旧 generation 忽略，溢出关闭并要求重同步 |
| packages/agent-host-supervisor | 启动捆绑普通 Node/生产 Host、独立数据路径、受保护 token 文件读取、回环鉴权、readiness/PID 校验；32 命令队列、64 帧 native credit；同 Host PID 重连、EOF drain、超时 kill/reap |
| src-tauri/src/main.rs | main/local-origin 校验的窄命令；frame 走私有 IPC Channel；窗口关闭隐藏，完整退出走 keep/wait/stop；Rust 不实现会话 reducer |
| UI 输入与渲染 | 流式响应、取消、文本问题和 accept/refuse、工具审批；纯文本呈现富内容，未启用任意 HTML、远端 frame、shell/文件系统插件；未支持的问题类型准确显示不可用 |
| 锁文件与资源 | npm/Cargo 均锁定；Tauri/API/CLI 2.12.4、tauri-build 2.7.4、Rust 1.90.0；prepare:host 只复制匹配生产 Host，不复制测试产物；图标从源码 SVG 派生 |

## 命令与结果

从仓库根，先确保已有 M1 dist/dist-test 和子包依赖。完整安装/开发说明见 [app README](../../../../apps/agent-client/README.md)。

```sh
npm --prefix packages/agent-client-core ci
npm --prefix packages/agent-client-core run build
npm --prefix packages/agent-client-core test
npm --prefix apps/agent-client ci
npm --prefix apps/agent-client run build
npm --prefix apps/agent-client run prepare:host
cargo +1.90.0 check --locked --manifest-path apps/agent-client/src-tauri/Cargo.toml
cargo +1.90.0 build --locked --manifest-path apps/agent-client/src-tauri/Cargo.toml
AGENT_HOST_TEST_DIR="$PWD/packages/agent-host/dist-test" cargo +1.90.0 test --locked --manifest-path packages/agent-host-supervisor/Cargo.toml -- --include-ignored
node apps/agent-client/node_modules/playwright/cli.js install chromium-headless-shell
npm --prefix apps/agent-client test
```

| 验证 | 实际结果 | 证据 |
| --- | --- | --- |
| 共享核心 TypeScript | 严格检查/声明生成通过 | core-build.log |
| 共享核心测试 | **6/6**，含旧 generation/溢出、发送失败不重试、opaque URI、快照/动作竞争、文本问题/拒绝，以及官方 SDK+TauriTransport 连接实际 M1 mock Host、双客户端/重连/取消 | core-tests.log |
| Rust supervisor | **4/4，0 ignored**；真实 M1 mock Host 由 Rust 启动/鉴权/握手、同 PID 重连和停止回收；native 64 帧溢出、缺失资源和错误 generation | supervisor-tests.log |
| 前端构建 | tsc --noEmit 与 Vite 生产构建通过，约 257 kB JS / 78 kB gzip；不是安装包体积 | frontend-build.log |
| Tauri/Rust | 完整 cargo check 通过，cargo build --locked 实际产出 Linux x64 ELF 调试可执行文件 | tauri-check.log、tauri-build.log、build-summary.json |
| UI/安全 | **2/2**；实际 Chromium 读取生产构建、检查 capability/CSP、native unavailable、文本转义、无 JS 页面错误 | ui-tests.log、client-preview.png |
| Linux 图形启动探测 | **未通过图形启动**：显式空 DISPLAY 下 GTK initialization failed，退出 101。该云环境没有图形显示服务；不能将编译成功写成已运行桌面窗口 | native-launch.log |
| 真实模型/账户/Mac | **未运行**。未配置专用 Copilot 测试凭据；Keychain/account adapter 本轮未实现 | NEXT.md |

M2 新测试合计 12 项通过，测试类别互不冒充。上轮 M1 5/5 作为原始证据复用，没有改写成真实账户或 Mac 成绩。完整输入表单、真实 WebView IPC 端到端、任务中退出/崩溃恢复还不是已覆盖场景。

## 云端工具与可复现性

环境为 Linux x86_64、Node 24.22.1、Rust/cargo 1.90.0。开始没有 cargo/pkg-config/GTK 开发环境；固定 Rust 工具链安装到本任务目录。系统 apt 安装因 namespace 的 setgroups 与缓存权限失败；未移除系统锁或更改系统权限。改用只下载模式，将 Ubuntu 开发包提取到 `/tmp/agent-client-sysroot`，补齐指向现有系统运行库的 symlink 目标，作为编译依赖，不进入应用产物。普通 Linux 机器安装系统开发依赖即可，不依赖这些临时路径。

本轮实际 Rust 命令使用 `/tmp/agent-client-cargo/bin/cargo`，并设置：

```sh
export CARGO_HOME=/tmp/agent-client-cargo
export RUSTUP_HOME=/tmp/agent-client-rustup
export PATH=/tmp/agent-client-toolchain:/tmp/agent-client-cargo/bin:$PATH
export LD_LIBRARY_PATH=/tmp/agent-client-sysroot/usr/lib/x86_64-linux-gnu
export LIBRARY_PATH=/tmp/agent-client-sysroot/usr/lib/x86_64-linux-gnu:/tmp/agent-client-sysroot/lib/x86_64-linux-gnu
export PKG_CONFIG_SYSROOT_DIR=/tmp/agent-client-sysroot
export PKG_CONFIG_PATH=/tmp/agent-client-sysroot/usr/lib/x86_64-linux-gnu/pkgconfig:/tmp/agent-client-sysroot/usr/lib/pkgconfig:/tmp/agent-client-sysroot/usr/share/pkgconfig
```

浏览器安装与测试使用 `PLAYWRIGHT_BROWSERS_PATH=/tmp/agent-client-browsers` 和上述 LD_LIBRARY_PATH。初次预装 Playwright 下载归档损坏，项目固定 1.56.1 后匹配浏览器成功下载并运行。失败与修复见 [记录](failures.md)。这些是工具/环境故障，不伪装为产品验收结果。

## 未完成与交接

[下一工作包 M2-B](NEXT.md) 为账户/Keychain 适配、完整输入表单和真实服务/真机闭环。Mac 必须用自身架构重新构建 Host：ci/build/build:test/test → core/app build → prepare:host → tauri dev；测试中文组合输入、粘贴拖放、键盘、长内容、窗口关闭/Dock 重开/Cmd-Q 的继续/等待/停止，结果分别回填 M2/macos-webview、macos-keychain、copilot-real。签名、公证、干净 Mac 安装与更新回退继续留在 M7。

本轮未合并 main，未创建或发布安装包。Linux debug ELF、Chromium 截图和 mock 对话都不能替代这些验收。
