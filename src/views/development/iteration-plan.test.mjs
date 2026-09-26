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

  assert.match(api, /getIterationPlanPage/)
  assert.match(api, /getIterationPlanDetail/)
  assert.match(api, /\/iteration-plans\/page/)
  assert.match(api, /\/iteration-plans\/\$\{id\}/)
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
