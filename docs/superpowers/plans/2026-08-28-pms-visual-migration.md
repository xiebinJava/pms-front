# PMS 视觉迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** 在不改变 PMS 业务接口、路由和权限逻辑的前提下，将外部设计参考前端的应用壳、视觉令牌、通用控件和页面布局迁移到 PMS。

**Architecture:** 采用混合迁移。Vue 3、Ant Design Vue、Pinia 和现有页面状态继续保留；新增 PMS 自有的 CSS 令牌和少量可复用视觉组件，通过 class/slot 包装覆盖 Ant 默认视觉。页面按“认证 → 应用壳 → 项目 → 管理后台”的顺序迁移，每个任务都有独立的源代码断言、类型检查和浏览器回归点。

**Tech Stack:** Vue 3.5, TypeScript, Ant Design Vue 4, Pinia, UnoCSS, Vite, Node test runner。

**Spec:** `docs/superpowers/specs/2026-08-28-pms-visual-design.md`

## Global Constraints

- 页面背景 `#f7f8fa`，面板 `#ffffff`，主色 `#0a5dc2`，边框 `#e1e6ed`。
- 顶栏 62px，侧栏 236px，内容区最大 1460px，桌面内边距 31px 34px 64px。
- 控件高度 36px，面板圆角 8px，小控件圆角 6px，字体栈与设计参考前端一致。
- 保留 Vue + Ant Design Vue，不迁移设计参考前端的业务接口、品牌资产或登录方式。
- 人员展示使用“中文名（英文名）”；组织负责人和员工主归属保持独立。
- 每项改动先补一个会失败的 Node 测试，再写最小实现；每项完成后运行类型检查、Node 用例和浏览器烟测。

### Task 1: 建立 PMS 令牌和全局视觉基线

**Files:**
- Modify: `src/styles/design-system.ts`
- Modify: `src/styles/index.css`
- Create: `src/styles/pms-theme.css`
- Modify: `src/App.vue`
- Test: `src/styles/design-system.test.mjs`

**Interfaces:**
- Produces `designTokens` values used by Ant `ConfigProvider` and CSS variables.
- Produces global classes `.pms-panel`, `.pms-page-header`, `.pms-button`, `.pms-state-card` for later page tasks.

- [ ] **Step 1: Write the failing token and global-style assertions**

  Extend `design-system.test.mjs` with assertions for `primaryDark`, `primarySoft`, `surfaceMuted`, `borderStrong`, `shadowSm`, and the existence of `src/styles/pms-theme.css` containing `.pms-panel`, `.pms-page-header`, and `.pms-button--primary`.

- [ ] **Step 2: Run the focused test and verify it fails**

  Run: `node --test src/styles/design-system.test.mjs`
  Expected: FAIL because the new token fields and stylesheet do not exist yet.

- [ ] **Step 3: Implement the baseline**

  Add the missing token fields, align `index.css` root variables to the design-reference values, move reusable panel/header/button/state styles into `pms-theme.css`, and import it from `App.vue` after `index.css`.

- [ ] **Step 4: Verify the focused test and typecheck**

  Run: `node --test src/styles/design-system.test.mjs && pnpm typecheck`
  Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit**

  `git add src/styles src/App.vue && git commit -m "refactor: align PMS visual tokens with the PMS theme"`

### Task 2: 重做应用壳和导航

**Files:**
- Modify: `src/layout/Index.vue`
- Modify: `src/layout/index.test.mjs`
- Modify: `src/styles/pms-theme.css`

**Interfaces:**
- Consumes `designTokens` and the existing `useUserStore`, route map, permissions and password modal.
- Produces the stable shell classes `.pms-topbar`, `.pms-sidebar`, `.pms-main-content`, `.pms-sidebar--open` used by every page.

- [ ] **Step 1: Write failing shell-structure assertions**

  Assert that `Index.vue` includes a sticky topbar, a mobile menu button, `.pms-sidebar`, `.pms-sidebar-scrim`, `.pms-main-content`, and a 236px shell variable; retain the existing admin route strings and menu handler assertion.

- [ ] **Step 2: Run the focused test and verify it fails**

  Run: `node --test src/layout/index.test.mjs`
  Expected: FAIL because the current template still uses the old Ant layout class names and has no mobile shell controls.

- [ ] **Step 3: Implement shell migration**

  Replace the outer Ant layout markup with semantic `header`, `aside`, and `main` wrappers while keeping the same route/menu and user actions. Render the configuration links as the theme-style grouped navigation, add a mobile menu button and scrim, and apply the 62/236/max-1460 layout rules. Keep the password modal behavior unchanged.

- [ ] **Step 4: Verify shell behavior**

  Run: `node --test src/layout/index.test.mjs && pnpm typecheck`
  Then load `/projects` in the browser at desktop and 390px widths; verify the selected route, mobile drawer and logout/password menu respond.

- [ ] **Step 5: Commit**

  `git add src/layout/Index.vue src/layout/index.test.mjs src/styles/pms-theme.css && git commit -m "refactor: rebuild PMS application shell"`

### Task 3: 迁移认证页与通用控件

**Files:**
- Modify: `src/views/login/index.vue`
- Modify: `src/views/auth/activate.vue`
- Modify: `src/views/auth/reset-password.vue`
- Modify: `src/styles/pms-theme.css`
- Create: `src/components/PmsPageHeader.vue`
- Create: `src/components/PmsPanel.vue`
- Create: `src/components/PmsStatus.vue`
- Test: `src/views/auth/auth-visual.test.mjs`

**Interfaces:**
- `PmsPageHeader` props: `{ title: string; description?: string; eyebrow?: string }`, slot `actions`.
- `PmsPanel` renders a semantic `section` with optional `class` and default slot.
- `PmsStatus` props: `{ tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string }`.

- [ ] **Step 1: Write failing auth and component assertions**

  Add `auth-visual.test.mjs` that checks all three auth pages use `.pms-auth-page`, `.pms-auth-card`, and the shared button class; check the new component files expose their documented props/classes.

- [ ] **Step 2: Run the focused test and verify it fails**

  Run: `node --test src/views/auth/auth-visual.test.mjs`
  Expected: FAIL because the pages still use page-specific card classes and shared components are absent.

- [ ] **Step 3: Implement auth and primitives**

  Create the three small components with slots and typed props. Update login/activate/reset templates to use the shared auth shell, preserve validation messages and store calls, and style inputs, headings, helper copy and submit states according to the theme typography scale.

- [ ] **Step 4: Verify**

  Run: `node --test src/views/auth/auth-visual.test.mjs && pnpm typecheck`
  Browser flow: open `/login`, submit empty form, verify Chinese inline validation remains visible and no console errors appear.

- [ ] **Step 5: Commit**

  `git add src/views/login src/views/auth src/components src/styles/pms-theme.css && git commit -m "refactor: align authentication surfaces"`

### Task 4: 迁移项目列表和项目详情

**Files:**
- Modify: `src/views/project/list/index.vue`
- Modify: `src/views/project/detail/index.vue`
- Modify: `src/views/project/detail/components/NodeNavigator.vue`
- Modify: `src/views/project/detail/components/PersonSelect.vue`
- Modify: `src/views/project/detail/components/TaskKanban.vue`
- Modify: `src/views/project/detail/components/Members.vue`
- Modify: `src/views/project/detail/components/Milestones.vue`
- Modify: `src/views/project/detail/components/Comments.vue`
- Modify: `src/styles/pms-theme.css`
- Test: existing `src/views/project/list/index.test.mjs`, `src/views/project/detail/workflow.test.mjs`, `src/views/project/detail/business-line-owner.test.mjs`

**Interfaces:**
- Reuses existing project API, workflow helpers, person label helpers and all current permissions.
- Produces consistent `.pms-page-header`, `.pms-table-panel`, `.pms-detail-panel`, `.pms-filter-bar`, `.pms-task-card` and `.pms-modal` visuals.

- [ ] **Step 1: Add failing structure assertions**

  Extend project list tests to require `.pms-page-header`, `.pms-table-panel`, `.pms-filter-bar`, and a horizontally scrollable table wrapper. Extend detail tests to require `.pms-detail-panel`, `.pms-node-flow`, `.pms-schedule-picker`, `.pms-task-card__delete`, and the existing business-line/leader assertions.

- [ ] **Step 2: Run focused tests and verify failures**

  Run: `node --test src/views/project/list/index.test.mjs src/views/project/detail/workflow.test.mjs src/views/project/detail/business-line-owner.test.mjs`
  Expected: FAIL on the newly required visual classes.

- [ ] **Step 3: Implement project surfaces**

  Replace page-specific wrappers with shared header/panel classes, normalize table density and action links, keep the project list/detail data fields identical, and apply theme modal/filter/input styles. Preserve the Chinese person formatter, automatic business-line leader assignment, node scheduling, task delete hover behavior and flow connector interaction.

- [ ] **Step 4: Verify project workflow**

  Run the focused Node tests and `pnpm typecheck`. Browser flow: `/projects` → open a project → select business line → verify leader appears → choose node dates → hover/delete a task; capture desktop and mobile screenshots.

- [ ] **Step 5: Commit**

  `git add src/views/project src/styles/pms-theme.css && git commit -m "refactor: align project management surfaces"`

### Task 5: 迁移管理后台页面

**Files:**
- Modify: `src/views/admin/users/index.vue`
- Modify: `src/views/admin/org/index.vue`
- Modify: `src/views/admin/org/OrgCanvas.vue`
- Modify: `src/views/admin/roles/index.vue`
- Modify: `src/views/admin/import/index.vue`
- Modify: `src/views/admin/audit/index.vue`
- Modify: `src/styles/pms-theme.css`
- Modify: existing admin `*.test.mjs` files

**Interfaces:**
- Keeps admin API modules, permission guards, import step state, organization canvas pan/zoom state and audit server pagination unchanged.
- Produces consistent admin page headers, filter panels, table rows, import steps, audit detail expansion and full-height organization canvas.

- [ ] **Step 1: Add failing admin visual assertions**

  Extend admin tests to require `.pms-admin-page`, `.pms-filter-bar`, `.pms-admin-table`, `.pms-org-workspace`, and Chinese role/data-scope labels with lowercase English secondary text.

- [ ] **Step 2: Run focused tests and verify failures**

  Run: `node --test src/views/admin/**/*.test.mjs`
  Expected: FAIL on the new shared admin classes.

- [ ] **Step 3: Implement admin migration**

  Apply shared page headers, filter bars, tables, status tags and modal spacing to users, roles, import and audit. Make the organization canvas full-height inside the main content area with a non-squeezing stage, retain visible leader names, and keep all role/permission/import/audit actions working.

- [ ] **Step 4: Verify admin workflows**

  Run focused Node tests and `pnpm typecheck`. Browser flow: open each admin route, edit a role, preview an import, paginate audit, and pan/zoom organization canvas at desktop/mobile widths.

- [ ] **Step 5: Commit**

  `git add src/views/admin src/styles/pms-theme.css && git commit -m "refactor: align administration surfaces"`

### Task 6: 全局回归、视觉对照与交付记录

**Files:**
- Modify: `README.md` only if the local dev/visual QA command changes.
- Create: `docs/superpowers/reviews/2026-08-28-pms-visual-fidelity.md`

**Interfaces:**
- Consumes the finished frontend and the source reference from a local design-reference frontend (not in this repo).
- Produces a fidelity ledger with at least five concrete comparison points, tested viewports, interaction evidence and intentional deviations.

- [ ] **Step 1: Run the complete automated suite**

  Run: `pnpm typecheck && pnpm build && node --test $(find src -name '*.test.mjs' -print)`.
  Expected: all commands exit 0.

- [ ] **Step 2: Run browser visual QA**

  Start the local frontend with the existing dev command, then use Browser/IAB at 1440×900 and 390×844. Verify page identity, non-blank content, no framework overlay, console health, screenshots and the core project/admin interactions.

- [ ] **Step 3: Write the fidelity ledger**

  Record comparison rows for shell geometry, typography, palette, table/panel boundaries, modal/button states, organization canvas responsiveness and mobile navigation. Include evidence paths and any deliberate PMS branding deviation.

- [ ] **Step 4: Commit**

  `git add docs/superpowers/reviews README.md && git commit -m "docs: record theme visual verification"`

