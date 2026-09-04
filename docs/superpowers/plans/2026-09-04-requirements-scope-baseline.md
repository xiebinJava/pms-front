# 需求澄清与范围基线实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将已确认的“需求澄清与范围基线”Demo 落到真实项目详情页，并让节点目标、交付结果、范围项、需求清单和基线确认状态可持久化。

**Architecture:** 在现有项目节点模型之外增加一组按 `projectId + nodeId` 归属的基线数据：一条基线主记录、范围项列表和需求清单。后端提供读取、保存草稿、确认基线、重新打开四个受权限保护的接口；前端新增 `RequirementScopeWorkbench.vue`，只在 `nodeKey=requirement` 时替换通用节点说明区域，任务看板、项目流程和其他节点保持现状。

**Tech Stack:** Vue 3 `<script setup>`、TypeScript、Ant Design Vue、Vue I18n、Spring Boot 3.5、MyBatis-Plus、Flyway、JUnit 5、Node test。

**Spec:** `public/requirements-scope-baseline-demo.html` 与用户确认的节点流程全景图/立项节点详情截图。

## Global Constraints

- 只对 `nodeKey=requirement` 展示专属基线工作台，不能影响 kickoff 或其他节点。
- 不再重复录入上一节点已经完成的“业务问题与背景”和“参与角色”。
- 需求清单用于明确做什么、优先级、验收标准和确认状态；任务看板仍用于跟踪执行动作。
- 所有读写接口必须先校验项目可读、节点属于项目，写入还必须满足节点可编辑且项目未终止/删除。
- 节点确认前允许保存草稿；确认要求节点目标、节点交付结果、至少一条纳入范围项、至少一条需求且所有需求为已确认。
- 节点完成前必须确认范围基线；重新打开后允许继续编辑，但不自动删除历史内容。
- 需求类型使用 `BUSINESS`、`FUNCTIONAL`、`CONSTRAINT`；需求优先级使用现有 1/2/3 数值语义；需求状态使用 0 待评审、1 已确认。
- 不把可编辑业务数据写入前端 localStorage；页面刷新后从后端重新读取。

### Task 1: Add the persisted node baseline model and protected API

**Files:**
- Create: `/Users/fs/Desktop/Project/pms-backend/src/main/resources/db/migration/V17__requirement_scope_baseline.sql`
- Create: `/Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/entity/ProjectNodeBaselineDO.java`
- Create: `/Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/entity/ProjectNodeScopeItemDO.java`
- Create: `/Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/entity/ProjectNodeRequirementDO.java`
- Create: `/Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/mapper/ProjectNodeBaselineMapper.java`
- Create: `/Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/mapper/ProjectNodeScopeItemMapper.java`
- Create: `/Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/mapper/ProjectNodeRequirementMapper.java`
- Create: `/Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/dto/request/NodeScopeItemCmd.java`
- Create: `/Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/dto/request/NodeRequirementCmd.java`
- Create: `/Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/dto/request/NodeRequirementScopeUpdateCmd.java`
- Create: `/Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/dto/response/NodeScopeItemDTO.java`
- Create: `/Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/dto/response/NodeRequirementDTO.java`
- Create: `/Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/dto/response/NodeRequirementScopeDTO.java`
- Create: `/Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/controller/NodeRequirementScopeController.java`
- Create: `/Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/service/NodeRequirementScopeService.java`
- Create: `/Users/fs/Desktop/Project/pms-backend/src/test/java/com/brad/pms/service/NodeRequirementScopeServiceTest.java`
- Modify: `/Users/fs/Desktop/Project/pms-backend/src/main/java/com/brad/pms/service/NodeService.java`
- Create: `/Users/fs/Desktop/Project/pms-backend/src/test/java/com/brad/pms/controller/NodeRequirementScopePermissionTest.java`

**Interfaces:**
- `GET /projects/{projectId}/nodes/{nodeId}/requirements-scope` returns `{ objective, deliverable, baselineStatus, confirmedAt, confirmedByName, scopeItems, requirements, canEdit }`.
- `PUT /projects/{projectId}/nodes/{nodeId}/requirements-scope` accepts `{ objective, deliverable, scopeItems: [{id?, direction, title, sort}], requirements: [{id?, code, name, description, type, priority, acceptanceCriteria, status, sort}] }` and returns the same DTO with generated ids.
- `POST /projects/{projectId}/nodes/{nodeId}/requirements-scope/confirm` returns the confirmed DTO and rejects incomplete content.
- `POST /projects/{projectId}/nodes/{nodeId}/requirements-scope/reopen` returns the draft DTO and clears confirmation metadata without deleting content.
- `NodeService.complete(projectId, nodeId)` rejects the `requirement` node unless its baseline status is confirmed.

- [ ] **Step 1: Write the migration and service tests first.**

  Add tables with explicit constraints and indexes:

  ```sql
  CREATE TABLE project_node_baseline (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      project_id BIGINT NOT NULL,
      node_id BIGINT NOT NULL,
      objective VARCHAR(2000),
      deliverable VARCHAR(2000),
      status TINYINT NOT NULL DEFAULT 0 COMMENT '0草稿 1已确认',
      confirmed_by BIGINT,
      confirmed_at TIMESTAMP NULL,
      version INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_node_baseline_project_node (project_id, node_id),
      INDEX idx_node_baseline_node (node_id)
  );
  ```

  Add equivalent `project_node_scope_item` and `project_node_requirement` tables with `project_id`, `node_id`, `sort`, timestamps, and indexes. Scope direction is `VARCHAR(8) NOT NULL`; requirement `code`, `name`, `type`, `priority`, `status`, and `acceptance_criteria` are required; descriptions remain optional. Add tests proving: an incomplete confirm throws `BusinessException`, a complete confirm sets status and metadata, reopen keeps children, and completing a requirement node without confirmation is rejected.

- [ ] **Step 2: Run the focused backend tests and confirm the new tests fail for missing behavior.**

  Run from `/Users/fs/Desktop/Project/pms-backend`:

  ```bash
  ./mvnw -q -Dtest=NodeRequirementScopeServiceTest,NodeRequirementScopePermissionTest,NodeServiceCompleteTest test
  ```

  Expected result before implementation: compilation/test failure because the new service, DTOs, mappers, and controller do not exist yet.

- [ ] **Step 3: Implement entities, request/response DTOs, mappers, and service.**

  Use the existing MyBatis-Plus patterns (`@TableName`, `@TableId(type = IdType.AUTO)`, `@Version`, insert/update timestamp fills) and make the service call `requireProjectReadable` for reads and `requireManageableNode` for all writes. `saveDraft` must validate the node key, direction/type/status values, nonblank names, and `start <= end` is not relevant to this feature. Replace the child rows transactionally only after the request passes validation. Generate missing requirement codes as the next `REQ-%03d` sequence while preserving submitted codes, and return rows ordered by `sort, id`.

- [ ] **Step 4: Implement the controller and lifecycle guard.**

  Annotate GET and all action methods with `@RequirePermission(PermissionCode.PROJECT_READ)` to match node lifecycle access, while the service enforces the stronger manageability check for writes. Add `validateRequirementBaseline` in `NodeService` and call it from `complete` only for `nodeKey=requirement`. Leave kickoff validation and all other node rules unchanged.

- [ ] **Step 5: Run focused backend tests and the full backend test suite.**

  ```bash
  ./mvnw -q -Dtest=NodeRequirementScopeServiceTest,NodeRequirementScopePermissionTest,NodeServiceCompleteTest test
  ./mvnw -q test
  ```

  Expected result: focused tests and the complete suite pass; no migration checksum or application-context errors.

### Task 2: Implement the real Vue workbench and API client

**Files:**
- Create: `/Users/fs/Desktop/Project/pms-front/src/api/node-requirement-scope.ts`
- Create: `/Users/fs/Desktop/Project/pms-front/src/views/project/detail/components/RequirementScopeWorkbench.vue`
- Create: `/Users/fs/Desktop/Project/pms-front/src/views/project/detail/requirement-scope.ts`
- Create: `/Users/fs/Desktop/Project/pms-front/src/views/project/detail/requirement-scope.test.mjs`
- Modify: `/Users/fs/Desktop/Project/pms-front/src/types/domain.ts`
- Modify: `/Users/fs/Desktop/Project/pms-front/src/views/project/detail/index.vue`
- Modify: `/Users/fs/Desktop/Project/pms-front/src/locales/zh-CN.ts`
- Modify: `/Users/fs/Desktop/Project/pms-front/src/locales/en-US.ts`
- Modify: `/Users/fs/Desktop/Project/pms-front/src/styles/fs-insight.css`

**Interfaces:**
- `src/api/node-requirement-scope.ts` exports `getNodeRequirementScope`, `saveNodeRequirementScope`, `confirmNodeRequirementScope`, and `reopenNodeRequirementScope` with typed payloads.
- `RequirementScopeWorkbench` accepts `projectId`, `nodeId`, `nodeReadOnly`, `canEdit`, and emits `baseline-status` and `saved` after successful server writes.
- `requirement-scope.ts` exports pure helpers for `nextRequirementCode`, `isRequirementBaselineComplete`, `requirementTypeLabel`, `requirementStatusLabel`, and `scopeItemCount` so validation and code generation are testable without mounting Vue.

- [ ] **Step 1: Write failing frontend tests for the pure rules and source integration.**

  Add tests such as:

  ```js
  test('requires objective, deliverable, in-scope item and confirmed requirements', () => {
    assert.equal(isRequirementBaselineComplete({ objective: '', deliverable: '验收基线', scopeItems: [], requirements: [] }), false)
    assert.equal(isRequirementBaselineComplete({ objective: '明确范围', deliverable: '验收基线', scopeItems: [{ direction: 'IN', title: '订单流程' }], requirements: [{ status: 1, name: '订单流转', acceptanceCriteria: '状态可追踪' }] }), true)
  })
  ```

  Also assert that `index.vue` imports and renders `RequirementScopeWorkbench`, gates it with `activeNode.nodeKey === 'requirement'`, and still renders `TaskKanban` for every active node.

- [ ] **Step 2: Run the new frontend test file and confirm it fails.**

  ```bash
  cd /Users/fs/Desktop/Project/pms-front
  node --test src/views/project/detail/requirement-scope.test.mjs
  ```

  Expected result before implementation: failure because `requirement-scope.ts` and the new component/API integration do not exist.

- [ ] **Step 3: Add the typed frontend model and API client.**

  Add `NodeScopeItem`, `NodeRequirement`, `NodeRequirementScope`, and `NodeRequirementScopeUpdate` to `src/types/domain.ts`. Map the four endpoints through the existing `http` wrapper and do not introduce a second HTTP client or browser storage.

- [ ] **Step 4: Build the workbench from the accepted Demo.**

  Recreate the accepted section order with code-native Ant Design Vue controls: node objective/output, scope in/out cards, requirements table, checklist/confirmation footer. Remove the two fields explicitly rejected by the user; do not add “业务问题与背景” or “参与角色”. Keep copy i18n-backed in both Chinese and English. Use disabled controls for read-only/completed/terminated nodes, show save/confirm/reopen states, and surface server errors without losing the loaded form.

- [ ] **Step 5: Integrate the component into the node detail page.**

  Load the workbench lazily only for the requirement node, keep its state keyed by `nodeId`, and place it before the existing task board. On `baseline-status=confirmed`, allow the existing “完成节点” action to proceed; on reopen, require the user to reconfirm before completion. Do not change flow navigation or generic assignment/date controls.

- [ ] **Step 6: Run the focused frontend tests, typecheck, and build.**

  ```bash
  node --test src/views/project/detail/requirement-scope.test.mjs src/views/project/detail/workflow.test.mjs
  pnpm typecheck
  pnpm build
  ```

  Expected result: all focused tests pass, typecheck is clean, and Vite produces a build without warnings caused by this feature.

### Task 3: Validate the vertical slice in the running application

**Files:**
- Create outside repository: `/tmp/pms-requirement-scope-qa.mjs`
- Screenshots outside repository: `/tmp/pms-requirement-scope-desktop.png`, `/tmp/pms-requirement-scope-mobile.png`

**Interfaces:**
- Browser flow: `/projects/2` -> select “需求澄清与范围基线” -> load workbench -> edit/add scope and requirement -> save draft -> confirm baseline -> verify locked state -> reopen.

- [ ] **Step 1: Start or reuse the local frontend/backend and verify the test account can read project 2.**

  Keep the existing local host/ports (`5173` frontend and `8080` backend) and use the current authenticated browser session where available.

- [ ] **Step 2: Run the desktop interaction loop with Playwright fallback if Browser/CUA is unavailable.**

  Assert page identity and meaningful content, select the requirement node, wait for the API-backed workbench, edit one draft field, add one scope item and one requirement, save, confirm, and reopen. Capture console errors and a screenshot after confirmation.

- [ ] **Step 3: Run the mobile viewport check.**

  Use a `390x844` viewport; assert `scrollWidth === clientWidth`, no framework overlay, and that scope cards/table remain usable without clipped primary controls.

- [ ] **Step 4: Run the full frontend regression suite and inspect the diff.**

  ```bash
  pnpm test
  git diff --check
  git status --short
  ```

- [ ] **Step 5: Record remaining intentional limitation.**

  The first slice supports one-level scope/requirement editing and server persistence. It does not add approval comments, history/version diff, or cross-node traceability UI; those remain future additions unless the user requests them.
