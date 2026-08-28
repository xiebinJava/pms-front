# PMS 工作台与研发管理导航 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将工作台独立为 `/dashboard`，把项目列表归入“研发管理”大页签，并用现有项目、任务和动态接口展示当前用户的工作概览。

**Architecture:** 保持现有 Vue 3 + Pinia + Ant Design Vue 架构。工作台页面负责请求和状态展示，`workbench.ts` 只负责纯函数聚合、过滤、排序和指标计算；导航继续由 `src/layout/Index.vue` 控制，配置管理权限逻辑不变。第一版不改数据库和后端接口，跨项目数据由前端在受控并发范围内聚合，单个项目请求失败只影响该项目的数据。

**Tech Stack:** Vue 3、TypeScript、Vue Router、Pinia、Ant Design Vue、Node `node:test`、Vite。

**Spec:** `docs/superpowers/specs/2026-08-28-pms-workbench-design.md`

## Global Constraints

- 使用冷灰背景、白色面板、深蓝主色、低阴影和现有 `fs-insight.css` 视觉令牌。
- 工作台桌面端采用“概览四列 + 任务/项目两列 + 动态”布局，760px 以下变为单列。
- 项目管理作为“研发管理”子页签，配置管理原有权限过滤和路由保持不变。
- 不新增数据库表、后端业务规则或第三方依赖。
- 所有用户可见文案使用中文；必要的英文仅作为小号辅助文本。
- 加载中、空数据、部分失败和整体失败都必须有明确的中文状态反馈。

## 文件地图

- Modify `src/layout/Index.vue`: 导航分组名称、展开状态、活动路由和工作台入口。
- Modify `src/router/index.ts`: 注册 `/dashboard`，根路径重定向到工作台。
- Create `src/views/workbench/index.vue`: 工作台请求编排和页面渲染。
- Create `src/views/workbench/workbench.ts`: 纯函数数据转换与指标计算，便于测试。
- Create `src/views/workbench/workbench.test.mjs`: 工作台指标、过滤、排序和降级逻辑测试。
- Modify `src/layout/index.test.mjs`: 研发管理与工作台入口结构测试。
- Modify `src/styles/fs-insight.css`: 工作台网格、概览卡、列表和移动端布局。
- Create `src/views/workbench/workbench-visual.test.mjs`: 工作台视觉结构契约测试。

### Task 1: 建立工作台聚合函数的失败测试

**Files:**
- Create: `src/views/workbench/workbench.test.mjs`
- Test target to be created: `src/views/workbench/workbench.ts`

**Interfaces:**
- `buildWorkbenchSummary(projects, tasks, userId, now): WorkbenchSummary`
- `selectMyTasks(tasks, projects, userId): WorkbenchTask[]`
- `selectMyProjects(projects, tasks, userId): Project[]`
- `sortWorkbenchTasks(tasks): WorkbenchTask[]`
- `selectRecentActivities(activities, limit): WorkbenchActivity[]`

- [ ] **Step 1: Write the failing tests**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildWorkbenchSummary,
  selectMyProjects,
  selectMyTasks,
  selectRecentActivities,
  sortWorkbenchTasks,
} from './workbench.ts'

const projects = [
  { id: 1, name: '研发门户', ownerId: 7, projectManagerId: 8, taskCount: 3 },
  { id: 2, name: '供应链升级', ownerId: 9, projectManagerId: 10, taskCount: 2 },
]
const tasks = [
  { id: 1, projectId: 1, title: '补齐接口文档', assigneeId: 7, status: 0, priority: 2, dueDate: '2026-08-29' },
  { id: 2, projectId: 1, title: '完成联调', assigneeId: 7, status: 1, priority: 3, dueDate: '2026-08-28' },
  { id: 3, projectId: 2, title: '发布验收包', assigneeId: 10, status: 2, priority: 1, dueDate: '2026-08-27' },
]

test('selects tasks assigned to the current user and enriches project context', () => {
  const result = selectMyTasks(tasks, projects, 7)
  assert.deepEqual(result.map((task) => [task.title, task.projectName]), [
    ['补齐接口文档', '研发门户'],
    ['完成联调', '研发门户'],
  ])
})

test('selects projects owned, managed, or represented by one of the user tasks', () => {
  assert.deepEqual(selectMyProjects(projects, tasks, 7).map((project) => project.id), [1])
})

test('calculates pending, in-progress, due-soon, and participating-project totals', () => {
  assert.deepEqual(buildWorkbenchSummary(projects, tasks, 7, new Date('2026-08-28T00:00:00Z')), {
    pendingTaskCount: 1,
    inProgressTaskCount: 1,
    dueSoonTaskCount: 2,
    participatingProjectCount: 1,
  })
})

test('sorts tasks by status, due date, priority, and title without mutating input', () => {
  const input = selectMyTasks(tasks, projects, 7)
  const snapshot = input.slice()
  const result = sortWorkbenchTasks(input)
  assert.deepEqual(input, snapshot)
  assert.deepEqual(result.map((task) => task.id), [1, 2])
})

test('limits recent activities after sorting newest first', () => {
  const activities = [
    { id: 1, createdAt: '2026-08-27T08:00:00Z' },
    { id: 2, createdAt: '2026-08-28T08:00:00Z' },
    { id: 3, createdAt: '2026-08-26T08:00:00Z' },
  ]
  assert.deepEqual(selectRecentActivities(activities, 2).map((activity) => activity.id), [2, 1])
})
```

- [ ] **Step 2: Run the focused test and verify it fails for the missing module**

Run: `node --test src/views/workbench/workbench.test.mjs`

Expected: FAIL with a module-not-found or missing-export error for `workbench.ts`.

### Task 2: Implement pure workbench aggregation functions

**Files:**
- Create: `src/views/workbench/workbench.ts`

**Interfaces:**
- `WorkbenchTask` extends `Task` with `projectName` and `projectCode`.
- `WorkbenchActivity` has `id`, `projectId`, `projectName`, `content`, `actorName`, and `createdAt`.
- `WorkbenchSummary` has `pendingTaskCount`, `inProgressTaskCount`, `dueSoonTaskCount`, and `participatingProjectCount`.

- [ ] **Step 1: Implement the minimum types and functions**

```ts
import type { Comment, Project, Task } from '/@/types/domain'

export interface WorkbenchTask extends Task {
  projectName: string
  projectCode: string
}

export interface WorkbenchActivity extends Comment {
  projectName: string
  actorName: string
}

export interface WorkbenchSummary {
  pendingTaskCount: number
  inProgressTaskCount: number
  dueSoonTaskCount: number
  participatingProjectCount: number
}

const DONE_STATUS = 2
const IN_PROGRESS_STATUS = 1
const PENDING_STATUS = 0

function projectMap(projects: Project[]) {
  return new Map(projects.map((project) => [project.id, project]))
}

export function selectMyTasks(tasks: Task[], projects: Project[], userId?: number): WorkbenchTask[] {
  const projectsById = projectMap(projects)
  return tasks
    .filter((task) => userId != null && task.assigneeId === userId)
    .map((task) => {
      const project = projectsById.get(task.projectId)
      return { ...task, projectName: project?.name || '未命名项目', projectCode: project?.code || '' }
    })
}

export function selectMyProjects(projects: Project[], tasks: Task[], userId?: number): Project[] {
  if (userId == null) return []
  const assignedProjectIds = new Set(tasks.filter((task) => task.assigneeId === userId).map((task) => task.projectId))
  return projects.filter((project) => project.ownerId === userId || project.projectManagerId === userId || assignedProjectIds.has(project.id))
}

export function buildWorkbenchSummary(projects: Project[], tasks: Task[], userId: number | undefined, now = new Date()): WorkbenchSummary {
  const myTasks = tasks.filter((task) => userId != null && task.assigneeId === userId)
  const dueLimit = now.getTime() + 7 * 24 * 60 * 60 * 1000
  const dueSoonTaskCount = myTasks.filter((task) => {
    if (task.status === DONE_STATUS || !task.dueDate) return false
    const due = new Date(task.dueDate).getTime()
    return Number.isFinite(due) && due >= now.getTime() && due <= dueLimit
  }).length
  return {
    pendingTaskCount: myTasks.filter((task) => task.status === PENDING_STATUS).length,
    inProgressTaskCount: myTasks.filter((task) => task.status === IN_PROGRESS_STATUS).length,
    dueSoonTaskCount,
    participatingProjectCount: selectMyProjects(projects, tasks, userId).length,
  }
}

export function sortWorkbenchTasks(tasks: WorkbenchTask[]): WorkbenchTask[] {
  return [...tasks].sort((left, right) => {
    if (left.status !== right.status) return left.status - right.status
    const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.POSITIVE_INFINITY
    const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.POSITIVE_INFINITY
    if (leftDue !== rightDue) return leftDue - rightDue
    if (left.priority !== right.priority) return right.priority - left.priority
    return left.title.localeCompare(right.title, 'zh-CN')
  })
}

export function selectRecentActivities<T extends { createdAt: string }>(activities: T[], limit = 5): T[] {
  return [...activities].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, Math.max(0, limit))
}
```

- [ ] **Step 2: Run the focused test and verify it passes**

Run: `node --test src/views/workbench/workbench.test.mjs`

Expected: 5 tests pass.

### Task 3: Make the navigation and route hierarchy match the design

**Files:**
- Modify: `src/layout/Index.vue`
- Modify: `src/router/index.ts`
- Modify: `src/layout/index.test.mjs`

**Interfaces:**
- `menuRoutes.dashboard` maps to `/dashboard`.
- `selectedKeys` returns `dashboard` for `/dashboard` and `projects` for `/projects` or `/projects/:id`.
- The project group label is `研发管理`; its child label remains `项目管理`.

- [ ] **Step 1: Add failing navigation assertions**

```js
test('routes workbench separately from project management', () => {
  assert.match(source, /dashboard:\s*'\/dashboard'/)
  assert.match(source, /研发管理/)
  assert.match(source, /aria-label="项目管理子页签"/)
  assert.match(routerSource, /path:\s*'dashboard'/)
  assert.match(routerSource, /redirect:\s*'\/dashboard'/)
})
```

- [ ] **Step 2: Run the focused layout test and verify it fails**

Run: `node --test src/layout/index.test.mjs`

Expected: FAIL because the current menu still maps `dashboard` to `/projects`, shows `项目管理` as the group label, and the root redirect is `/projects`.

- [ ] **Step 3: Implement the route and navigation changes**

Add the lazy route:

```ts
{
  path: 'dashboard',
  name: 'dashboard',
  component: () => import('/@/views/workbench/index.vue'),
  meta: { title: '工作台' },
},
```

Change the empty-path redirect to `/dashboard`, map the dashboard menu key to `/dashboard`, and change only the project group label to `研发管理`. Keep its child route key and `/projects` target unchanged.

- [ ] **Step 4: Run the focused layout test and verify it passes**

Run: `node --test src/layout/index.test.mjs`

Expected: all layout tests pass.

### Task 4: Build the workbench page around existing APIs

**Files:**
- Create: `src/views/workbench/index.vue`
- Create: `src/views/workbench/workbench-visual.test.mjs`

**Interfaces:**
- Consume `getProjectPage`, `getTasks`, `getComments`, `useUserStore`, `formatDate`, `getProjectStatusLabel`, `Priority`, `TaskStatus`, `statusTagColor`, and `priorityTagColor`.
- Render `.workbench-page`, `.workbench-overview-grid`, `.workbench-content-grid`, `.workbench-panel`, `.workbench-task-list`, `.workbench-project-list`, and `.workbench-activity-list`.

- [ ] **Step 1: Write the failing visual contract test**

```js
import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
const styleSource = fs.readFileSync(new URL('../../styles/fs-insight.css', import.meta.url), 'utf8')

test('workbench exposes the agreed work sections and responsive layout hooks', () => {
  for (const label of ['我的工作', '工作概览', '我的任务', '项目进展', '最近动态']) assert.match(source, new RegExp(label))
  assert.match(source, /getProjectPage/)
  assert.match(source, /getTasks/)
  assert.match(source, /getComments/)
  assert.match(source, /workbench-overview-grid/)
  assert.match(source, /workbench-content-grid/)
  assert.match(styleSource, /\.workbench-overview-grid\s*\{/)
  assert.match(styleSource, /@media \(max-width: 760px\)[\s\S]*\.workbench-content-grid/)
})
```

- [ ] **Step 2: Run the focused visual test and verify it fails**

Run: `node --test src/views/workbench/workbench-visual.test.mjs`

Expected: FAIL because the workbench page and styles do not exist.

- [ ] **Step 3: Implement request orchestration and state handling**

Use `MAX_PROJECT_CONTEXTS = 20`. Load the first project page with `pageSize: 50`, then call `getTasks` and `getComments` for each context with `Promise.allSettled`. Keep successful results, set a `partialFailure` flag when one context fails, and show a warning line without blocking the rest of the page. On project-page failure, show the page-level error state and a `重试` button.

Use `selectMyTasks`, `selectMyProjects`, `sortWorkbenchTasks`, `selectRecentActivities`, and `buildWorkbenchSummary` for all derived values. The current user ID comes from `userStore.user?.id`; do not match by display name.

- [ ] **Step 4: Implement the template and interactions**

Render four overview cards, task rows that call `router.push(`/projects/${task.projectId}`)` on click, project rows that call the same project detail route, and activity rows with actor, project, content, and formatted time. Use `a-empty` for each empty section, `a-spin` while loading, and `a-alert` for partial or full failures. Keep all labels Chinese and retain the existing page header/action conventions.

- [ ] **Step 5: Add the scoped workbench styles**

Add the named layout hooks to `fs-insight.css`. Use a four-column overview grid, a two-column content grid, consistent panel padding and shadow tokens, and a `@media (max-width: 760px)` rule that changes both grids to one column. Ensure task/project rows can wrap long names and do not create page-level overflow.

- [ ] **Step 6: Run the focused workbench tests**

Run: `node --test src/views/workbench/workbench.test.mjs src/views/workbench/workbench-visual.test.mjs`

Expected: all workbench tests pass.

### Task 5: Full verification and browser review

**Files:**
- Modify only if verification finds a regression in `src/layout/Index.vue`, `src/router/index.ts`, `src/views/workbench/index.vue`, or `src/styles/fs-insight.css`.

- [ ] **Step 1: Run all frontend tests and static checks**

Run: `node --test src/**/*.test.mjs && npm run typecheck && npm run build && git diff --check`

Expected: all tests pass, type checking succeeds, Vite production build succeeds, and `git diff --check` reports no whitespace errors.

- [ ] **Step 2: Verify the desktop workbench flow in the Browser**

Flow under test: `/login` (existing signed-in session) → `/dashboard` → inspect “我的工作” → click a task/project row → verify `/projects/:id`.

Check page identity, meaningful DOM content, no framework overlay, no console errors/warnings, overview cards, all four sections, and route navigation.

- [ ] **Step 3: Verify navigation groups**

On `/dashboard`, confirm “研发管理” is expanded and its child “项目管理” is visible. Collapse and re-open it; navigate to `/projects` and confirm the child is active. Navigate to `/admin/users` and confirm “配置管理” children and active state remain available.

- [ ] **Step 4: Verify the 390px responsive flow**

Set the Browser viewport to `390×844`, open the mobile navigation, confirm the workbench and both groups are readable, confirm `document.body.scrollWidth === window.innerWidth`, then restore the default viewport.

- [ ] **Step 5: Record any residual risk**

Report if the running backend does not expose comments/tasks for a project, if data is empty, or if another viewport/browser remains untested. Do not fabricate activity data.
