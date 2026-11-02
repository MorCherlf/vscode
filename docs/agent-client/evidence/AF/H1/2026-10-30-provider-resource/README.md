<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# H1：原 custom editor 恢复边界与占位视图裁剪

**实际源码工作；H1 工程进行中，尚不可提交人工验收，没有人工通过。** 基线 `988fbfd2a26f7efe7050c6145718a00989d34fb3` 从既有 checkout 快进整合，保留所有原提交和 Mac 证据。没有重克隆、重置、覆盖用户工作；DSH 未启用，生产 executable 清单仍 []。

## 修复与范围

原 `ContributedCustomEditors` 从 Profile memento 提前恢复 custom editor 描述；描述不带扩展 owner，原 `CustomEditorResolverContribution` 在 BlockRestore 注册其文件 glob。这样即便当前原 extension enablement 已拒绝对应扩展，旧 glob 仍可能在实时贡献到达前参与文件选择。**本轮证明的是不可信旧描述的注册问题；没有声称它绕过 native EH 执行准入。**

修复保留原 resolver/extension point：仅在 Sessions 且产品配置了 executable admission 时跳过无 owner 缓存，等待原已过滤扩展注册表的实时贡献。清单非空也不能推断缓存 owner 已获准，因此同样等待。普通 editor window、未配置策略的 Sessions 保留原缓存行为。构造时不删除旧 cache；原实时 registry 更新仍按原组件保存当前描述。没有新 editor 实现或 API shim，也不改 extension 的 runtime permission。

另外，原 `customViewTest.contribution` 在启动时注册可恢复 placeholder pane 和三条命令，`IsDevelopmentContext` 仅约束开发动作的呈现。Agent First entry point 现在不导入这项演示贡献，普通产品保留；原 `CustomViewService`、grid、真实自定义视图生命周期和服务路由不变。浏览器实际模块请求/命令注册对照验证这项小范围裁剪，不把它扩展成全部 editor-only 依赖已裁掉。

后端/认证调查见 [BACKENDS.md](BACKENDS.md)：原 Host 确有 Copilot、Claude、Codex 与 BYOK/on-device 边界；GitHub OAuth 是所选 Copilot 服务的路径条件，不是所有 backend 或本地 UI 的统一前置。本轮不改 auth gate、不运行个人 SDK/账户、不伪造模型 provider。

## 针对性验证

平台 Linux x64 / Node 24.22.1；原 browser runner 使用显式 Chromium 141.0.7390.37 executable，既非上游 pinned 浏览器，也非 Mac Electron/WKWebView。

| 检查 | 结果与边界 |
| --- | --- |
| 原 CustomEditorResolverContribution | 6 passing：旧普通行为、Sessions 空/非空策略、无策略与非 Sessions 对照、缓存不因构造被删、原实时贡献加入/撤销。实际原 resolver/service，存储和 registry 为测试 fixture；不替代 native VSIX |
| 原 CustomViewService + EditorResolverService + Sessions Auth Gate | 47 passing：原视图恢复/生命周期、原 editor 选择/diff 路由与现有认证 gate。没有模型/账户 |
| 原 Sessions 浏览器原组件探针 | Agent First 与普通路由对照分别通过；原 Chat/Input 键盘、文本/多 diff 审阅、Profile authoring、BulkEdit/FileService/save、合成 Worker EH、composition。占位 custom view 在 Agent First 未请求/无三命令，普通路由三命令与模块保留 |
| 类型、构建、lint、层次 | 客户端增量 build-fast、聚焦原 Sessions common/web/desktop/WindowsMain 类型、聚焦新测试类型、4 文件 lint、完整 layers 退出 0；没有完整原发行构建 |

原始输出、测试类型项目、模块/worker trace 和状态在 [raw/](raw/) 与 [validation.json](validation.json)。初始误用默认 Firefox/缺少 pinned Chromium 的启动失败保留；改用已有显式 Chromium 后运行。初始测试类型失败（公开 IExtensionPoint 不暴露 acceptUsers）保留；改用原 ExtensionsRegistry 的实际测试入口后复验通过。它们不计入通过结果。

```sh
npm run build-fast -- --client-only
node node_modules/@typescript/native/bin/tsc -p src/vs/sessions/tsconfig.agent-first.json
node node_modules/@typescript/native/bin/tsc -p docs/agent-client/evidence/AF/H1/2026-10-30-provider-resource/raw/test-types.json
export AGENT_FIRST_CHROMIUM=/path/to/recorded/chromium
node scripts/agent-first/browser-tests.cjs --browser chromium --run src/vs/workbench/contrib/customEditor/test/browser/customEditorResolverContribution.test.ts
node scripts/agent-first/browser-tests.cjs --browser chromium --run src/vs/sessions/services/customView/test/browser/customViewService.test.ts --run src/vs/workbench/services/editor/test/browser/editorResolverService.test.ts --run src/vs/sessions/test/browser/sessionsAuthGate.test.ts
node scripts/agent-first/web-smoke.mjs --probe-extensions
node scripts/agent-first/web-smoke.mjs --probe-extensions --legacy-editor-routes
npm run eslint -- src/vs/workbench/contrib/customEditor/browser/customEditors.ts src/vs/workbench/contrib/customEditor/common/contributedCustomEditors.ts src/vs/workbench/contrib/customEditor/test/browser/customEditorResolverContribution.test.ts src/vs/sessions/sessions.common.main.ts
GOMEMLIMIT=1000MiB npm run valid-layers-check
```

`--legacy-editor-routes` 只改 agentFirst route flag，不清除 admission；它是原启动贡献的对照，不能称为无策略完整产品/Marketplace 兼容。测试本身显式准入一个合成 Worker fixture，并无生产混合插件放行。

## 原组件 / authoring / 加载审计与未闭合边界

- `TextEditorReviewPolicy` 仅限制原文本 pane 呈现；当前/default Profile 的精确 settings/keybindings/tasks/mcp/languageModels 与归一化 prompts 后代可编辑，项目源码/任意同名文件/diff 不继承例外。原 FileService/BulkEdit/模型保存保持可写，Agent 操作不能被只读视图代替或阻断。
- Custom editor 的 `CustomEditorInput.isReadonly()` 最终读自己的 model；任意 webview 文档不由 `TextEditor` 的 readOnly 控制。**不宣称对未来获准 extension 的任意 custom pane 有统一只读隔离。** 当前 [] 不让这些 executable extensions 运行；未来准入必须审计自定义编辑器/消息/工作副本/恢复的整条调用链，不能仅看 Agent contribution。没有用强制只读模型破坏 Agent 写入/dirty backup。
- 原 `ResourcesDropHandler` 的资源型打开/防 workspace 改变沿用先前修复；内部 EditorDropTarget group move/copy、tree/custom input 和 resolver 仍为原路径。物理 OS/跨实例 dirty transfer、custom pane serializer/backup 重建与跨项目交互尚非本轮运行证明。
- 原 custom view 服务不是 arbitrary VSIX API，也不是 DSH 客户端。保留它和原 webview/API actors 不等于它们所有代码都已实例化；本轮 trace 记录 resource 请求、实际 Worker 生命周期和可用的 Worker performance 资源，buffer 截断/销毁后不可读保持显式限制。不是模型任务时的加载归因，也不是服务实例全覆盖。
- workspace-local AGENTS/skills/hooks/config.toml 等 authoring 不能靠 basename/目录模式一概开写；尚未建立原 customization owner 的窄授权与编辑撤销路径，本轮只保留明确 Profile authoring 行为。此缺口继续独立推进，不要求 GitHub client ID。

## Mac 接力与验收

既有 [Mac VSIX 矩阵](../2026-10-30-mac-vsix-matrix/README.md) 保持 checkout78b70f4/product09c0374；[native API 正向修复](../2026-10-30-mac-native-window-api/README.md) 保持 product20c9dc7 的八项真实 IPC。没有改写旧失败、没有重复声称这些是本轮源码的 Mac 测试。

下次本机更新本工作包后，复用原 build-fast/聚焦测试步骤并源码启动。新增的 native 检查是：在隔离测试 profile 下旧 custom-editor 元数据不能在 [] 时接管资源默认打开；原 Saved text/diff/Chat/Profile 仍走现有原组件；无 placeholder pane/三命令但真实 custom view 服务的注册/恢复不受损。若用真实外部 custom-editor VSIX 制造历史，必须只在测试 overlay 放行该自建 ID，恢复 [] 后同 profile 重启；不能放行混合 Copilot/个人扩展。自动化 resolver 测试不代替这项 native restore；不要求用户现在重复其已完成的普通 main-entry VSIX 六拒绝矩阵。

真正需要人工输入的是选定真实模型 backend 后该路径的专用测试配置，以及原生平台操作/安装包体验；窗口/CLI深链/旧 restore/OS-drop、custom resource/authoring 与模块归因工程仍能独立推进。IME/VoiceOver、完整真实任务、多会话/审批/停止恢复、独立 Mac 包、签名公证与 M1/M2 未完门禁保留。没有合并或发布。
