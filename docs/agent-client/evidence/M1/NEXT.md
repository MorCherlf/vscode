<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# 下一工作包：M1-B 真实任务与分发闭包验收

输入：本次 `packages/agent-host` 实现、锁文件、production/module-graph 和 build-summary。保留 M0 待验收、M1 进行中；不要把缺少真实账户或 Mac 的门禁改为 mock 已通过。

1. **独立验收 runner（云端可继续）**：在当前包增加显式 opt-in 的真实 AHP runner，只读取任务专用 secret 配置，经 authenticate 帧交付，不输出帧原文。覆盖模型发现、令牌失效/登出/再登录、两文件修改+确定性命令、工具拒绝和取消；使用 M0 fixture v1，三轮 T05 全部保留结果。未配置凭据时输出明确 skip 原因，不读个人缓存。
2. **资源与故障（云端可继续）**：增加 Host 正在执行任务时的 SIGTERM、SDK 崩溃、Host SIGKILL 与重启恢复；现有 mock 不持久化真实 SDK transcript，因此不能用它认证真实聊天恢复。检查 PTY、watcher、runtime 的自有子进程全部退出；验证 fork watcher 的异常重启和丢失资源的分类错误。
3. **配置与诊断（云端可继续）**：为独立应用补齐文件日志/诊断输出和脱敏合同；当前只有 OTLP 内存日志。评估复用 DI 图的可选 provider 服务裁剪，先改 typed bootstrap 入口选择，不复制平行服务列表。明确 Kerberos 企业代理不支持状态，或增加原生依赖和专项验证。记录 Node 二进制来源和完整 license/NOTICE。
4. **产物紧缩（云端可继续）**：保持已通过资源测试，移除生产包不需要的原生编译中间物、npm 支持源和非当前平台资源；不删除必须 runtime/SDK/WASM，也不以搬到首启下载来降低体积。新清单与现有约 498 MB 的文件字节数比较，仅作诊断。
5. **Mac arm64 与真实服务（外部验收）**：按 [M0/baseline.md](../M0/baseline.md) 执行精确的 ci/build/build:test/test、仓库外启动和真实任务步骤，回填 M1/macos-arm64 与 M1/copilot-real；补录最低 macOS、libc/动态库、原生 ABI 和代码签名约束。
6. **进入 M2 的交付**：先闭合真实 Copilot 登录/任务与 Mac Host 运行门禁，再给 Tauri supervisor 使用 readiness、tokenFile、stdin/SIGTERM 合同。M2 的 WKWebView、Keychain、窗口关闭/完整退出验证不能从当前 Linux 成绩推导。

恢复本轮工作：先核对 HEAD 是交接 SHA 或其包含本次变更的后续提交，阅读根 AGENTS 与适用指令，运行 `git diff --check`。依赖锁与构建输入未改变时复用本轮证据；有代码变化才针对受影响路径重新构建/测试。不自动合并或发布。
