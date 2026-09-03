# PMS 设计验收记录

## 2026-09-03：Plane + Taiga 视觉基础层

### 变更背景

在不改变 API、路由、权限或业务状态的前提下，先把 Plane/Taiga 参考中的密度、层级和交互反馈沉淀为可复用令牌，避免各页面继续各自定义 hover、焦点和阴影。

### 影响范围

- `design-system.ts` 增加紧凑控件高度、焦点环、快速动效和交互阴影令牌。
- `index.css` 与 `fs-insight.css` 保持同一组全局 CSS 变量。
- 新增 `.pms-interactive-surface` 原语，供后续列表、详情、管理面板复用。

### 阶段自检

- [x] 令牌与 CSS 变量值一致。
- [x] hover/focus 不改变组件尺寸或业务状态。
- [x] 视觉原语没有引入新接口字段、路由或权限判断。
- [ ] 项目列表、详情、管理页和手册页面完成逐页迁移（后续阶段）。

## 2026-09-03：应用壳层与导航

### 变更背景

壳层是所有业务页共享的阅读框架。本阶段把导航的键盘路径、当前页语义和移动端抽屉入口补齐，保持现有路由、权限过滤、搜索、通知和退出登录行为不变。

### 阶段自检

- [x] 主内容提供可聚焦的“跳转到主要内容”入口。
- [x] 导航使用 `aria-label` 与 `aria-current="page"` 标记当前路由。
- [x] 组折叠状态继续由现有响应式状态驱动，未改变菜单权限判断。
- [x] 焦点环、hover 过渡复用全局令牌，不改变布局尺寸。
- [ ] 1440px / 390px 浏览器截图验收（跨页 QA 阶段完成）。

## 2026-09-03：项目列表工作台

### 变更背景

项目列表是日常高频入口。本阶段按 Plane/Taiga 的“工具栏—数据表—轻量操作”层级收敛筛选器和行操作，修复动作链接作为普通文本导致的可达性与 hover 跳动风险。

### 阶段自检

- [x] 搜索、状态、查询控件继续复用统一 `36px` 控件几何。
- [x] 筛选工具栏提供 `role=group` 与中文可读标签。
- [x] 日期保持两行展示，组织路径、负责人和项目经理仍使用同一后端聚合数据。
- [x] 行操作改为真实按钮并固定最小高度，删除仍沿用既有二次确认与权限判断。
- [x] 表格继续在 `.pms-project-table-scroll` 容器内横向滚动，不改变分页或 API 参数。
- [ ] 桌面/移动浏览器截图验收（跨页 QA 阶段完成）。

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
