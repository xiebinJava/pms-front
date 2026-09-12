# 可配置流程节点字段实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将流程节点详情改为可视化、可拖动的独立字段配置，并保留项目字段绑定、既有业务工作台和旧版项目兼容。

**Architecture:** 前端将 v1 模板适配为 v2；v2 用 `fields` 保存原生绑定字段和节点自定义字段，以 `contentOrder` 排列字段区和现有业务组件。后端按绑定类型路由项目资料保存与节点字段保存，保持模板版本快照和数据库结构不变。

**Tech Stack:** Vue 3、TypeScript、Ant Design Vue、Vite、Vue Test Runner（Node `node:test`）；Java 17、Spring Boot、Jackson、JUnit 5、Mockito、Maven。

**Spec:** `docs/superpowers/specs/2026-09-12-configurable-workflow-fields-design.md`（位于 pms-front 仓库；适用于 pms-front 和 pms-backend）。

## Global Constraints

- 只支持顺序流程，不加入条件分支或并行节点。
- `owner`、`schedule`、`task-board` 固定，不能删除或更改配置。
- 项目原生字段必须继续写现有项目/成员数据；不得复制到节点字段 JSON。
- 已发布模板定义和项目的 `workflowTemplateVersionId` 不得原地改写。
- 保留全部当前可选业务工作台；未绑定字段值和附件继续使用现有节点字段 API。

---

## 文件分工

- `pms-front/src/types/workflow.ts`：前端 schema v2、字段控件和 binding 类型。
- `pms-front/src/views/admin/workflows/workflow-template-schema.mjs`：v1→v2 纯函数适配与默认绑定元数据。
- `pms-front/src/views/admin/workflows/workflow-template-model.mjs`：新增/删除/排序字段与内容项的纯函数。
- `pms-front/src/views/admin/workflows/index.vue`：可视化模板画布、组件库、字段属性面板和预览。
- `pms-front/src/views/project/detail/components/WorkflowCustomFields.vue`：统一字段区、未绑定字段持久化、全部通用控件。
- `pms-front/src/views/project/detail/index.vue`：绑定字段渲染/项目保存、固定模块与可配置工作台排序、完成校验。
- `pms-front/src/views/project/detail/workflow-config.mjs`：项目绑定字段兼容读取、旧版 ProjectNode→统一字段视图适配、空值/必填判断。
- `pms-front/src/types/domain.ts`：运行时节点携带 `contentOrder` 和 v2 字段。
- `pms-backend/src/main/java/com/brad/pms/workflow/*`：schema、控件类型及模板定义/值校验。
- `pms-backend/src/main/java/com/brad/pms/service/WorkflowTemplateService.java`：保留 v1/v2 版本定义的读写语义。
- `pms-backend/src/main/java/com/brad/pms/service/NodeCustomFieldService.java`：只允许未绑定字段写入节点字段表，扩展多选控件值校验。
- `pms-backend/src/main/java/com/brad/pms/service/NodeService.java`、`dto/response/ProjectNodeDTO.java`：项目绑定字段的完成校验和运行时顺序元数据。
- 前后端各自的 `*.test.mjs` / `src/test/java/com/brad/pms/workflow/*Test.java` 与相关 service tests：覆盖适配、验证、持久化和兼容。

## Task 1: 前端 schema v2 与兼容适配

**Files:**
- Modify: `pms-front/src/types/workflow.ts`
- Create: `pms-front/src/views/admin/workflows/workflow-template-schema.mjs`
- Create: `pms-front/src/views/admin/workflows/workflow-template-schema.test.mjs`
- Modify: `pms-front/src/views/admin/workflows/workflow-template-model.mjs`
- Modify: `pms-front/src/views/admin/workflows/workflow-template-model.d.mts`
- Modify: `pms-front/src/views/admin/workflows/workflow-template-model.test.mjs`

- [ ] 写 v1 适配测试：八个旧项目资料字段转换成带稳定 binding 的字段；自定义字段 key、值类型、required、options 保留；`project-basic-info` 转为 `fields` 内容项；所有其他工作台保留原顺序；重复适配 v2 结果不变。
- [ ] 直接运行 `node src/views/admin/workflows/workflow-template-schema.test.mjs`，确认新测试先失败（此沙箱下 `node --test` 会因 worker 子进程 `EPERM` 无法启动）。
- [ ] 定义 v2 的字段类型 `RADIO`、`PERSON_MULTI`、`DATE_RANGE`、可见性、binding 和 `contentOrder`；为旧工作台组件生成 `component:<key>` 内容项。
- [ ] 新建 `normalizeWorkflowDefinition(definition)` 纯函数，只转换 v1；v2 输入返回不变语义的深克隆，且不修改传入对象。
- [ ] 添加字段/内容项唯一 key 生成和移动纯函数；新增字段时自动创建一个 `fields` 内容项，删除最后一个字段时移除该项。
- [ ] 更新 `.d.mts` 声明和旧模型测试，分别直接运行两个测试文件，确认通过。

**Interfaces:**
- `normalizeWorkflowDefinition(definition) -> WorkflowTemplateDefinitionV2`
- `WorkflowFieldDefinition = { key, label, type, required, options, visible?, binding? }`
- `WorkflowNodeDefinitionV2.contentOrder: string[]`，值为 `fields` 或 `component:<component-key>`；新定义 `schemaVersion` 为 `2`。

## Task 2: 后端 schema 与字段值安全校验

**Files:**
- Modify: `pms-backend/src/main/java/com/brad/pms/workflow/WorkflowFieldType.java`
- Modify: `pms-backend/src/main/java/com/brad/pms/workflow/WorkflowFieldDefinition.java`
- Modify: `pms-backend/src/main/java/com/brad/pms/workflow/WorkflowNodeDefinition.java`
- Modify: `pms-backend/src/main/java/com/brad/pms/workflow/WorkflowTemplateDefinitionValidator.java`
- Modify: `pms-backend/src/main/java/com/brad/pms/workflow/WorkflowFieldValueValidator.java`
- Modify: `pms-backend/src/test/java/com/brad/pms/workflow/WorkflowTemplateDefinitionValidatorTest.java`
- Modify: `pms-backend/src/test/java/com/brad/pms/workflow/WorkflowFieldValueValidatorTest.java`

- [ ] 先测试 v1 仍可验证、v2 接受全部 Demo 控件、合法 binding/type、contentOrder 完整，且拒绝重复/未知 order、未知 binding、隐藏必填项、字段类型与 binding 不匹配、错误选项配置。
- [ ] 先测试 RADIO 只能接收已配置字符串，PERSON_MULTI 为唯一正整数数组，DATE_RANGE 为两个合法 ISO 日期且开始时间不晚于结束时间；隐藏字段不列入必填缺失项。
- [ ] 运行 `mvn -Dtest=WorkflowTemplateDefinitionValidatorTest,WorkflowFieldValueValidatorTest test` 确认新测试失败。
- [ ] 扩展 record 并保留旧构造器，保障 Java 现有调用不变；对 v1 缺失 `visible` 解释为可见。
- [ ] validator 按 schema 版本选择规则：v1 保留现有 `projectBasicInfo` 校验；v2 校验 binding 白名单、控件匹配、唯一字段 key、单个 `fields` 项、全部组件项恰好引用一次，禁止 `project-basic-info` 组件。
- [ ] 扩展值验证和 required 计算，错误消息继续用中文业务提示。
- [ ] 重跑上述测试和 `mvn -Dtest='com.brad.pms.workflow.*Test' test`，确认通过。

**Interfaces:**
- `WorkflowFieldDefinition` 新字段：`Boolean visible`（null 表示兼容默认可见）、`String binding`。
- `WorkflowNodeDefinition` 新字段：`List<String> contentOrder`；旧 9 参数构造器继续可用。
- v1 未绑定字段仍允许原保存逻辑；v2 中绑定字段不进入自定义字段值校验。

## Task 3: 后端运行时绑定与字段保存

**Files:**
- Modify: `pms-backend/src/main/java/com/brad/pms/service/NodeCustomFieldService.java`
- Modify: `pms-backend/src/main/java/com/brad/pms/service/NodeService.java`
- Modify: `pms-backend/src/main/java/com/brad/pms/dto/response/ProjectNodeDTO.java`
- Modify: `pms-backend/src/test/java/com/brad/pms/service/NodeCustomFieldServiceTest.java`
- Modify: `pms-backend/src/test/java/com/brad/pms/service/NodeServiceCompleteTest.java`

- [ ] 为节点字段保存写测试：绑定字段提交时拒绝并不写入 `pms_project_node_field_value`；未绑定字段照常保存；PERSON_MULTI 中任一非项目成员均拒绝。
- [ ] 为完成节点写测试：v1 项目字段校验仍有效；v2 绑定字段按 canonical 项目资料值校验；隐藏字段不阻止完成；缺失的可见必填项目字段阻止完成。
- [ ] 运行 `mvn -Dtest=NodeCustomFieldServiceTest,NodeServiceCompleteTest test` 确认失败。
- [ ] `NodeCustomFieldService` 在 save、读取 required 字段、人员权限检查和附件入口处统一过滤 binding 字段；多人员逐个检查成员权限。
- [ ] `NodeService` 对 v2 `project.*` binding 做项目字段完成校验；v1 继续走旧 `projectBasicInfoFields` 路径；节点 DTO 增加 `contentOrder`。
- [ ] 运行两个 service 测试及 `mvn test`，确认没有项目创建、完成节点或权限回归。

## Task 4: 管理端可视化字段/内容编辑器

**Files:**
- Modify: `pms-front/src/views/admin/workflows/index.vue`
- Modify: `pms-front/src/views/admin/workflows/workflow-template-model.mjs`
- Modify: `pms-front/src/views/admin/workflows/workflow-admin-visual.test.mjs`
- Modify: `pms-front/src/locales/zh-CN.ts` 与 `pms-front/src/locales/en-US.ts`（按仓库实际 locale 文件结构定位）

- [ ] 写模型/源码测试：加载 v1 时展示八个独立项目字段；新增、改名、换类型、改选项、必填/隐藏、删除、拖动字段与业务工作台会更新正确 schema；固定块不出现在删除操作中。
- [ ] 编辑器 `selectTemplate` 和 `newTemplate` 的定义统一经过 `normalizeWorkflowDefinition`；模板保存发送 schema v2。
- [ ] 在节点属性区实现 Demo 式组件库、可拖放字段卡片和属性检查器；绑定字段仅编辑显示名/可见/必填，其控件类型由 binding 决定；自由字段可改类型及 options；key 只读。
- [ ] 实现 `contentOrder` 的拖动排序，旧工作台卡片与字段区可相对排序；保留既有节点顺序拖放、添加/删除节点、模板预览、发布和默认操作。
- [ ] 预览按实际字段控件类型显示；翻译控件名称、固定模块和 aria 文案，不硬编码新增面向用户文案。
- [ ] 运行 `node --test` 对应 admin workflow 测试、`pnpm typecheck`，修复通过。

## Task 5: 项目详情统一字段渲染

**Files:**
- Modify: `pms-front/src/types/workflow.ts`
- Modify: `pms-front/src/types/domain.ts`
- Modify: `pms-front/src/views/project/detail/components/WorkflowCustomFields.vue`
- Modify: `pms-front/src/views/project/detail/index.vue`
- Modify: `pms-front/src/views/project/detail/workflow-config.mjs`
- Modify: `pms-front/src/views/project/detail/workflow-config.test.mjs`
- Modify: `pms-front/src/views/project/detail/workflow.test.mjs`

- [ ] 写测试覆盖每个新增控件的空值、渲染分支和字段排序；覆盖 canonical binding key 解析、必填判断、隐藏字段不校验；覆盖旧 v1 节点 profile fallback。
- [ ] 先运行相关 `node --test` 文件确认失败。
- [ ] 用 `WorkflowCustomFields.vue` 的同一有序字段网格显示绑定字段与自由字段；通过 `bound-field` slot 渲染已有项目资料控件；只有未绑定字段进入节点字段值 API。旧版 `projectBasicInfoFields` 由 `workflow-config.mjs` 转为绑定字段，并将 `project-basic-info` 转为 `fields` 内容项。
- [ ] 增加 radio、person multi、date range 控件，沿用现有附件上传/下载/删除、乐观锁、离开节点前保存逻辑。
- [ ] 项目资料字段继续走 `updateProject`、成员/关注人和项目经理现有权限门禁；对 v1 DTO 在运行时转换为统一字段视图。
- [ ] 详情页按照 `contentOrder` 放置字段区与既有业务工作台；固定负责人和节点排期在顶部，任务看板在底部，不受模板排序影响。
- [ ] 完成节点前，前端对可见 required bindings 和自由字段提示；后端已在 Task 3 再次强制校验。
- [ ] 跑项目详情相关 `.test.mjs` 以及 `pnpm typecheck`。

## Task 6: 端到端验收和回归

**Files:**
- Modify/Create: `pms-front/tests/workflows/*`（按现有 Playwright 目录约定）
- Modify: `pms-front/docs/superpowers/specs/2026-09-12-configurable-workflow-fields-design.md`（若实现后发现契约差异，仅同步已确认的事实）

- [ ] Playwright 覆盖模板 v1 载入、拖动节点/字段/工作台、添加 radio 与 person 字段、编辑选项与必填、预览、存草稿、发布；确认固定模块始终存在。
- [ ] 使用旧版兼容 fixture 验证九阶段、旧组件和字段顺序不丢；用 v2 测试数据验证绑定项目描述/成员实际更新原项目数据，无绑定字段保存至节点字段 API。
- [ ] 验证隐藏 required 不阻止完成；可见缺失 required 在前端和 API 后端均阻止完成；普通已填字段仍可完成。
- [ ] 运行 `pnpm test`、`pnpm typecheck`、`pnpm build`；后端运行 `mvn test`。
- [ ] 用本地已运行实例或测试浏览器验证管理端和项目详情关键路径，确认无控制台错误、布局溢出和 401/API schema 错误。
- [ ] 检查 `git diff --check`、两个仓库的变更范围和工作区状态；不可改写 main 或清理无关改动。
