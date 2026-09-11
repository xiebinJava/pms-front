# PMS Design System Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 PMS 前端统一迁移到冷灰工作台视觉风格，并沉淀可复用的前端设计规范。

**Architecture:** 保留 Vue3、Ant Design Vue、UnoCSS 和现有业务接口，只替换视觉令牌、Ant Design Vue 主题和页面级样式。全局变量放在 `src/styles/index.css`，页面特有样式继续靠近页面组件，规范文档放在 `docs/frontend-design-system.md`，通过浏览器回归保证项目流程、表格、弹窗和节点交互不变。

**Tech Stack:** Vue 3.5, TypeScript, Ant Design Vue 4, UnoCSS, Vite, Vitest-free Node test runner.

**Spec:** `docs/frontend-design-system.md`

## Global Constraints

- 主色使用 `#0A5DC2`，页面背景使用 `#F7F8FA`，默认面板使用 `#FFFFFF`。
- 默认圆角为 `8px`，小控件圆角为 `4px`，不新增渐变视觉。
- 继续使用现有 Vue、Ant Design Vue、UnoCSS 依赖，不引入 React 或新的 UI 框架。
- 不修改现有后端接口和业务状态语义。
- 不覆盖工作区中已有的业务改动；每个任务结束都运行对应测试和类型检查。

### Task 1: Establish design tokens and documentation

**Files:**
- Create: `docs/frontend-design-system.md`
- Modify: `src/styles/index.css`
- Modify: `src/App.vue`
- Test: `src/styles/design-system.test.mjs`

- [x] Write a failing token test that asserts the PMS token contract contains the primary, background, border, text and radius values.
- [x] Run `node --test src/styles/design-system.test.mjs` and verify it fails because the exported token contract does not exist.
- [x] Add `src/styles/design-system.ts` with the typed token contract used by tests and update `src/styles/index.css` and the Ant Design Vue theme to use the same values.
- [x] Run the token test and `pnpm typecheck` and verify both pass.
- [x] Keep the CSS variables documented in `docs/frontend-design-system.md` and remove direct old color values from global style definitions.

### Task 2: Refactor the application shell

**Files:**
- Modify: `src/layout/Index.vue`
- Modify: `src/styles/index.css`
- Test: browser smoke check for `/projects`

- [x] Replace inline shell colors and dimensions with the design variables.
- [x] Set the shell to a 236px sidebar, 62px topbar, white surfaces, border-only separation, and blue-soft active navigation.
- [x] Preserve route selection, user hydration, logout behavior and the mobile sidebar collapse.
- [x] Verify `/projects` renders the same route and user controls with no console errors.

### Task 3: Restyle the project list without changing behavior

**Files:**
- Modify: `src/views/project/list/index.vue`
- Modify: `src/styles/index.css`
- Test: existing list interactions in browser

- [x] Replace hard-coded PMS colors and one-off inline gradients with token-backed classes.
- [x] Align page header, statistic blocks, filters, table, tags, progress, action links and modal fields with the shared design dimensions.
- [x] Preserve search, status filtering, pagination, create, edit, delete and row navigation behavior.
- [x] Verify all controls in `/projects` and confirm the table remains readable at desktop and narrow widths.

### Task 4: Restyle the project detail workflow

**Files:**
- Modify: `src/views/project/detail/index.vue`
- Modify: `src/views/project/detail/components/NodeNavigator.vue`
- Modify: `src/styles/index.css`
- Test: `src/views/project/detail/workflow.test.mjs` and browser detail workflow

- [x] Replace page-local old tokens with the shared PMS design variables.
- [x] Align project header, flow navigator, read-only project profile, node information and collaboration tabs to the same panel, border and typography system.
- [x] Preserve free node selection, node progress calculation, completion, completed-node rollback visibility and backend rollback behavior.
- [x] Verify active, pending and completed node states in the browser.

### Task 5: Restyle login and remaining shared surfaces

**Files:**
- Modify: `src/views/login/index.vue`
- Modify: shared styles under `src/styles/index.css`
- Test: browser login route smoke check

- [x] Apply the same surface, typography, field, button and error-state tokens to login.
- [x] Preserve login validation, token persistence and redirect behavior.
- [x] Verify login and authenticated shell states without changing auth semantics.

### Task 6: Final visual and regression QA

**Files:**
- Modify: `design-qa.md`
- Test: all frontend commands and browser screenshots

- [x] Run `node --experimental-strip-types --test src/views/project/detail/workflow.test.mjs`.
- [x] Run `pnpm typecheck`, `pnpm build` and `git diff --check`.
- [x] Check `/projects` and `/projects/1` in the browser at desktop and narrow viewport sizes.
- [x] Confirm no required text or interaction disappeared and no old gradient or hard-coded global token remains.
- [x] Record intentional deviations and the final result in `design-qa.md`.
