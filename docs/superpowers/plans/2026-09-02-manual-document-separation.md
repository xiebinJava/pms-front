# Manual Document Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将用户使用手册、业务规则和前端设计规范拆成清晰的导航与独立页面，并补齐符合成熟设计系统结构的详细内容。

**Architecture:** `/manual` 只渲染快速开始至常见问题的 11 个用户功能模块；`/manual/business-rules` 与 `/manual/design-system` 使用同一个参考文档页面壳，但各自拥有独立路由、目录和内容模型。侧边栏新增“文档”分组，三个页面作为互相独立的子页签。

**Tech Stack:** Vue 3、Vue Router、Vue I18n、TypeScript、Ant Design Vue、CSS variables、Node test runner、Vite。

**Spec:** `docs/user-manual.md`、`docs/design-logic.md`、`docs/frontend-design-system.md`。

## Global Constraints

- 使用手册仅包含快速开始、工作台、研发管理、项目管理、配置管理、人员与权限、组织架构、角色管理、批量导入、审计日志、常见问题。
- 业务规则和前端设计规范必须是独立页面，不显示功能手册的操作步骤、使用要点或完成后自查模板。
- 页面文案支持中文和英文；中文是主文案，英文作为对应翻译或编码辅助信息。
- 不改变任何业务 API、权限判断、数据模型和已有功能页面行为。
- 设计规范必须覆盖基础令牌、组件、交互状态、页面模式、响应式、可访问性、内容规范和版本治理。

---

### Task 1: Split navigation and routes

**Files:**
- Modify: `src/layout/Index.vue`
- Modify: `src/router/index.ts`
- Modify: `src/locales/zh-CN.ts`
- Modify: `src/locales/en-US.ts`
- Test: `src/views/manual/manual.test.mjs`

- [ ] **Step 1: Write the failing test**

Assert that `/manual` keeps only 11 functional entries, the router exposes `/manual/business-rules` and `/manual/design-system`, and the layout renders a dedicated documents group with three child links.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test src/views/manual/manual.test.mjs`
Expected: FAIL because the two reference entries are still part of the main `sections` array and the routes/nav links do not exist.

- [ ] **Step 3: Implement the navigation boundary**

Add route keys and menu targets, make route selection distinguish the three manual pages, and render a collapsible `文档`/`Documentation` nav group containing `使用手册`, `业务规则`, and `前端设计规范`. Keep `/manual#quick-start` as the default user-guide target.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --test src/views/manual/manual.test.mjs`
Expected: PASS for navigation and route assertions.

- [ ] **Step 5: Commit**

```bash
git add src/layout/Index.vue src/router/index.ts src/locales/zh-CN.ts src/locales/en-US.ts src/views/manual/manual.test.mjs
git commit -m "refactor: separate manual and reference navigation"
```

### Task 2: Build the standalone reference document shell

**Files:**
- Create: `src/views/manual/reference.ts`
- Create: `src/views/manual/ReferenceDocument.vue`
- Create: `src/views/manual/BusinessRules.vue`
- Create: `src/views/manual/DesignSystem.vue`
- Modify: `src/styles/fs-insight.css`
- Modify: `src/router/index.ts`
- Test: `src/views/manual/manual.test.mjs`

- [ ] **Step 1: Write the failing test**

Assert that the standalone pages use a reference-document component, render a local table of contents, expose section anchors, and do not render the feature-template labels `操作步骤`, `使用要点`, or `完成后自查`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test src/views/manual/manual.test.mjs`
Expected: FAIL because the reference page component and route-specific section model are missing.

- [ ] **Step 3: Implement the shared shell**

Define typed document metadata and section descriptors in `reference.ts`; render a sticky local TOC, reading progress/active section state, purpose callout, section summaries, rule lists, examples, related source links, and responsive single-column behavior in `ReferenceDocument.vue`. Use small route wrappers that pass `business-rules` or `design-system` to the shared component.

- [ ] **Step 4: Run typecheck and focused tests**

Run: `node --test src/views/manual/manual.test.mjs && pnpm typecheck`
Expected: PASS with both standalone documents type-safe and independently routable.

- [ ] **Step 5: Commit**

```bash
git add src/views/manual/reference.ts src/views/manual/ReferenceDocument.vue src/views/manual/BusinessRules.vue src/views/manual/DesignSystem.vue src/styles/fs-insight.css src/router/index.ts src/views/manual/manual.test.mjs
git commit -m "feat: add standalone reference document pages"
```

### Task 3: Expand reference content and synchronize documentation

**Files:**
- Modify: `src/locales/zh-CN.ts`
- Modify: `src/locales/en-US.ts`
- Modify: `docs/user-manual.md`
- Modify: `docs/design-logic.md`
- Modify: `docs/frontend-design-system.md`
- Modify: `src/views/manual/manual.test.mjs`

- [ ] **Step 1: Write the failing content assertions**

Assert that business rules cover identity, organization, authorization, project lifecycle, import consistency, audit/recovery, and failure handling; assert that the design system covers principles, token layers, typography, color/contrast, layout, components, states, responsive behavior, accessibility, content/i18n, and governance.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test src/views/manual/manual.test.mjs`
Expected: FAIL because the new section keys and detailed reference content are not present.

- [ ] **Step 3: Write the detailed content**

Add bilingual section data with durable rules and examples rather than operational checklists. Keep `docs/user-manual.md` limited to user-guide content plus links to the two independent references. Add official-source references to the design-system document and explain how PMS tokens map to component and page decisions.

- [ ] **Step 4: Run all frontend verification**

Run: `pnpm test && pnpm typecheck && pnpm build && git diff --check`
Expected: all tests pass, typecheck/build succeed, and no whitespace errors are reported.

- [ ] **Step 5: Review in the browser**

Open `/manual`, `/manual/business-rules`, and `/manual/design-system` at desktop and narrow widths. Confirm the user guide count is 11, each reference page has its own title and TOC, and no reference page contains the three feature-template labels.

- [ ] **Step 6: Commit**

```bash
git add src/locales/zh-CN.ts src/locales/en-US.ts docs/user-manual.md docs/design-logic.md docs/frontend-design-system.md src/views/manual/manual.test.mjs
git commit -m "docs: expand business rules and design system references"
```

## Self-review

- [ ] The user-guide route and the two reference routes have separate responsibilities.
- [ ] The UI and Markdown docs use the same concepts and terminology.
- [ ] The reference pages explain stable rules and design decisions, not a repeated how-to checklist.
- [ ] Existing project, administration, login, and permission behavior remains unchanged.
- [ ] Desktop, narrow-screen, test, typecheck, build, and whitespace checks are all covered.
