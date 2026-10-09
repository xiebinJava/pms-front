import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')

test('iteration plans have a standalone list and detail route', () => {
  const router = fs.readFileSync(path.join(root, 'router/index.ts'), 'utf8')
  const layout = fs.readFileSync(path.join(root, 'layout/Index.vue'), 'utf8')

  assert.match(router, /path: 'development\/iterations'/)
  assert.match(router, /path: 'development\/iterations\/:id'/)
  assert.match(layout, /development-iterations/)
  assert.match(layout, /nav\.iterationPlans/)
})

test('iteration plan API exposes paged list and detail endpoints', () => {
  const api = fs.readFileSync(path.join(root, 'api/iteration-plan.ts'), 'utf8')

  assert.match(api, /createIterationPlan/)
  assert.match(api, /projectId: number \| string \| null \| undefined/)
  assert.match(api, /http\.post\('\/iteration-plans'/)
  assert.match(api, /\/projects\/\$\{projectId\}\/iteration-plans/)
  assert.match(api, /getIterationPlanPage/)
  assert.match(api, /getIterationPlanDetail/)
  assert.match(api, /\/iteration-plans\/page/)
  assert.match(api, /\/iteration-plans\/\$\{id\}/)
})

test('iteration list exposes a create action and project-aware create form', () => {
  const list = fs.readFileSync(path.join(root, 'views/development/iterations/index.vue'), 'utf8')

  assert.match(list, /iterationPlanView\.create/)
  assert.match(list, /createIterationPlan\(projectId, payload\)/)
  assert.match(list, /getProjectPage/)
  assert.match(list, /createForm\.projectId/)
  assert.match(list, /createForm\.name/)
  assert.doesNotMatch(list, /createForm\.projectId == null \|\| !createForm\.name\.trim\(\)/)
  assert.match(list, /createProjectOptional/)
})

test('iteration list uses the shared primary action style and exposes a delete action', () => {
  const list = fs.readFileSync(path.join(root, 'views/development/iterations/index.vue'), 'utf8')
  const api = fs.readFileSync(path.join(root, 'api/iteration-plan.ts'), 'utf8')

  assert.match(list, /type="primary" class="pms-primary-button pms-project-button pms-project-button--primary"/)
  assert.match(list, /deleteIterationPlan/)
  assert.match(list, /Modal\.confirm/)
  assert.match(list, /iterationPlanView\.delete/)
  assert.match(list, /pms-project-button--danger/)
  assert.match(api, /http\.delete\(`\/iteration-plans\/\$\{id\}`\)/)
})

test('iteration owner selection uses the company-wide active user directory', () => {
  const list = fs.readFileSync(path.join(root, 'views/development/iterations/index.vue'), 'utf8')
  assert.match(list, /searchUsers/)
  assert.match(list, /filter-option="false"/)
  assert.doesNotMatch(list, /getMembers/)
  assert.match(list, /iterationPlanView\.ownerLoadFailed/)
})

test('iteration detail treats an unbound plan as a valid standalone record', () => {
  const detail = fs.readFileSync(path.join(root, 'views/development/iterations/detail.vue'), 'utf8')

  assert.match(detail, /v-if="detail\.plan\.projectId != null"/)
  assert.match(detail, /v-else.*iterationPlanView\.unboundProject/)
})

test('project task editor can choose and clear an iteration plan', () => {
  const kanban = fs.readFileSync(path.join(root, 'views/project/detail/components/TaskKanban.vue'), 'utf8')
  const taskApi = fs.readFileSync(path.join(root, 'api/task.ts'), 'utf8')
  const domain = fs.readFileSync(path.join(root, 'types/domain.ts'), 'utf8')

  assert.match(kanban, /getIterationPlans/)
  assert.match(kanban, /form\.iterationPlanId/)
  assert.match(taskApi, /clearIterationPlan/)
  assert.match(domain, /iterationPlanId\?: number/)
})

test('iteration plan screens stay independent from workflow item details', () => {
  const list = fs.readFileSync(path.join(root, 'views/development/iterations/index.vue'), 'utf8')
  const detail = fs.readFileSync(path.join(root, 'views/development/iterations/detail.vue'), 'utf8')

  assert.match(list, /getIterationPlanPage/)
  assert.match(detail, /getIterationPlanDetail/)
  assert.match(detail, /storyList/)
  assert.match(detail, /taskList/)
  assert.doesNotMatch(list, /getDevelopmentItemWorkflow/)
  assert.doesNotMatch(detail, /getDevelopmentItemWorkflow/)
  assert.match(detail, /iterationPlanView\.hint/)
})

test('iteration list uses the shared project list table baseline without a second table header', () => {
  const list = fs.readFileSync(path.join(root, 'views/development/iterations/index.vue'), 'utf8')
  assert.match(list, /class="[^"]*pms-list-table[^"]*"/)
  assert.match(list, /pms-project-table-scroll/)
  assert.doesNotMatch(list, /iteration-plan-list-page__card-head/)
})

test('iteration plans expose system version fields, paging filters, and detail presentation', () => {
  const api = fs.readFileSync(path.join(root, 'api/iteration-plan.ts'), 'utf8')
  const domain = fs.readFileSync(path.join(root, 'types/domain.ts'), 'utf8')
  const list = fs.readFileSync(path.join(root, 'views/development/iterations/index.vue'), 'utf8')
  const detail = fs.readFileSync(path.join(root, 'views/development/iterations/detail.vue'), 'utf8')

  assert.match(api, /systemVersionId\?: number \| null/)
  assert.match(domain, /systemVersionId\?: number \| null/)
  assert.match(domain, /systemVersionNo\?: string/)
  assert.match(domain, /systemName\?: string/)
  assert.doesNotMatch(domain, /systemCode\?: string/)
  assert.match(list, /getSystemVersionPage/)
  assert.match(list, /systemVersionId: query\.systemVersionId/)
  assert.match(list, /key: 'systemVersion'/)
  assert.match(list, /systemVersionStatusColor/)
  assert.match(detail, /systemVersionNo/)
  assert.match(detail, /systemVersionSystemLabel/)
  assert.match(detail, /pms-table-scroll iteration-plan-detail-page__table-scroll/)
  assert.doesNotMatch(detail, /<a-table[^>]*:scroll=/)
})

test('iteration list keeps one mobile table scroll container while expanding for the version column', () => {
  const list = fs.readFileSync(path.join(root, 'views/development/iterations/index.vue'), 'utf8')

  assert.match(list, /pms-table-scroll pms-project-table-scroll/)
  assert.match(list, /min-width: 1590px/)
  assert.doesNotMatch(list, /<a-table[^>]*:scroll=/)
})
