<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# Mac arm64 独立应用构建与安装

2026-11-02 已安装并正常打开 `/Applications/VSC Agent Preview.app`。这是原 VSC Electron/Sessions 的独立应用，复用原组件与打包流程。**启动验证通过；首次启动的原登录弹窗阻挡输入，完整交互及真实 Agent 任务未通过验收。H1 仍工程进行中。**

## 精确版本与产物

云端聊天本轮已完成、状态 idle；远端实现分支为 `784c0b01dc8eee09985a0e4ed7fce17827b25be5`。本机快进整合后追加两处构建修复，安装产物的 `product.commit` 为 `5e6a05674e193551a4d7ee49cc147b5c6059e368`。后续本报告提交不在该产物内。应用版本 1.145.0，Electron 43.8.3，实际 Chromium 150.0.7871.250，主程序为 Mach-O arm64，安装大小约 1.5 GiB。

构建发生于 2026-10-30；安装及以下安装版验证于 2026-11-02 完成。完整客户端 bundle 和扩展编译已成功，最终修复只涉及构建文件，因此刷新 Copilot 扩展后复用客户端输出执行原 `vscode-darwin-arm64-ci`，没有再次完整编译全部输入。

本机应用身份覆盖仅限 `nameShort/nameLong=VSC Agent Preview`、`applicationName/urlProtocol=vsc-agent-preview`、`dataFolderName=.vsc-agent-preview`、`sharedDataFolderName=.vsc-agent-preview-shared`、`serverDataFolderName=.vsc-agent-preview-server`、`darwinBundleIdentifier=com.morcherlf.agentpreview`。打包后源码 `product.json` 字节已恢复，SHA256 为 `86d8531a8bfd3ebea77b2c1724b0e77e9a046d5da16049a3ee9a39d5101aa4d8`。生产 `agentFirst=true`、`agentFirstExecutableExtensions=[]` 保持原值。

安装前移除了这份预览应用的编辑器文件类型关联，只保留目录关联；执行 ad hoc 签名，再由 `ditto` 安装至上述独立路径，未覆盖现有 VS Code。`codesign --verify --deep --strict --verbose=2` 通过；没有 Developer ID 签名、公证或发行发布。递归符号链接检查没有指向应用外部的链接。主程序及 product 文件 SHA256 见 [installed.json](raw/installed.json)，它们不是整个应用目录的哈希。

## 构建修复与执行方式

1. `e69f6a18c3d5260b6fbd8355542ea43618ba3bc9`：原 Copilot esbuild 会重建 SDK、移除 shim 标记；同时枚举依赖导致 `shims.txt` 的 lstat 失败。沿用原打包 stream，把依赖枚举推迟到扩展构建 stream 完成之后。
2. `5e6a05674e193551a4d7ee49cc147b5c6059e368`：原 esbuild 文件收集使用 PackageManager.None，导致 Copilot 的外部 SDK 没有进入包，后续 ripgrep shim 阶段失败。只对 Copilot 使用原 vsce 的 npm 生产依赖枚举和现有 `.vscodeignore` 白名单，保留 app 级 `.moduleignore`。文件收集探针确认 SDK index 和 darwin-arm64 runtime 均存在，最终原打包任务通过。

使用仓库本地 Node 24.22.1 和既有完整依赖，原入口为：

```sh
npm run gulp -- vscode-darwin-arm64
npm run typecheck --prefix build
npm run eslint -- build/lib/extensions.ts
```

GitHub 直连超时使原 Electron 下载器获取 SHASUMS256.txt 失败。最后两步通过临时本地资源解析器顺序执行原 `compile-copilot-extension-build` 与 `vscode-darwin-arm64-ci`：向原 `build/lib/electron.ts` 的 `config.repo` 提供现有 Electron zip 和仓库 `build/checksums/electron.txt` 的 Response stream；原校验仍执行，没有关闭校验或替换 Electron 版本。缓存 `electron-v43.8.3-darwin-arm64.zip` 的 SHA256 为 `08e693ae36cfd230105aabe70c626b1a243c13534a529c35a80c1b87cb8da7b4`，与仓库一致。打包器还按内建扩展版本取回原 `@github/copilot-darwin-arm64@1.0.73`，完成原 ripgrep shim。完整命令及临时身份覆盖见 [build-record.json](raw/build-record.json)。临时构建/安装/自动化脚本在交接后清理，不是新增产品运行依赖。

构建工具类型检查、单文件 lint 均退出 0；失败日志与最终成功日志并存于 raw，避免把失败尝试改写为通过。

## 实际安装版验证

自动化直接启动 `/Applications/VSC Agent Preview.app/Contents/MacOS/VSC Agent Preview`，cwd 为 `/tmp`，PATH 只含系统目录；移除源码启动变量及常见模型 API key 环境变量，使用新的 VSC user-data/extensions/shared-data 目录与内存 secret storage。没有 `--agents` 参数或仓库启动参数。

| 检查 | 实际结果 |
| --- | --- |
| 原打包页面与产品配置 | PASS：`vs/sessions/electron-browser/sessions.html`，`isSessionsWindow=true`，精确 commit、名称、Agent First、空 executable 清单匹配 |
| 界面截图 | 已打开检查 [installed-startup.png](raw/installed-startup.png)：原 Sessions、Chat 与登录界面呈现，图标和布局可见 |
| 重新加载后的 vscode-file 请求 | PASS：捕获 16 个资源 URL，来自 Applications 中应用，无仓库路径；只证明此次界面资源采样，不是所有未来任务依赖闭包证明 |
| 页面异常 | 此次监听期间为 0；不表示所有原生日志无告警 |
| 中文多行草稿 | BLOCKED：原登录弹窗锁定焦点；未输入/发送任务，未进行系统 IME 验证 |
| Test Custom View 命令搜索 | BLOCKED：同一登录弹窗；不把云端浏览器结果冒认为本机已验证 |
| 真实模型、审批、停止、重启继续 | 未执行 |

第一次尝试聚焦聊天得到 `Chat input did not retain focus`，保留原失败报告。第二次检测弹窗的自动化选择器错误，仍失败，也保留记录；最后改用截图中实际可见的登录标题检查，报告明确区分 `startupPassed=true` 与 `fullInteractionPassed=false`，没有关闭或绕过原门禁。[最终原始报告](raw/installed-startup-smoke.json)包含资源路径及实际结果。

原生日志另有 `url.parse()` deprecation、关闭阶段的 `Unknown channel: agentHostClientByokLm/agentHostClientProxy`，未在本轮定位或修复；不能据启动成功宣布真实 provider 通道可用。自动化自己的实例已退出；另用 `open -a` 正常打开应用，主进程路径已确认来自 Applications，保留给用户查看。

VSC profile 隔离不覆盖 SDK 的全局定制发现/账户目录，界面可能展示宿主已存在的定制条目计数。本轮没有操作账户、复制个人认证、发送模型请求或宣称完整 SDK 身份隔离。当前默认登录界面也不等于所有本地后端都必须 GitHub 登录；后续按 [backend 审计](../2026-10-30-provider-resource/BACKENDS.md)选择原生后端并完成产品配置和独立测试环境。

## 后续边界

独立 Mac 应用构建/安装子项已有证据，用户可查看实际界面；当前仍无法把该预览交付等同于可直接完成任务的 Agent。原默认账户门禁与后端配置、最新源码的完整原生恢复/资源交互、任务时组件归因、中文 IME/VoiceOver 和 H1 人工验收继续待办。DSH 未启用，H2–H4 没有因此通过。构建修复和报告同步同一实现分支/草稿 PR，不合并、不发布应用二进制。
