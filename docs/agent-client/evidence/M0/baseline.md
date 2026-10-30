<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# 固定数据与待 Mac 验收

数据集 v1：运行 `node packages/agent-host/scripts/dataset.mjs /absolute/temporary/agent-fixture-v1`。种子 0，无随机数/网络/当前时间；两个代码项目 alpha/beta，各两个文件；100 个会话目录，session-000 有 1000 条显示事件，64 字节 ASCII 填充加固定 Unicode 文本；10000 行 Diff。生成的 dataset.json 固定每个文件大小与 SHA256。它是基线数据输入，尚非 SDK 原生历史；M2 导入器必须明确把这些事件映射到 UI 测试状态，不能把目录当作已持久化的真实 Copilot 会话。

固定 T05：在复制的 alpha/beta 中把 a.mjs 的 value 从 1 改成 2，在 b.mjs 添加一个确定性校验，运行 `node b.mjs`，独立检查两个文件 diff 和退出码。失败分支初始 b.mjs 返回 1。受控流式负载 v1 设为 20 events/s，持续 30 分钟；审批拒绝用临时目标文件检查不存在副作用。MCP 和扩展受控合同见 extensions.md；实现/运行留待 M4/M5，不能标记已通过。

## Mac 执行者交接表

所有项目和用户目录都使用新临时目录；不使用日常 VS Code 或 Copilot 配置。不在本轮云端编译完整桌面；B0/B1 使用交接 SHA 的既有匹配 macOS 构建，记录构建来源及依赖锁摘要。没有对应产物时登记“缺少匹配基线产物”，不能拿其他版本替代。

| 测试 | 所需产物 / 精确操作 | 预期 / 回填 |
| --- | --- | --- |
| B0/B1，P01–P03 | 同 SHA macOS arm64 VS Code/Sessions 构建；B0 常规配置，B1 用 `--agents --agents-user-data-dir <fresh> --agents-extensions-dir <fixed-fixtures>` 打开 alpha；C0/C1 同项目与账户/工具集合 | 固定硬件、电源、系统版本；按 VALIDATION P01–P03 的 60s 稳定+120s 采样、20 冷/30 暖次数；回填 M0/macos-baseline/ 的机器 JSON、进程归属、footprint/RSS/CPU 原始 CSV 与时间戳 |
| P04–P06 | 生成 v1 数据并通过 M2 测试导入器加载；相同执行服务；分别 B1/C0 与 B1/C1 | 100 次输入/切换、20 次开关、30 分钟流式、30 次调度；回填原始样本与所有异常，当前未运行 |
| M1 arm64，T01/T11 | Mac 上普通 Node 24.22.1，`npm --prefix packages/agent-host ci`，`npm --prefix packages/agent-host run build`，`npm --prefix packages/agent-host run build:test`，`npm --prefix packages/agent-host test` | 原生 ABI、worker/WASM/SDK 可加载；把 dist 搬到无源码目录运行 `./bin/node start.mjs --user-data-dir <fresh>`；结果回填 M1/macos-arm64/ |
| 真实 Copilot，T01/T05/T07 | 安全测试账户，通过受支持流程取得凭据，仅在 AHP authenticate 帧内交给 Host；不得放参数/仓库/日志。使用 alpha/beta 固定任务 | 三轮完整记录成功失败、令牌失效/退出/再登录、权限拒绝无副作用；回填 M1/copilot-real/ 脱敏结果 |
| WKWebView，T02/T04 | M2 的 Tauri 应用与上述 Host | 中文输入法、粘贴拖放、文件选择、长代码块、键盘导航、重连、富内容原生权限隔离；回填 M2/macos-webview/ |
| Keychain，G06 | M2 Keychain 登录桥及测试账户 | 登录、锁定/拒绝、过期、退出后凭据清理；连接 token 与账户 token 分开；回填 M2/macos-keychain/ |
| 签名/真机，T12/T13 | M7 签名公证安装包，干净 Mac，无系统 Node/VS Code | 隔离属性首次启动、真实任务、升级失败恢复/回退、退出无自有孤儿进程；回填 M7/macos-release/ |

B1 必须按 C0/C1 的必选能力分别配对；兼容宿主或浏览器能力缺失时，只能报告部分能力诊断，不形成最终性能对照。本轮无 Mac 原始样本，G09 原预算保留。
