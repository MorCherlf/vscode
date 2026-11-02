<!-- Copyright (c) Microsoft Corporation. All rights reserved. -->
<!-- Licensed under the MIT License. See LICENSE.txt in the project root for license information. -->

# 本轮失败与修复

1. 上游 Modern 主题包含注释、尾逗号与 include 链；初次 JSON.parse/未展开继承读取失败。改为固定版本 jsonc-parser，展开 include，补齐源码 listColors.ts 注册的默认值；可通过 `npm run sync:theme` 重新生成。未手工改色来绕开错误。
2. Playwright 浏览器首次下载遇到 ETIMEDOUT/ECONNRESET；下载器改用其官方备用地址后成功，浏览器版本为固定的 1194。首次测试启动早于下载完成，before hook 因 executable 不存在失败；安装完成后再运行，不算产品测试通过。
3. 首轮实际 Host/UI 流程发现项目按钮选择文件夹后名称变化，后续定位稳定的“选择项目”操作失败。修复按钮的可访问名称，保留可见文件夹名与完整路径提示；重跑 5/5。
4. 增加待审批取消退出、会话 Home/End、实际断线及草稿恢复检查后，再运行当前测试文件 5/5。没有忽略、删除失败用例或以 mock DOM 代替实际 M1 Host。

原始成功记录随本目录保存；本地迭代的原始失败日志保留在忽略的 `.agent-validation/m2-ui/`。旧 Linux/Mac 记录不被改写成本轮平台的新结果。
