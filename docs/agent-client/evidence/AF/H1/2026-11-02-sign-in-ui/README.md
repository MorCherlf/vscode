<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# Agent First 默认不弹登录窗口，手动窗口可关闭

用户明确要求默认不显示登录弹窗，显示时带关闭按钮。本次产品源码为 `1f43159b9471246d6fa34f9f22f05ddc4cada024`，基线为 `c80230792a3dedbfde77b0ecd67e945f25a8f0aa`。新版已重新构建、签名验证并替换安装到 `/Applications/VSC Agent Preview.app`，正常打开供用户测试；原应用备份位置见 [installed.json](raw/installed.json)，用户配置没有重置。

改动复用原 Sessions/ChatSetup/Dialog：Agent First 的 SessionsSetUpWidget 完成窗口启动，不启动自动 welcome/sign-in 流程和后续强制弹窗监听；原 ChatSetupDialog 在该产品中始终保留关闭按钮。未新增登录组件。普通产品不设置 agentFirst 时保留原分支。没有把隐藏窗口当成账号已登录，也没有修改 provider 的真实身份、权限、模型或 executable-extension 准入；生产清单仍 []。

## 实际验证

| 检查 | 结果 |
| --- | --- |
| 原 Electron 单测 | 16 passing：Sessions auth gate、dialog options、Chat setup external sign-in/cancel 原有测试 |
| 客户端构建、聚焦类型、两文件 lint | 退出 0；类型项目见 raw/typecheck.json |
| Mac 桌面 bundle 与原组包 | 退出 0；直接调用原 `runEsbuildBundle('out-vscode', false, true, 'desktop')` 后执行原 Mac arm64 CI 组包任务，复用既有扩展产物 |
| 签名与产物 | arm64，ad hoc 签名校验通过，无应用外符号链接；未作 Developer ID 签名、公证或发布 |
| 新配置首次启动 | PASS：原打包 Sessions，精确 commit、Agent First、空 executable 清单匹配，无可见 modal；中文两行草稿可输入并清空 |
| 手动登录窗口 | PASS：通过原命令面板的 `Use AI Features with Copilot for free...` 打开原 ChatSetup；原 Close Dialog 按钮可见、可点击关闭，等待后没有自动重弹，中文草稿仍可输入 |
| 再次手动打开 | PASS：Esc 可关闭，等待后无自动重弹 |
| 同配置退出并重启 | PASS：不弹 modal，中文两行草稿继续可输入 |

[原始 UI 报告](raw/ui.json)以及 [首次启动](raw/startup.png)、[带关闭按钮的手动登录窗口](raw/dialog.png)、[重启](raw/restart.png)截图均保留。截图已实际打开检查。测试直接启动 Applications 中二进制，系统 PATH、独立 VSC profile/extensions/shared-data、内存 secret storage；未设置 skip-sessions-welcome 或 signed-out opt-in，也未使用源码启动参数。没有点击任何账号提供者的继续按钮、登录账户或发送聊天任务；这不是模型任务或系统 IME 验收。

## 失败尝试与范围

初始类型命令误指不存在的 tsgo.js、组包尝试误把内部 bundle task 当注册任务，均已改用仓库实际入口，失败日志保留。最初从账户 hover 面板点击登录项，因元素移动/销毁而自动化超时；该记录不算通过，也没有宣称账户面板点击链路已验证。后改走原命令面板。一次测试期间系统日志记录 Mac 进入睡眠，连接随后关闭；中断记录保留。最后一次在临时 caffeinate 运行范围内完成上述整套验证，测试进程退出后解除闲置休眠抑制。

Electron 缓存与原 checksum 的本地资源解析沿用 [独立包构建](../2026-11-02-mac-app/README.md)方式，未关闭校验；本轮重新生成了桌面 bundle。预览身份覆盖结束后源码 product.json 字节恢复。自动化自己的实例/配置及临时辅助脚本清理，保留正常应用窗口、构建/测试日志和备份。

原生日志仍有已有的 url.parse deprecation 和关闭阶段 Unknown channel 告警，本次未处理。VSC profile 隔离不等于 SDK 全局账户/定制发现完全隔离。本轮完成的是用户要求的窗口行为；真实后端配置、任务、IME/VoiceOver、完整 H1 工程及人工验收保持待办，DSH 未启用。
