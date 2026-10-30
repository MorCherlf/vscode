<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# 本轮失败归因与修复

| 阶段 | 实际错误 | 处理与最终状态 |
| --- | --- | --- |
| Git CLI push | `could not read Username for 'https://github.com': No such device or address` | 没有 CLI HTTPS 凭据；已连接 GitHub API 推送相同树并创建草稿 PR，不读取或导出访问令牌 |
| Rust 工具初始化 | rustup-init 被临时重命名后报 `unknown proxy name` | 按官方二进制要求恢复 basename，成功安装固定 Rust 1.90.0；不是项目编译错误 |
| 初始 TS 检查 | TS5011 rootDir、Snapshot 无 serverSeq、MessageKind enum 类型 | 显式 rootDir；使用 SDK 的 fromSeq 和生成 enum，不手写伪协议类型 |
| 初始前端构建 | AgentInfo 无 id、ChatInputRequest 无 kind、const enum 不能作为运行时 re-export | 使用 provider、正式问题结构；enum 在共享 TS 编译层内内联，不伪造运行时值 |
| 初始 Rust 编译 | tungstenite root 无 client_with_config | 从正确 client 模块导入；真实 native 测试通过 |
| Linux 系统包安装 | setgroups/seteuid 不被环境允许、/var/cache/apt/archives/partial 写入拒绝 | 不改系统权限或移除其他进程锁；下载到本任务隔离缓存，解压开发依赖到 sysroot，通过 PKG_CONFIG_* 定位 |
| 原始 cargo check | 找不到 pkg-config / GTK 开发库 | 使用隔离 sysroot 中的 pkgconf 与 GTK/WebKit 开发文件；完整 Tauri check 最终通过 |
| Tauri 版本组合 | tauri 2.10.2 与新 macro 依赖出现 API 不一致；tauri 2.12.4 需要 tauri-build ^2.7.3 | 收敛为 tauri/API/CLI 2.12.4、tauri-build 2.7.4，固定 Cargo.lock；未修改第三方源码掩盖错误 |
| 资源 | generate_context 缺少 icons/icon.png | 从仓库 SVG 用固定 Tauri CLI 生成 PNG/ICNS，保留当前桌面需要的资源 |
| 初始 Linux 链接 | `unable to find library -lgtk-3/-lpango-1.0/...` | 开发包 symlink 指向系统已有运行库，隔离 sysroot 中未包含；补入已有系统库后，cargo build --locked 成功产出实际 ELF |
| 初始浏览器下载 | 预装 Playwright 的 Chrome 151 归档报 central directory signature missing | 项目独立固定 @playwright/test 1.56.1，下载其匹配 Chromium；浏览器测试成功，不将下载失败归为 UI 缺陷 |

没有真实账户任务或 Mac 运行失败可供修复：它们尚未执行。该区别不能写成“已通过，等待签字”。账户/Keychain 适配本轮尚未实现；WKWebView、Mac 生命周期与真实对话均保留待验收。
