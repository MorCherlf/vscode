<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# 下一工作包：M2-B 账户适配与真机闭环

2026-10-29 更新：本机 Mac 原生/确定性验证及 Sessions 界面首批迁移已交付，见 [最新报告](../M2-ui/README.md) 和 [界面迁移目标](../../UI_MIGRATION.md)。后续以已提交实现分支为准，保持本轮界面结构，继续下方账户、表单与故障工作包；本轮 5/5 浏览器/真实 mock Host 测试不能替代完整 WKWebView 或真实账户验收。

本轮 M2.1–M2.3 和 M2.5 的云端工程已落地；M2 未验收。M1 的真实任务门禁仍未通过。本轮用户明确授权 M2 云端实现并行推进，不因未取得 Mac 或真实凭据停止独立工程；不把此授权解释为降低原门禁。

1. **原生账户适配（可先做设计与确定性实现）**：确认自有应用获支持的 GitHub/Copilot 登录流程、应用注册和 scopes，再实现登录/过期/刷新/登出。连接令牌继续只留在 supervisor；账户令牌通过原生适配交给 Host，不能新增 WebView 粘贴 token 或复制 VS Code 缓存的捷径。当前登录按钮禁用是准确的“未实现”，不是已完成账户功能。
2. **Keychain（Mac 实现与验收）**：增加窄的 credential-store seam、内存 fixture 和 macOS Keychain 实现；Mac 上验证首次授权、拒绝/锁定、过期、再登录、重启恢复和登出清理。回填 `evidence/M2/macos-keychain/`，只记录账户类型/错误类别，不能导出凭据。
3. **完整输入交互（云端可继续）**：扩展目前文本问题/简单 accept/refuse/工具审批的适配，加入数值/选择/多选与 URL 认证的能力检查。现有未支持表单保持准确不可用；补超时、撤销和断线时的确定性回放，不引入空 API。
4. **真实 T01/T03/T04（需安全测试账户）**：运行现有 Linux 或 Mac Host，以两个临时项目、三个会话进行创建、流式响应、取消、工具拒绝和断线恢复；三轮 T05 两文件任务保留全部结果。故障时不重放副作用请求；下一 runner 只读任务专用 secret 配置。回填 `evidence/M1/copilot-real/` 与 `evidence/M2/copilot-real/`。
5. **WKWebView（Mac）**：先在 macOS arm64 重新构建本机 M1 Host，再 `prepare:host`；运行 `npm --prefix apps/agent-client run tauri -- dev`。验证真实中文组合输入不会提前发送、粘贴/拖放/文件选择、长代码块、键盘/焦点、窗口关闭保留任务、Dock 重新打开、Cmd-Q 的继续/等待/停止。回填 `evidence/M2/macos-webview/`，不得用本轮 Chromium 截图代替。
6. **生命周期故障（云端可继续，Mac 重复）**：在真实活跃任务、待审批和网络中断下退出；Host/SDK 崩溃、父进程 SIGKILL、慢存储和大帧流下，确认状态重同步与自有子进程清理。当前测试证明 mock Host 正常停止/reap 和 receive-window 溢出，不证明全部故障矩阵。
7. **发布仍留 M7**：当前只有开发构建。签名、公证、隔离属性、无 VS Code/系统 Node 的干净 Mac、更新与回退均未运行，不创建或上传安装包。

后续提交继续推送到草稿 PR #2 的实现分支；仍以 roadmap 为 base，不自动合并 main。复用输入未改变的 M1 5/5、M2 核心/原生/浏览器结果；只为改动或未覆盖的风险新增针对性验证。
