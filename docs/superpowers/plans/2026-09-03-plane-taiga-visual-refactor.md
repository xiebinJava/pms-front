# Plane + Taiga 视觉重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变业务逻辑的前提下，将 PMS 的共享视觉基础、应用壳层和项目核心页面迁移到 Plane + Taiga 对标的工作台体验。

**Architecture:** 先扩展现有 `--pms-*` 令牌和共享页面原语，再逐层改造壳层、项目列表/详情、治理页面和工作台。路由、API、权限、领域类型和状态机保持原样，所有交互状态由现有响应式数据和后端响应驱动。

**Tech Stack:** Vue 3、TypeScript、Ant Design Vue 4、Vite、Pinia、CSS variables、Node test、Playwright。

**Spec:** `docs/superpowers/specs/2026-09-03-plane-taiga-visual-design.md`

## Global Constraints

- 业务文案以中文为主，英文只作为品牌、账号、编码或小号辅助信息。
- 所有颜色、间距、字号、圆角、阴影和焦点样式必须通过 `--pms-*` 语义令牌消费。
- 不改变 API、路由、权限计算、组织负责人/员工主归属关系和业务状态机。
- 1440px、1280px、768px、390px 视口均不得出现无意横向溢出。
- 每个阶段结束后运行 `pnpm test`、`pnpm typecheck`、`pnpm build`，并更新 `design-qa.md`。

---

### Task 1: 建立 Plane/Taiga 对标基线与共享令牌

**Files:**
- Modify: `src/styles/design-system.ts`
- Modify: `src/styles/index.css`
- Modify: `src/styles/fs-insight.css`
- Modify: `src/styles/design-system.test.mjs`
- Modify: `docs/frontend-design-system.md`
- Modify: `design-qa.md`

**Interfaces:**
- Produces: `designTokens` and CSS variables for interactive surfaces, focus rings, elevation levels, motion durations, compact controls and responsive gutters.

- [x] **Step 1: Write the failing contract test**

Add assertions in `src/styles/design-system.test.mjs` for `controlHeightCompact`, `focusRing`, `shadowInteractive`, `motionFast`, and the corresponding CSS variable names and `.pms-interactive-surface` selector.

- [x] **Step 2: Run the focused test and verify it fails**

Run: `pnpm test -- src/styles/design-system.test.mjs`
Expected: FAIL because the new token fields and CSS selector do not exist.

- [x] **Step 3: Add the minimal token and primitive implementation**

Define the values in `src/styles/design-system.ts` and mirror them in `src/styles/index.css`. Add focused rules in `src/styles/fs-insight.css` for stable hover/focus elevation, compact controls, and the responsive content gutter. Do not change any Vue template or API code in this task.

- [x] **Step 4: Run the focused test and the existing style tests**

Run: `pnpm test -- src/styles/design-system.test.mjs src/views/visual-depth.test.mjs`
Expected: PASS with no warnings.

- [x] **Step 5: Update the design contract and commit**

Record the new token values, allowed states, and Plane/Taiga deviations in `docs/frontend-design-system.md` and `design-qa.md`, then commit:

```bash
git add src/styles/design-system.ts src/styles/index.css src/styles/fs-insight.css src/styles/design-system.test.mjs docs/frontend-design-system.md design-qa.md
git commit -m "style: establish plane taiga visual tokens"
```

### Task 2: Refine the application shell and navigation

**Files:**
- Modify: `src/layout/Index.vue`
- Modify: `src/layout/index.test.mjs`
- Modify: `src/styles/fs-insight.css`
- Modify: `src/locales/zh-CN.ts`
- Modify: `src/locales/en-US.ts`

**Interfaces:**
- Consumes: Task 1 visual tokens.
- Produces: Stable navigation group states and accessible shell classes without changing route targets.

- [x] **Step 1: Add failing shell contract assertions**

Extend `src/layout/index.test.mjs` to assert that navigation groups expose `aria-expanded`, active state classes, a distinct icon per meaning, and a shell-level skip-to-content target.

- [x] **Step 2: Run the focused layout test and verify it fails**

Run: `pnpm test -- src/layout/index.test.mjs`
Expected: FAIL because the skip target and refined shell contract are not yet present.

- [x] **Step 3: Implement shell-only interaction polish**

Add a keyboard-accessible skip link, stable `aria-current`/labels, and Plane-like active group styling. Keep all existing route strings, permission checks, search calls, notification calls and logout behavior unchanged. Use existing icons; only assign distinct meanings and do not introduce duplicate navigation icons.

- [x] **Step 4: Run layout and visual tests**

Run: `pnpm test -- src/layout/index.test.mjs src/views/visual-depth.test.mjs`
Expected: PASS.

- [x] **Step 5: Commit the shell change**

```bash
git add src/layout/Index.vue src/layout/index.test.mjs src/styles/fs-insight.css src/locales/zh-CN.ts src/locales/en-US.ts
git commit -m "style: refine pms workspace shell"
```

### Task 3: Refine the project list workbench

**Files:**
- Modify: `src/views/project/list/index.vue`
- Modify: `src/views/project/list/index.test.mjs`
- Modify: `src/styles/fs-insight.css`
- Modify: `docs/design-logic.md`
- Modify: `design-qa.md`

**Interfaces:**
- Consumes: Task 1 shared controls and Task 2 shell.
- Produces: A dense, responsive project list with stable toolbar geometry and inline row actions; existing `getProjectPage`, create, edit and delete behavior remains unchanged.

- [x] **Step 1: Add failing visual contract assertions**

Add assertions for a labelled filter toolbar, stable two-line date markup, row hover action grouping, and an explicit table scroll container.

- [x] **Step 2: Run the focused test and verify it fails**

Run: `pnpm test -- src/views/project/list/index.test.mjs`
Expected: FAIL on the missing toolbar label/action grouping contract.

- [x] **Step 3: Implement the minimal project-list visual changes**

Use existing project data and event handlers. Add semantic toolbar grouping and labels, keep search/select/query controls at the shared height, preserve two-line dates and manager fallback, and move action links into a stable inline action group that does not change row height on hover. Do not add statistics or new API calls.

- [x] **Step 4: Run list tests and build checks**

Run: `pnpm test -- src/views/project/list/index.test.mjs src/views/visual-depth.test.mjs && pnpm typecheck && pnpm build`
Expected: PASS and a successful Vite build.

- [x] **Step 5: Update QA notes and commit**

Record desktop and narrow-screen screenshots/mismatch notes in `design-qa.md` and the list layout rule in `docs/design-logic.md`, then commit:

```bash
git add src/views/project/list/index.vue src/views/project/list/index.test.mjs src/styles/fs-insight.css docs/design-logic.md design-qa.md
git commit -m "style: refine project list workbench"
```

### Task 4: Refine project detail, board and collaboration surfaces

**Files:**
- Modify: `src/views/project/detail/index.vue`
- Modify: `src/views/project/detail/components/NodeNavigator.vue`
- Modify: `src/views/project/detail/components/TaskKanban.vue`
- Modify: `src/views/project/detail/components/Milestones.vue`
- Modify: `src/views/project/project-visual.test.mjs`
- Modify: `src/views/project/detail/workflow.test.mjs`
- Modify: `src/styles/fs-insight.css`
- Modify: `docs/design-logic.md`
- Modify: `design-qa.md`

**Interfaces:**
- Consumes: Project aggregate and existing node/task/milestone APIs.
- Produces: Plane-like context header and Taiga-like board interactions without changing status transitions or permission checks.

- [x] **Step 1: Add failing detail visual-state tests**

Extend `src/views/project/project-visual.test.mjs` to assert the detail page has a labelled node assignment row, a stable task-card action region, and a collaboration tab strip. Extend `src/views/project/detail/workflow.test.mjs` to assert the board exposes a drag surface and an accessible delete action.

- [x] **Step 2: Run the focused detail tests and verify they fail**

Run: `pnpm test -- src/views/project/project-visual.test.mjs src/views/project/detail/workflow.test.mjs`
Expected: FAIL on the new labels/action-region assertions.

- [x] **Step 3: Implement the minimum CSS/template grouping changes**

Keep all existing task, node and milestone handlers and API payloads. Add semantic wrappers/labels for the node owner and schedule row, reserve a fixed action region inside task cards, and style the collaboration tabs using the shared active/hover/focus contracts. Preserve the existing card delete confirmation and status transitions.

- [x] **Step 4: Run focused tests, typecheck and build**

Run: `pnpm test -- src/views/project/project-visual.test.mjs src/views/project/detail/workflow.test.mjs && pnpm typecheck && pnpm build`
Expected: PASS and a successful Vite build.

- [x] **Step 5: Update QA notes and commit**

Record the detail-page desktop and narrow-screen checks in `design-qa.md`, then commit:

```bash
git add src/views/project/detail/index.vue src/views/project/detail/components/NodeNavigator.vue src/views/project/detail/components/TaskKanban.vue src/views/project/detail/components/Milestones.vue src/views/project/project-visual.test.mjs src/views/project/detail/workflow.test.mjs src/styles/fs-insight.css docs/design-logic.md design-qa.md
git commit -m "style: refine project detail collaboration surfaces"
```

### Task 5: Refine organization, governance, feedback and manual surfaces

**Files:**
- Modify: `src/views/admin/org/OrgCanvas.vue`
- Modify: `src/views/admin/org/index.vue`
- Modify: `src/views/admin/users/index.vue`
- Modify: `src/views/admin/roles/index.vue`
- Modify: `src/views/admin/import/index.vue`
- Modify: `src/views/admin/audit/index.vue`
- Modify: `src/views/feedback/index.vue`
- Modify: `src/views/manual/index.vue`
- Modify: `src/styles/fs-insight.css`
- Modify: `src/views/admin/admin-visual.test.mjs`
- Modify: `src/views/manual/manual.test.mjs`
- Modify: `docs/design-logic.md`
- Modify: `design-qa.md`

**Interfaces:**
- Consumes: Existing organization, role, import, audit, feedback and manual APIs.
- Produces: Consistent governance tools, full-size pan/zoom canvas, responsive manual navigation and feedback queue visuals.

- [x] **Step 1: Add failing page contract assertions**

Extend `src/views/admin/admin-visual.test.mjs` and `src/views/manual/manual.test.mjs` to assert the organization canvas has a bounded viewport, governance pages use the shared toolbar/table primitives, and the manual exposes separate business-rule/design-system navigation targets.

- [x] **Step 2: Run the focused governance/manual tests and verify they fail**

Run: `pnpm test -- src/views/admin/admin-visual.test.mjs src/views/manual/manual.test.mjs`
Expected: FAIL on the missing canvas/toolbar/manual-target contracts.

- [x] **Step 3: Implement shared visual patterns without changing business calls**

Keep organization mutations, permission checks, import job state and manual content unchanged. Add the full-size pan/zoom workspace styling, align user/role/import/audit filters, keep Chinese labels with small English codes, and make the manual table of contents responsive with active-section styling.

- [x] **Step 4: Run focused tests, typecheck, build and privacy checks**

Run: `pnpm test -- src/views/admin/admin-visual.test.mjs src/views/manual/manual.test.mjs && pnpm typecheck && pnpm build && ./scripts/check-privacy.sh`
Expected: PASS with no privacy-denylist findings and a successful build.

- [x] **Step 5: Update QA notes and commit**

Record desktop, tablet and mobile governance/manual checks in `design-qa.md`, then commit:

```bash
git add src/views/admin/org/OrgCanvas.vue src/views/admin/org/index.vue src/views/admin/users/index.vue src/views/admin/roles/index.vue src/views/admin/import/index.vue src/views/admin/audit/index.vue src/views/feedback/index.vue src/views/manual/index.vue src/styles/fs-insight.css src/views/admin/admin-visual.test.mjs src/views/manual/manual.test.mjs docs/design-logic.md design-qa.md
git commit -m "style: align governance and manual surfaces"
```

### Task 6: Cross-page visual QA and documentation closeout

**Files:**
- Modify: `docs/frontend-design-system.md`
- Modify: `docs/design-logic.md`
- Modify: `design-qa.md`
- Modify: `CHANGELOG.md`
- Test: `tests/e2e/auth-and-project.spec.ts`
- Test: `tests/e2e/manual-record.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–5 rendered surfaces.
- Produces: A reproducible visual acceptance record and release-note entry.

- [x] **Step 1: Run the full local test matrix**

Run: `pnpm test && pnpm typecheck && pnpm build && ./scripts/check-privacy.sh`

- [x] **Step 2: Run desktop and mobile browser flows**

Use the existing backend integration workflow or local Playwright command to cover login, project list/detail, organization, permissions and manual. The authenticated local browser session covered 1440px and 390px; the standalone Playwright command ran with 3 credential-dependent tests skipped because `E2E_USERNAME/E2E_PASSWORD` are not configured in this environment.

- [x] **Step 3: Record every mismatch or intentional deviation**

Update `design-qa.md` with route, viewport, expected pattern, rendered result, fix, and remaining risk. Keep screenshots outside the repository unless they are approved documentation assets.

- [x] **Step 4: Update release notes and commit**

Add the visual migration summary and test counts to `CHANGELOG.md`, then commit:

```bash
git add docs/frontend-design-system.md docs/design-logic.md design-qa.md CHANGELOG.md tests/e2e/auth-and-project.spec.ts tests/e2e/manual-record.spec.ts
git commit -m "docs: record plane taiga visual migration"
```
