# PMS 设计验收记录

## 2026-09-02：文档中心拆分与规范页重构

### 变更背景

原「使用手册」把用户操作指南、业务规则和前端设计规范放在同一组目录中，导致阅读目标混杂；业务规则和设计规范也被迫使用“操作步骤 / 使用要点 / 完成后自查”的页面模板，无法承载长期维护的产品与工程约束。

### 验收范围

- 「使用手册」只保留快速开始、工作台、研发管理、项目管理、配置管理、人员与权限、组织架构、角色管理、批量导入、审计日志、常见问题 11 个功能模块。
- 「业务规则」独立路由 `/manual/business-rules`，覆盖身份、组织归属、授权、项目生命周期、导入、审计、并发与恢复 7 个主题。
- 「前端设计规范」独立路由 `/manual/design-system`，覆盖原则、设计系统分层、排版、色彩、布局、组件、交互状态、响应式、无障碍和治理 10 个主题。
- 三个入口统一放在「文档中心」大页签下，页面标题和目录状态与 URL hash 同步。

### 视觉与交互检查

- [x] 参考文档不再渲染用户手册的操作步骤、使用要点和完成后自查模板。
- [x] 独立页面使用统一的 PMS 面板、边框、圆角、阴影、字号和语义色令牌。
- [x] 长文档目录支持点击定位、滚动高亮和浏览器前进/后退。
- [x] 桌面端采用 236px 目录 + 内容双栏；窄屏改为单栏，目录允许两列/一列折叠，正文不产生无意横向溢出。
- [x] 业务规则和设计规范正文没有真实账号、Token、验证码或聊天截图。

### 工程验证

```bash
node --test src/views/manual/manual.test.mjs
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

### 参考依据

- [Ant Design Design Language](https://ant.design/docs/spec/introduce/?locale=en)
- [Material 3 Theming](https://developer.android.com/codelabs/m3-design-theming?hl=en)
- [Carbon Design System — Get started](https://carbondesignsystem.com/designing/get-started/)
- [Automattic Design System Foundations](https://system.automattic.design/foundations/)
