# 计划、资源与风险基线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在项目详情的“计划、资源与风险基线”节点中落地可保存、可确认、可重新打开的执行计划、资源责任和风险登记工作台，并把确认状态接入节点完成校验。

**Architecture:** 复用现有需求范围基线和方案设计工作台的模式，后端使用一个节点基线主表和三张明细表保存计划项、资源责任和风险登记，前端新增独立 Vue 工作台组件并通过节点 key `plan` 挂载。保存采用整组替换加主表乐观锁，确认后服务端锁定，节点完成由后端再次校验确认状态。

**Tech Stack:** Vue 3 + TypeScript + Ant Design Vue + Vite；Spring Boot 3 + MyBatis-Plus + Flyway + JUnit 5/Mockito。

**Spec:** `public/plan-resource-risk-baseline-demo.html`（已确认的视觉和交互原型）。

## Global Constraints

- 不复制任务看板；本节点只维护计划基线、关键责任和风险登记。
- 完成条件：至少一条计划项；所有资源责任行都有负责人；至少一条风险且有负责人和应对措施。
- 保存草稿不锁定；确认基线后锁定；重新打开后才能继续编辑。
- 所有读写必须按 projectId + nodeId 约束，并由服务端校验节点 key 为 `plan`。
- 不能只依赖前端按钮状态；节点完成接口必须再次执行基线确认校验。
- 延续现有设计系统、中文主文案、英文 locale 完整补齐、窄屏表格在容器内横向滚动。
- 本次不改变已上线的项目流程节点名称、甘特图、任务模型和方案设计工作台。

---

### Task 1: 先写后端契约与服务测试

**Files:**
- Create: `../pms-backend/src/test/java/com/brad/pms/service/NodePlanResourceRiskServiceTest.java`
- Modify: `../pms-backend/src/test/java/com/brad/pms/service/NodeServiceCompleteTest.java`

**Interfaces:**
- Test target: `NodePlanResourceRiskService.get/saveDraft/confirm/reopen/requireConfirmed`
- Test target: `NodeService.complete` when node key is `plan`

- [ ] **Step 1: Write failing tests** for rejecting non-plan nodes, trimmed draft persistence, incomplete confirmation, optimistic conflict, and completion guard.
- [ ] **Step 2: Run the focused Maven tests** and confirm failure is caused by missing plan baseline service/types.
- [ ] **Step 3: Add test fixtures** for plan items, resources, risks and the `plan` node, without weakening assertions.

### Task 2: 后端持久化模型与迁移

**Files:**
- Create: `src/main/resources/db/migration/V19__plan_resource_risk_baseline.sql`
- Create: `src/main/java/com/brad/pms/entity/ProjectNodePlanBaselineDO.java`
- Create: `src/main/java/com/brad/pms/entity/ProjectNodePlanItemDO.java`
- Create: `src/main/java/com/brad/pms/entity/ProjectNodeResourceDO.java`
- Create: `src/main/java/com/brad/pms/entity/ProjectNodeRiskDO.java`
- Create: `src/main/java/com/brad/pms/mapper/ProjectNodePlanBaselineMapper.java`
- Create: `src/main/java/com/brad/pms/mapper/ProjectNodePlanItemMapper.java`
- Create: `src/main/java/com/brad/pms/mapper/ProjectNodeResourceMapper.java`
- Create: `src/main/java/com/brad/pms/mapper/ProjectNodeRiskMapper.java`

**Interfaces:**
- Tables are keyed by `(project_id, node_id)`; child rows carry `sort`.
- Baseline status is `0=DRAFT, 1=CONFIRMED`; child statuses use explicit strings `PENDING/IN_PROGRESS/CONFIRMED`, `OPEN/MITIGATED`.

- [ ] **Step 1: Add the Flyway migration** with foreign-key-compatible IDs, unique baseline key, child indexes and update timestamps matching existing migrations.
- [ ] **Step 2: Add MyBatis-Plus entities** with fill fields and `@Version` on the baseline.
- [ ] **Step 3: Add base mappers** and rerun migration/schema tests.

### Task 3: 后端 DTO、服务和控制器

**Files:**
- Create: `src/main/java/com/brad/pms/dto/request/NodePlanItemCmd.java`
- Create: `src/main/java/com/brad/pms/dto/request/NodeResourceCmd.java`
- Create: `src/main/java/com/brad/pms/dto/request/NodeRiskCmd.java`
- Create: `src/main/java/com/brad/pms/dto/request/NodePlanResourceRiskUpdateCmd.java`
- Create: `src/main/java/com/brad/pms/dto/response/NodePlanItemDTO.java`
- Create: `src/main/java/com/brad/pms/dto/response/NodeResourceDTO.java`
- Create: `src/main/java/com/brad/pms/dto/response/NodeRiskDTO.java`
- Create: `src/main/java/com/brad/pms/dto/response/NodePlanResourceRiskDTO.java`
- Create: `src/main/java/com/brad/pms/service/NodePlanResourceRiskService.java`
- Create: `src/main/java/com/brad/pms/controller/NodePlanResourceRiskController.java`

**Interfaces:**
- REST: `GET/PUT/POST /projects/{projectId}/nodes/{nodeId}/plan-resource-risk`, plus `/confirm` and `/reopen`.
- Update payload includes `version`, `planItems`, `resources`, `risks`.
- Response includes `baselineStatus`, `version`, `confirmedBy/At`, `canEdit`, and owner display fields.
- Service exposes `requireConfirmed(projectId, nodeId)` for lifecycle completion.

- [ ] **Step 1: Implement validation** for node key, required plan title/date/deliverable, resource role/owner/focus, risk title/level/owner/response/status.
- [ ] **Step 2: Implement save draft** with confirmed-state rejection, version checking, child replacement and duplicate-create conflict mapping.
- [ ] **Step 3: Implement confirm/reopen** and owner-name/avatar mapping using project users.
- [ ] **Step 4: Add controller permission annotations** matching existing workbench endpoints.
- [ ] **Step 5: Run the focused service tests** and confirm all backend contract assertions pass.

### Task 4: 接入节点完成后端门禁与前端 API/types

**Files:**
- Modify: `src/main/java/com/brad/pms/service/NodeService.java`
- Modify: `src/test/java/com/brad/pms/service/NodeServiceCompleteTest.java`
- Modify: `src/types/domain.ts`
- Create: `src/api/node-plan-resource-risk.ts`

**Interfaces:**
- `NodeService.complete` calls `planResourceRiskService.requireConfirmed(projectId, nodeId)` when `nodeKey === "plan"`.
- Frontend API mirrors the REST contract and returns `NodePlanResourceRisk`.

- [ ] **Step 1: Add the plan service dependency and lifecycle guard**.
- [ ] **Step 2: Add the plan-specific domain types and update payload types**.
- [ ] **Step 3: Add typed API functions for get/save/confirm/reopen**.
- [ ] **Step 4: Run backend focused tests and frontend typecheck to expose integration errors.

### Task 5: 前端工作台组件

**Files:**
- Create: `src/views/project/detail/components/PlanResourceRiskWorkbench.vue`
- Create: `src/views/project/detail/plan-resource-risk.ts`
- Create: `src/views/project/detail/plan-resource-risk.test.mjs`

**Interfaces:**
- Props: `projectId`, `nodeId`, `nodeRoles`, `ownerOptions`, `nodeReadOnly`, `canEdit`.
- Emits: `baseline-status(number)`, `saved`.
- Functions: `isPlanResourceRiskComplete`, `splitRoleNames`, status/level option helpers.

- [ ] **Step 1: Write failing pure-function tests** for completion conditions and role parsing.
- [ ] **Step 2: Run the focused frontend tests and confirm the missing helper failure.
- [ ] **Step 3: Implement the helpers** and rerun the tests.
- [ ] **Step 4: Build the component** with upstream solution strip, compact plan table, resource table, risk table, checklist, draft/confirm/reopen actions, and add/remove row actions.
- [ ] **Step 5: Keep all controls disabled when node/project is read-only or baseline is confirmed.

### Task 6: 挂载组件、补齐 i18n 和节点状态

**Files:**
- Modify: `src/views/project/detail/index.vue`
- Modify: `src/locales/zh-CN.ts`
- Modify: `src/locales/en-US.ts`
- Modify: `src/views/project/detail/workflow.ts` only if a helper is required by the component.

**Interfaces:**
- Render `PlanResourceRiskWorkbench` only when `activeNode.nodeKey === "plan"`.
- Parent tracks `planBaselineStatus` and blocks completion with a localized message until status is confirmed.
- Owner options come from existing project members; node roles come from `activeNode.roles`.

- [ ] **Step 1: Add localized copy for the workbench, validation messages and lifecycle gate.
- [ ] **Step 2: Mount the component and reset/receive plan baseline status when active node changes.
- [ ] **Step 3: Add the plan completion gate beside existing requirement/design gates.
- [ ] **Step 4: Run frontend tests and typecheck.

### Task 7: 数据库、服务和视觉验证

**Files:**
- Modify only files from Tasks 1–6 as needed after review.
- Test: existing frontend and backend suites.

- [ ] **Step 1: Run backend focused tests and full test suite.
- [ ] **Step 2: Run frontend focused tests, full node tests, typecheck and production build.
- [ ] **Step 3: Start/load the local frontend, open the project detail and inspect the plan node at desktop and mobile widths.
- [ ] **Step 4: Verify core path: load → add/edit plan/resource/risk → save draft → confirm → fields lock → reopen → complete-node attempt is gated until confirmation.
- [ ] **Step 5: Review the diff for unintended changes, stale demo-only code, accessibility labels, localized copy and responsive table overflow.
