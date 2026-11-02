<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# M2.7 Sessions 界面首批迁移与 Mac 构建

2026-10-29（Asia/Shanghai），本机 macOS arm64。本轮从 `e9e25186b016b9e0704cefb953fdfb07c0304ef0` 继续；实际输入和 Mac 主程序散列见 [source-hashes.json](source-hashes.json)，最终提交由实现分支和草稿 PR #2 识别。完整 UI 目标、来源映射和待验收项见 [界面迁移推进文档](../../UI_MIGRATION.md)。

**状态：M2 继续进行中。** 本轮交付 Sessions 界面的第一批布局、主题、交互适配和可运行 Mac 包；没有完成账户登录/Keychain、真实模型任务、原版界面截图对照和完整 WKWebView 验收。不是原版 ChatWidget 的整体迁移，也不是逐像素还原的证明。

## 实际实现

- 直接使用上游锁定版本 Codicons；由 Light/Dark Modern JSONC include 链与列表颜色默认值生成本客户端主题。沿用 Sessions 的 shell/panel 层级、字体角色、浮动面板间距、居中内容带、欢迎区与输入区结构。源码来源逐项列在推进文档。
- 实现项目分组、会话搜索/折叠/切换、按 URI 隔离的内存草稿、新会话输入后创建、⌘/Ctrl+N、⌘/Ctrl+B 和会话箭头/Home/End 焦点导航。
- 支持安全 Markdown/GFM、代码块、表格、思考折叠、复制及工具状态/审批卡片。原始 HTML、远程图片、外链和 command 链接均无执行入口；文本问题和接受/拒绝继续使用原协议。
- 主题选择可保存；HTML dialog 处理焦点与 Escape；Mac 使用 Overlay 系统标题栏和原生窗口按钮，main capability 仅新增窗口拖动。Native runtime 和视图分开，认证与进程状态仍由原先核心/Rust 管理。
- 自动生成 109 项前端依赖声明/可用许可原文，随 `.app` 资源打包；设置中保留 Codicons 的 CC BY 4.0 署名。SDK npm 包声明 MIT 但未附许可证文件，该条目明确记录，完整发布核对仍留 M7。

## 验证结果

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| 前端 | TypeScript 严格检查与 Vite 生产构建通过；JS 436.38 kB / gzip 132.87 kB，Codicons 字体 154.01 kB | [frontend-build.log](frontend-build.log) |
| 浏览器/功能 | **5/5**，Node test runner + Playwright 1.56.1 / Chromium Headless Shell 141.0.7390.37（1194） | [ui-tests.log](ui-tests.log) |
| 独立 Host 驱动的 UI 流程 | 两个实际临时项目创建会话，发送并获得 mock 回答，草稿往返、组合输入保护、会话焦点导航、搜索、取消、待审批取消退出、拒绝、实际断线及重连后历史/草稿保留全部通过 | 同上第 3 组；不是静态假聊天 |
| 安全与产物 | main/local capability、CSP、无 IDE/测试入口；Markdown 无 HTML 执行、图片请求或可执行链接；连接 token 不进入页面 | 同上第 1/4 组 |
| 布局 | 明/暗主题、主题偏好刷新恢复、项目校验和弹窗焦点、中文 720×520 无横向溢出通过；截图已查看 | 下方截图 |
| 本机 Mac Release | Rust 1.90.0 + Node 24.22.1 + macOS SDK 27.0，`tauri build --bundles app --no-sign --ci -- --locked` 成功；**456.81 MiB** | [tauri-release-build.log](tauri-release-build.log) |
| 随包许可 | notice 生成与资源打包通过 | [frontend-notices.log](frontend-notices.log) |

本轮浏览器 fixture 使用相同 App 组件、真实官方客户端和实际 M1 mock Host，测试专用 Node WebSocket 代理持有连接 token；页面只连接不含 token 的代理地址。它验证浏览器 UI 到真实协议的流程，不验证原生 IPC 或 Rust transport。fixture 独立构建到临时目录，生产 bundle 不含测试入口；测试结束关闭浏览器/代理并 drain/reap Host、移除临时数据。

本机稍早已验证但输入没有改变的结果保留原始证据，不重复计为本轮新测试：Mac Host **5/5**（[日志](macos-runtime/host-tests.log)）、核心 **6/6**（[日志](macos-runtime/core-tests.log)）、Rust supervisor **4/4，0 ignored**（[日志](macos-runtime/supervisor-tests.log)）。[原环境与来源](macos-runtime/environment.json) 明确 Host 来自上述 base commit。本轮没有修改这三个包的输入。

## 截图

以下均是 Chromium；审批图由实际 mock Host 驱动，不是原生 WKWebView 截图，也不是实际 Copilot 模型任务。

| 场景 | 截图 |
| --- | --- |
| Light Modern / 1200×800 / 生产离线预览 | [preview-light.png](preview-light.png) |
| Dark Modern / 1200×800 / 生产离线预览 | [preview-dark.png](preview-dark.png) |
| Dark Modern / 真实 mock Host 工具待审批 | [mock-approval-dark.png](mock-approval-dark.png) |
| 中文 / 720×520 / 减少动态效果 | [preview-zh-compact.png](preview-zh-compact.png) |

## 复现

按 [app README](../../../../apps/agent-client/README.md) 准备匹配平台的 M1 dist/dist-test、core/app 依赖与 Rust。测试依赖实际的 Host 测试产物，不能只安装前端依赖后把缺失产物误判成产品失败。

```sh
npm --prefix apps/agent-client run sync:theme
npm --prefix apps/agent-client run build
node apps/agent-client/node_modules/playwright/cli.js install chromium-headless-shell
npm --prefix apps/agent-client test
npm --prefix apps/agent-client run prepare:host
npm --prefix apps/agent-client run tauri -- build --bundles app --no-sign --ci -- --locked
```

本机工具链在仓库忽略的 `.build/mac-toolchain` 下，浏览器缓存为 `.build/agent-client-browsers`；安装与测试需使用相同 `PLAYWRIGHT_BROWSERS_PATH`。没有全局安装工具链或改动 shell 配置。失败和修复分类见 [failures.md](failures.md)。

Mac 产物位于 `apps/agent-client/src-tauri/target/release/bundle/macos/MorCherlf Agent.app`，未签名、未公证、未生成 DMG 或上传发布。相对同能力 Sessions 的体积、启动和内存目标尚未实测。原生登录、真实 Agent 任务、输入法与 WKWebView 原生交互、长历史、异常退出、干净机器安装和完整界面对照继续待验收。
