<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# 版本和决策记录

| 项目 | 固定值 / 决策 | 风险与下一验证 |
| --- | --- | --- |
| 上游组合 | VS Code 1.145.0，交接 SHA 5d89fa5583233f7aefd2ad65db8296e775d1099b | 构建 manifest 记录基线 SHA；交付 diff 单独审阅 |
| 普通 Node | 24.22.1，Linux x64 ABI 137 | .nvmrc 与随包运行时一致；Mac arm64 单独构建，禁止 Linux 二进制充数 |
| Copilot SDK | 1.0.27-unstable.40031404408.gba6c003 | 沿用根锁版本，不升级工具预算；平台包、SDK、runtime 必须同版本组合 |
| Copilot runtime | 1.0.103-unstable.r40031404408.gba6c003 | 根 package 与平台包一致性检查；不依赖用户全局 CLI |
| AHP | 开发常量 1.1.0；发布兼容基线 1.0.0、0.9.0 | 来自 common/state/protocol/version/registry.ts；测试协商发布基线而不是假定 SDK 都支持开发值 |
| Tauri | 采用 Tauri 2 主线，本轮不安装/不锁虚假精确版本 | M2 创建 Cargo.lock/frontend lock 并验证 WKWebView 后确认版本 |
| 产品身份 | 独立 MorCherlf Agent，关闭 telemetry，单 Copilot provider | 身份/服务配置与品牌、分发许可需真实登录和 M7 发布审查；不冒用 VS Code 登录缓存 |
| 认证 | 32 字节随机连接令牌、0600 文件、仅回环；Copilot 经 AHP authenticate | 无安全配置测试账户时不验证真实服务，不扫描私人钥匙串或 HOME 凭据；真实登录仍阻塞 M1 完整验收 |
| 云环境 | 仓库检出可恢复；node-gyp 头文件 fchown 失败 | 用相同官方版本 headers、不恢复所有权重试；记录错误与复现方法 |
| 多 provider 服务图 | 重用整个 runtime 的 lazy descriptors，只有 Copilot 注册 | 保留少量其他 provider 类型/恢复代码；下一包收窄服务注册边界，不先复制平行 DI 图 |
| 性能预算 | GOALS 原值全部保留 | 没有 Mac 样本就没有校准依据；Linux 产物体积只作诊断 |

顺序：当前平台产物与 mock 协议 → worker/native/WASM/仓库外验证 → 原始错误和清单收敛 → 真实 Copilot 三轮 T05 → Mac arm64/干净 Mac → M2。Mac 与凭据不阻塞其余可独立推进的工程。
