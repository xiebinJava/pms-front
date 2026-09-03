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
- [x] 项目列表、详情、管理页和手册页面完成逐页迁移（跨页 QA 已完成）。

## 2026-09-03：应用壳层与导航

### 变更背景

壳层是所有业务页共享的阅读框架。本阶段把导航的键盘路径、当前页语义和移动端抽屉入口补齐，保持现有路由、权限过滤、搜索、通知和退出登录行为不变。

### 阶段自检

- [x] 主内容提供可聚焦的“跳转到主要内容”入口。
- [x] 导航使用 `aria-label` 与 `aria-current="page"` 标记当前路由。
- [x] 组折叠状态继续由现有响应式状态驱动，未改变菜单权限判断。
- [x] 焦点环、hover 过渡复用全局令牌，不改变布局尺寸。
- [x] 1440px / 390px 浏览器截图验收（跨页 QA 已完成）。

## 2026-09-03：项目列表工作台

### 变更背景

项目列表是日常高频入口。本阶段按 Plane/Taiga 的“工具栏—数据表—轻量操作”层级收敛筛选器和行操作，修复动作链接作为普通文本导致的可达性与 hover 跳动风险。

### 阶段自检

- [x] 搜索、状态、查询控件继续复用统一 `36px` 控件几何。
- [x] 筛选工具栏提供 `role=group` 与中文可读标签。
- [x] 日期保持两行展示，组织路径、负责人和项目经理仍使用同一后端聚合数据。
- [x] 行操作改为真实按钮并固定最小高度，删除仍沿用既有二次确认与权限判断。
- [x] 表格继续在 `.pms-project-table-scroll` 容器内横向滚动，不改变分页或 API 参数。
- [x] 桌面/移动浏览器截图验收（跨页 QA 已完成）。

## 2026-09-03：项目详情、任务看板与协作区

### 变更背景

项目详情同时承载流程、节点分配、任务看板和跨节点协作。本阶段采用 Plane 的对象上下文层级与 Taiga 的看板反馈，但不改变任务移动、删除、节点排期或协作页签的数据流。

### 阶段自检

- [x] 节点负责人、节点排期分别提供可读的分组语义；桌面端同排，窄屏自动纵向堆叠。
- [x] 任务卡片预留固定操作区，删除按钮仅在 hover/focus 时出现，确认弹窗和权限判断保持不变。
- [x] 拖拽中的任务有轻量视觉反馈，状态仍在服务端成功后对齐，失败时沿用原有回滚。
- [x] 协作页签使用统一的 active/hover/focus 指示，不增加新接口或改变页签内容。
- [x] 1440px / 390px 浏览器截图验收（跨页 QA 已完成）。

### 工程验证

```bash
node --test src/views/project/project-visual.test.mjs src/views/project/detail/workflow.test.mjs
pnpm typecheck
pnpm build
git diff --check
```

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

## 2026-09-03：治理页面、组织画布、反馈与手册入口

### 变更背景

本阶段把 Plane/Taiga 的“工作区 + 工具栏 + 稳定操作区”模式扩展到人员、角色、审计、反馈和组织架构页面，并把业务规则、前端设计规范作为使用手册中的独立长期参考入口。所有组织变更、权限判断、导入任务、反馈状态和文档路由保持原有数据流。

### 阶段自检

- [x] 人员、角色、审计和反馈筛选区使用带中文标签的分组语义；表格行操作保留原有权限、确认和跳转行为。
- [x] 组织画布提供独立的可访问区域、键盘焦点和控制分组；属性面板与画布布局互不挤压，平移/缩放逻辑未改动。
- [x] 使用手册提供业务规则、前端设计规范的独立入口，功能目录仍只承载快速开始到常见问题的操作模块。
- [x] 小屏下参考文档入口自动单列，治理操作区允许换行，长表格继续在既有滚动容器内查看。
- [x] 未新增接口、权限判断或敏感数据；没有把真实账号、Token、验证码或聊天截图写入文档。

### 工程验证

```bash
node --test src/views/admin/admin-visual.test.mjs src/views/manual/manual.test.mjs
pnpm test
pnpm typecheck
pnpm build
./scripts/check-privacy.sh
git diff --check
```

### 参考依据

- [Ant Design Design Language](https://ant.design/docs/spec/introduce/?locale=en)
- [Material 3 Theming](https://developer.android.com/codelabs/m3-design-theming?hl=en)
- [Carbon Design System — Get started](https://carbondesignsystem.com/designing/get-started/)
- [Automattic Design System Foundations](https://system.automattic.design/foundations/)

## 2026-09-03：跨页面桌面与移动端验收

### 验收环境

- 本地前后端：`http://127.0.0.1:57979`，使用已登录的本地演示会话；未把账号、密码或 Token 写入仓库。
- 桌面视口：`1440 × 900`；移动视口：`390 × 844`。
- 验收方式：通过应用内导航覆盖工作台、研发管理、配置管理、反馈中心和文档中心；另外运行了 Playwright 命令以确认凭据缺失时按设计跳过认证用例。

### 路由结果

| 路由 | 桌面 | 移动 | 关键检查 |
| --- | --- | --- | --- |
| `/dashboard` | 通过 | 通过 | 工作概览、任务/项目区块存在；无页面横向溢出 |
| `/projects` | 通过 | 通过 | 工具栏与项目表格对齐；日期/路径保留信息；表格仅在自身容器滚动 |
| `/projects/:id` | 通过 | 通过 | 项目上下文、流程、节点排期、任务看板与协作区层级稳定 |
| `/admin/users` | 通过 | 通过 | 人员筛选分组、主归属/兼职归属与固定行操作可读 |
| `/admin/org` | 通过 | 通过 | 画布、连线和属性面板独立；移动端画布保持可平移 |
| `/admin/roles` | 通过 | 通过 | 中文角色名 + 小写英文编码，数据范围说明不截断 |
| `/admin/import` | 通过 | 通过 | 上传/预览/提交步骤在窄屏换行，不改变导入状态 |
| `/admin/audit` | 通过 | 通过 | 中文筛选和动作说明；长编码不撑破表格 |
| `/feedback` | 通过 | 通过 | 反馈筛选与队列表格无 500，移动端保持单列 |
| `/manual#quick-start` | 通过 | 通过 | 目录与正文联动；功能手册、业务规则、设计规范入口分离 |
| `/manual/business-rules` | 通过 | 通过 | 规则正文独立阅读，目录可定位 |
| `/manual/design-system` | 通过 | 通过 | 设计系统正文独立阅读，目录可定位 |

### 结果与有意偏差

- 所有已登录烟测路由均未出现 `Request failed with status code 500`，页面 `scrollWidth` 与 `clientWidth` 在两个视口一致；表格横向滚动和组织画布平移是容器级的有意行为。
- 移动端侧栏由抽屉入口承载，组织画布使用固定可读工作区高度；这两点是响应式适配，不是桌面版的缩放变形。
- `pnpm exec playwright test tests/e2e/auth-and-project.spec.ts tests/e2e/manual-record.spec.ts --reporter=line` 已执行，因当前环境未设置 `E2E_USERNAME/E2E_PASSWORD`，3 个凭据依赖用例按测试设计跳过；有凭据的目标企业环境仍需在部署验收时重跑。

### 工程验证

```text
pnpm test                                  # 130 passed
pnpm typecheck                             # passed
pnpm build                                 # passed, 3367 modules
./scripts/check-privacy.sh                 # privacy scan passed
git diff --check                           # passed
pnpm exec playwright test ... --reporter=line # 3 skipped (credentials not set)
```
