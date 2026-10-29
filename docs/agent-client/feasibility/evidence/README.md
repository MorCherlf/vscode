<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# 可行性调研证据

日期：2026-10-29。性质：静态源码/manifest 审计与官方资料核对；未执行双生态运行时兼容性测试。

| 文件 | 内容 | 不能证明什么 |
| --- | --- | --- |
| [vscode-import-audit.json](vscode-import-audit.json) | 六个原组件/API 入口的引用、保守闭包、服务装饰器候选和 SHA-256 | 最小 bundle、真实运行时服务清单、内存、提取成本 |
| [audit-vscode-imports.mjs](audit-vscode-imports.mjs) | 上述审计的可重跑脚本，使用已安装的 TypeScript `preProcessFile` | 不能替代构建、原组件运行或插件集成测试 |
| [plugin-manifests.json](plugin-manifests.json) | 三个 VSC、两个 DSH 包的版本/贡献点/声明许可/字节哈希 | 能安装、能激活、主要任务通过或服务可用 |
| [sources.json](sources.json) | 原上游基点确认、34 份 DSH 一手源码/文档、8 份本地源码和官方网页索引 | 外部 live 文档的永久快照或未来版本兼容 |

本地依赖审计先在 `28eb53a537f541dcc45fc69ebda9af276e783257` 执行，再于云端提交 `c58fae13e220bb2f9f75c8fcd7afa78480f4f6e4` 重跑，TypeScript `6.0.2`；两次除输入提交外的全部审计结果一致，后者也没有修改被审计的原 VS Code `src/` 文件；本次报告只把云端认证/协议结果作为独立来源引用。DSH 固定 `f3803c96974ad4a94195fb97e5c637e9c2a3afe3`，检索到的关键文件字节与该提交 Git tree 的 blob SHA 已核对。

在所需依赖已安装的对应 checkout 内重跑：

```sh
node docs/agent-client/feasibility/evidence/audit-vscode-imports.mjs
```

脚本会更新旁边的 `vscode-import-audit.json`，其中 `sourceCommit` 是运行时 HEAD；对照历史结果时同时核对入口文件哈希。脚本跟踪相对 TS/JS 引用，包含类型和副作用导入；它不遍历外部 npm 包实现，不完整推导动态运行时注册和资源依赖。未解析的声明/生成模块保持在 `unresolvedRelative` 中，没有当作完整编译通过。

DSH 官方仓库的稀疏浅克隆曾因网络在扩展 checkout 时失败；研究随后改用 GitHub connector 按固定提交读取文件。源码缓存只存于被忽略的 `.build/research/`，没有把整份第三方仓库或插件可执行包加入产品、没有安装/执行研究样本。已核对来源和哈希不意味着这些代码已被运行。

VSC 样本检索的是 2026-10-29 的默认分支文件，记录了精确内容 blob SHA；blob SHA 是文件对象身份，不能当成 commit SHA 放进 GitHub `/blob/<commit>/` 链接。后续 PoC 必须改用固定 VSIX/源码提交与合法获取路径，并记录实际执行版本。
