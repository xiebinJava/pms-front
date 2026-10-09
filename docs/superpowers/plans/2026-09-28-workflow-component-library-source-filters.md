# Workflow Component Library Source Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将流程模板配置页左侧组件库统一为“公共字段 / 绑定字段 / 业务工作台”三段，并用两个独立下拉筛选绑定字段和业务工作台，同时保证画布已有内容稳定不变。

**Architecture:** 以现有字段绑定 schema 和业务工作台 registry 作为唯一元数据来源。公共字段直接渲染；绑定字段通过 `BoundFieldSource` 分组后计算候选项；工作台通过 `WorkflowWorkbenchType` 元数据计算候选项。筛选状态只参与候选列表 computed，不写入流程定义，因此不会影响节点画布中已经保存的字段和组件。

**Tech Stack:** Vue 3、TypeScript、Ant Design Vue、Vue I18n、Node.js built-in test runner、现有 Spring Boot 工作流模板校验与运行时绑定逻辑。

**Spec:** `docs/superpowers/specs/2026-09-28-workflow-component-library.md`

## Global Constraints

- 公共字段直接展示，不提供筛选。
- 绑定字段筛选选项必须为：项目字段、需求字段、专题字段、故事字段、全部字段。
- 业务工作台筛选选项必须为：需求工作台、项目工作台、专题工作台、故事工作台、全部工作台。
- “专题字段”和“专题工作台”必须保持独立的元数据来源、筛选分组和运行时键。
- 筛选只改变左侧候选列表，已经添加到节点画布里的内容不会被删除或改变。
- 当前流程类型过滤必须继续生效，并且优先于来源筛选。
- 已有草稿和已发布模板的字段绑定键、字段顺序、组件顺序和配置必须兼容。

## Review Focus

- 切换筛选后再切回，已添加字段和工作台仍在画布中且顺序不变；由 Task 2 的画布稳定性测试覆盖。
- “全部字段”不能把公共字段混入候选列表；由 Task 2 的候选列表测试覆盖。
- 专题字段中的“关联项目”必须展示为专题数据绑定字段，并以关联项目名称呈现，而不是专题工作台组件；由 Task 1 的 schema/registry 分离测试和 Task 4 的运行时校验覆盖。
- 当前流程类型与来源筛选叠加时不能出现不适用的工作台；由 Task 2 的组合过滤测试覆盖。
- 中英文筛选标签、空状态和可访问名称必须一致；由 Task 3 的 locale/DOM 断言和 Task 5 的浏览器冒烟验证覆盖。

### Task 1: 固化三类组件和四类绑定来源的元数据

**Files:**
- Modify: `src/views/admin/workflows/workflow-template-schema.mjs`
- Modify: `src/views/admin/workflows/workflow-template-schema.d.mts`
- Modify: `src/types/workflow.ts`
- Modify: `src/components/workflow/workflow-component-registry.ts`
- Test: `src/views/admin/workflows/workflow-template-schema.test.mjs`
- Test: `src/views/admin/workflows/workflow-admin-visual.test.mjs`

**Interfaces:**
- Produces `PROJECT_FIELD_BINDINGS`, `REQUIREMENT_FIELD_BINDINGS`, `TOPIC_FIELD_BINDINGS`, `STORY_FIELD_BINDINGS` as the four binding source maps.
- Produces `WorkflowWorkbenchType = 'requirement' | 'project' | 'topic' | 'story'` and `workbenchTypes` on every runtime component definition.
- Produces the topic association binding `topic.project` as a read-only text binding if it is not already present.

- [ ] **Step 1: Write failing metadata tests**

  Assert that topic bindings include title, owner, project, status, progress and the existing topic delivery/build fields; assert that every workbench registry item has at least one valid workbench type; assert that `topic.*` bindings and workbench component keys are distinct; assert that the story-split component is available to the topic workbench category.

- [ ] **Step 2: Run the targeted tests and verify they fail for missing or incorrect metadata**

  Run `node --test src/views/admin/workflows/workflow-template-schema.test.mjs src/views/admin/workflows/workflow-admin-visual.test.mjs`.

- [ ] **Step 3: Implement the canonical metadata**

  Add or normalize `topic.project` as a `TEXT` binding for the associated project name and add its localized label. Keep public field controls outside these maps, keep workbench source metadata on the registry rather than duplicating source logic in the page, and retain `story-split` as a topic-workbench candidate. Treat existing acceptance, release, review, and knowledge workbenches as shared components classified by `workbenchTypes`; do not add a duplicate “topic delivery” runtime key.

- [ ] **Step 4: Run the targeted tests and verify they pass**

  Expected: all schema and registry assertions pass, with no change to existing template normalization behavior.

### Task 2: Implement independent candidate filtering

**Files:**
- Modify: `src/views/admin/workflows/index.vue`
- Test: `src/views/admin/workflows/workflow-admin-visual.test.mjs`

**Interfaces:**
- Consumes the four binding maps and `WORKFLOW_RUNTIME_COMPONENTS` from Task 1.
- Produces `fieldSourceFilter`, `workbenchSourceFilter`, `availableBoundFields`, and `availableComponents` as the only sources for the two filtered candidate lists.

- [ ] **Step 1: Write failing filtering tests**

  Assert that public field types are rendered without a source select; binding source options appear in the exact order `project`, `requirement`, `topic`, `story`, `all`; workbench source options appear in the exact order `requirement`, `project`, `topic`, `story`, `all`; `all` for bindings excludes public controls; and filtering does not alter `definition.nodes[*].fields` or `contentOrder`.

- [ ] **Step 2: Run the targeted test file and verify the new assertions fail**

  Run `node --test src/views/admin/workflows/workflow-admin-visual.test.mjs`.

- [ ] **Step 3: Refactor the palette to the final three-section layout**

  Keep the public controls in an unfiltered section, rename the second section heading to `绑定字段`, attach only the binding-source select to that section, and attach only the workbench-source select to `业务工作台`. Remove obsolete parallel binding lists and the legacy `story-split` exclusion so there is one candidate computation per filtered section and the topic workbench exposes story splitting.

- [ ] **Step 4: Preserve configuration while filtering**

  Make filter changes update refs only. `addBoundField`, `toggleComponent`, and all canvas reorder/remove operations must continue to operate on the existing workflow definition; no watcher may prune items that are temporarily absent from a filtered list.

- [ ] **Step 5: Run the targeted test file and verify it passes**

  Expected: source-specific lists, all-source lists, process-type constraints, and canvas preservation all pass.

### Task 3: Align labels, empty states, and accessibility

**Files:**
- Modify: `src/locales/zh-CN.ts`
- Modify: `src/locales/en-US.ts`
- Modify: `src/views/admin/workflows/index.vue`
- Test: `src/views/admin/workflows/workflow-admin-visual.test.mjs`

**Interfaces:**
- Produces stable locale keys for `bindingFields`, `fieldSource*`, `workbenchSource*`, category-specific labels, and empty states.
- Produces accessible labels for both dropdowns and test IDs for the four workbench choices and the unified binding section.

- [ ] **Step 1: Add failing locale and DOM assertions**

  Assert that the UI uses “绑定字段” / “Binding fields” as the section title, that topic field labels and topic workbench labels are separate, and that empty states identify the currently filtered category without implying that the canvas was cleared.

- [ ] **Step 2: Run the visual tests and verify the assertions fail before the rename/layout update**

  Run `node --test src/views/admin/workflows/workflow-admin-visual.test.mjs`.

- [ ] **Step 3: Update Chinese and English copy and accessibility hooks**

  Use one locale key for the binding section title, separate locale keys for field/workbench filters, and preserve existing field source tags on canvas cards. Do not use the old “绑定已有数据” section title for this final design; “绑定已有数据” may remain only where it describes the action or semantics rather than the category name.

- [ ] **Step 4: Run the visual tests and verify they pass**

  Expected: all locale and DOM assertions pass in both locale branches covered by the existing tests.

### Task 4: Verify runtime binding compatibility for topic and story data

**Files:**
- Modify if needed: `pms-backend/src/main/java/com/brad/pms/workflow/WorkflowTemplateDefinitionValidator.java`
- Modify if needed: `pms-backend/src/main/java/com/brad/pms/service/DevelopmentItemWorkflowService.java`
- Modify if needed: `pms-backend/src/test/java/com/brad/pms/workflow/WorkflowTemplateDefinitionValidatorTest.java`
- Modify if needed: `pms-backend/src/test/java/com/brad/pms/service/DevelopmentItemWorkflowServiceFieldTest.java`

**Interfaces:**
- Consumes the binding keys defined in Task 1.
- Produces validator and runtime value support for each binding that can be displayed in topic/story workflow details.

- [ ] **Step 1: Add failing backend tests for topic.project and existing topic/story bindings**

  Assert that `topic.project` is accepted as `TEXT`, that a topic detail resolves its associated project name, that existing topic/story bindings remain accepted, and that unrelated entity bindings remain rejected.

- [ ] **Step 2: Run the focused backend tests and verify failures identify missing support**

  Run `mvn -q -Dtest=WorkflowTemplateDefinitionValidatorTest,DevelopmentItemWorkflowServiceFieldTest test`.

- [ ] **Step 3: Implement only the missing validator/value mappings**

  Add the `topic.project` validator entry and return `context.project().getName()` for the binding when a project exists. Reuse existing project/topic/story mappers and DTO conversion patterns. Bound fields remain read-only projections; this task must not introduce a second persistence model or allow palette filters to change entity relationships.

- [ ] **Step 4: Run the focused backend tests and verify they pass**

  Expected: validator and runtime field tests pass. If the full suite requires Docker/Testcontainers, record that environmental limitation separately instead of weakening these tests.

### Task 5: End-to-end verification and regression review

**Files:**
- Test: `src/views/admin/workflows/workflow-admin-visual.test.mjs`
- Test: `src/views/admin/workflows/workflow-template-schema.test.mjs`
- Test: existing frontend and backend test suites

- [ ] **Step 1: Run the complete frontend test suite**

  Run `pnpm test` in the frontend repo; expected: zero failures.

- [ ] **Step 2: Build the frontend**

  Run `pnpm build`; expected: TypeScript/Vite build succeeds with no duplicate locale keys.

- [ ] **Step 3: Run focused backend tests and inspect diff hygiene**

  Run `mvn -q -Dtest=WorkflowTemplateDefinitionValidatorTest,DevelopmentItemWorkflowServiceFieldTest test` and `git diff --check` in both repositories.

- [ ] **Step 4: Perform browser smoke verification**

  Open the workflow template page and verify:
  1. public fields are visible without a filter;
  2. binding filter switches among the four sources and all fields;
  3. workbench filter switches among the four workbench categories and all workbenches;
  4. topic fields show topic data fields including associated project, while topic workbench shows topic business components including story splitting;
  5. adding an item, switching filters, and returning to the node leaves the canvas content and order unchanged.

- [ ] **Step 5: Review the final diff before integration**

  Confirm there are no old duplicate palette sections, no filter watcher that mutates the definition, and no locale key collision. Commit only after the user approves the plan and implementation result.
