<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# 初始失败与修复

- 旧 checkout 缺失；按新增授权从已提交分支恢复到新空目录，不恢复/覆盖任何未提交文件。
- node-gyp headers 解包 `fchown EINVAL`：使用官方 Node 24.22.1 headers / Python data filter，指定 nodedir 后安装成功。
- 默认 apt update 因 namespace UID/setgroups 失败；原生 apt 的 Sandbox user=root、自有 /tmp lists/cache 与 download-only 可用，提取 sysroot 后 Linux Tauri check 成功，没有声称系统安装或 Mac 编译。
- 首轮 Rust fixture 编译失败（Drop 类型结构更新、构造参数），修复后通过。原生接口与真实 mock Host 测试包含在最终报告。
- 初期浏览器检查发现普通浏览器错误触发 native account poll，以及 Sign In 错误启用；修复 runtime.available 检查。新增控件测试发现 select 标签包含 options 文本，补准确 aria-label。最终 6/6 通过。
- 新增 core 生命周期 fixture 缺失 startedAt 导致官方 reducer 异常，修正符合协议的 fixture；实际 mock permission 拒绝不会自行结束 turn，测试改为先验证取消工具收敛再显式停止 turn，没有为通过测试自动批准。最终 core 测试通过。
- 浏览器下载一次 zip 不完整，Playwright 的匹配 1194 headless shell 后续下载成功；没有换用不匹配版本。

这些失败不被抹成首次成功；阶段失败原始输出存于 `failures/`，最终通过报告在本目录。未配置真实账户和没有新版 Mac 验收仍是外部门禁，而非这些已修复的确定性测试失败。
