# 企业项目看板 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement scoped tasks and review the integrated result.

**Goal:** 将现有项目看板升级并迁移到「经营分析 → 企业项目看板」。

**Architecture:** 后端一次批量返回可见项目健康快照，前端同源过滤并构建可点击的企业分析图表。保留原项目详情和路由，未接入指标明确说明。

**Tech Stack:** Vue 3、TypeScript、Ant Design Vue、Spring Boot 3、MyBatis Plus、Docker Compose。

**Spec:** `docs/superpowers/specs/2026-09-13-enterprise-project-board-design.md`

## Global Constraints

- 保留 `/projects/dashboard` 和 `/projects/:id` 链接。
- 入口为「经营分析 → 企业项目看板」。
- 全部数字只包含当前账号可读且未删除的项目。
- 未知数值不作为 0；人员和故事点不替代人天。
- 现有主题令牌、中文和英文界面、键盘交互与窄屏布局一致。
- 仅改当前 feature worktree，不合并主分支。

## Task 1: 后端聚合快照

**Files:** backend `controller/ProjectController.java`、`dto/response/ProjectBoardDTO.java`、`service/ProjectBoardService.java`、对应 service/controller tests；必要时扩展 `ProjectService` 的只读查询及 OpenAPI。

**Interfaces:** GET `/projects/board?orgUnitId=`；响应契约见规格。前端消费 `projects`，组件缺失 summary 为 null，日期为 ISO 格式。

- [x] 用可见/不可见项目、空集合、8/15 个百分点边界、已删除配置旧记录编写聚合行为测试。
- [x] 运行新增测试，记录预期缺少实现的失败；补充“模板启用组件但节点尚未物化”的红绿回归用例。
- [x] 使用项目数据范围查询和按 projectId 集合的批量查询实现快照；复用现有工作流配置读取，避免逐项目 HTTP 或逐节点查询。
- [x] 运行看板相关测试和镜像编译，评审权限、口径、旧数据隔离；33 项看板后端测试通过。全量测试受 Maven 容器无法访问 Docker daemon 影响，详情见设计 QA。

示例关键断言：`assertEquals("CRITICAL", assessment.getHealth())` 对应高风险或落后15；`assertNull(assessment.getOpenRiskCount())` 对应未配置风险。

## Task 2: 前端界面与导航

**Files:** frontend `src/api/project-board.ts`、`src/views/project-dashboard/enterprise-board.mjs` 及类型/测试、`index.vue`、`enterprise-board.css`、局部图表/口径组件、`src/layout/Index.vue`、`src/locales/{zh-CN,en-US}.ts`。

**Interfaces:** 消费 Task 1 响应；`filterBoardProjects(items, filters)` 返回同一筛选集合；`summarizeBoard(items)` 生成数量和分布；`buildOrgComparison(items)` 返回组织状态统计。

- [x] 用不同组织、等级、生命周期、未知健康数据写纯函数测试，断言统计合计等于清单集合。
- [x] 迁移侧栏分组，保留路由名和路径；接入聚合请求并处理旧请求与错误。
- [x] 实现状态卡、健康分布、等级分布、组织对比、节点里程碑、关注项目和分页清单；交互统一到 filters。
- [x] 实现项目分析及指标口径抽屉，显示真实数据来源与待接入项；项目名称进入详情，独立按钮打开分析。
- [x] `node --test "src/**/*.test.mjs"`（343 项）、`vue-tsc --noEmit`、Vite production build 均通过。

示例关键断言：`assert.equal(summarizeBoard(filterBoardProjects(rows,{level:3})).total, 1)`；零样本比例显示 `—`。

## Task 3: 集成验证与运行

**Files:** `docs/design-qa.md`；实施问题修复限定上面文件。

**Interfaces:** 当前 Compose 的 frontend:5173 / backend:8080；复用现有数据卷。

- [x] 构建并启动同一 Compose 的前后端服务，沿用现有数据库与数据卷。
- [x] 浏览器验证企业项目看板可见，研发管理不再重复入口；健康卡筛选、清除筛选、指标口径抽屉和项目分析抽屉正常。
- [x] 桌面首屏/整页截图检查无空白及框架错误；Playwright 对真实窄屏视口 390px 回归，确认页面无横向溢出，表格在内部滚动。
- [x] 完成前后端独立代码评审，修复实质问题并复测受影响路径。
- [x] 在 `docs/design-qa.md` 记录实际执行的验证和数据限制。

## 执行记录

- 2026-09-13：用户已多次批准设计和迁移，并要求继续实施；直接执行，无额外设计确认关卡。
- 后端与前端写集分属两个仓库，可以后端代理与主代理前端并行；接口以上述规格为准。
- 前置检查：Task 1→2 共享响应契约但无共享文件；Task 2→3 共用页面，集成修复在任务2完成后进行。无相互冲突的写操作。
