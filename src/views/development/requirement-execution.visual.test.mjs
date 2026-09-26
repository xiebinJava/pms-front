import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), 'utf8')

test('requirement detail reuses the shared workflow shell and mounts its configurable execution component', () => {
  const detail = read('./detail/DevelopmentItemDetailPage.vue')
  const flow = read('./detail/components/DevelopmentItemFlow.vue')
  const fields = read('./detail/components/DevelopmentItemWorkflowFields.vue')
  const board = read('./detail/components/DevelopmentItemTaskBoard.vue')

  assert.match(detail, /props\.itemType === 'requirement'/)
  assert.match(detail, /DevelopmentItemFlow/)
  assert.match(detail, /DevelopmentItemWorkflowFields/)
  assert.match(detail, /DevelopmentItemTaskBoard/)
  assert.match(detail, /RequirementExecutionComponent/)
  assert.match(detail, /WorkflowRuntimeComponentKey\.REQUIREMENT_EXECUTION/)
  assert.match(detail, /:item-id="detail\.id"/)
  assert.match(detail, /:target="detail\.executionTarget"/)
  assert.match(detail, /:target-history="detail\.executionTargetHistory"/)
  assert.match(flow, /class="flow-card pms-detail-panel pms-section-panel card-surface"/)
  assert.match(fields, /class="development-item-fields pms-workflow-fields node-tab-profile"/)
  assert.match(board, /class="task-board-shell"/)
})

test('requirement execution component supports zero or one target, search, change reason, and history', () => {
  const component = read('./detail/RequirementExecutionComponent.vue')
  const api = read('../../api/development-item.ts')

  assert.match(component, /defineProps<\{[\s\S]*itemId: number[\s\S]*target\?: RequirementExecutionTarget[\s\S]*targetHistory\?: RequirementExecutionTargetHistory\[\][\s\S]*canWrite: boolean/s)
  assert.match(component, /getRequirementExecutionTargetOptions/)
  assert.match(component, /linkRequirementExecutionTarget/)
  assert.match(component, /unlinkRequirementExecutionTarget/)
  assert.match(component, /changeRequirementExecutionTarget/)
  assert.match(component, /getRequirementExecutionTargetHistory/)
  assert.match(component, /requirementExecutionTargetType/)
  assert.match(component, /changeReason/)
  assert.match(component, /executionTargetHistory/)
  assert.match(component, /target\s*\?\./)
  assert.match(component, /target.navigationId != null/)
  assert.match(api, /http\.post\(`\/development\/requirements\/\$\{id\}\/execution-target\/options`/)
  assert.match(api, /http\.post\(`\/development\/requirements\/\$\{id\}\/execution-target`/)
  assert.match(api, /http\.delete\(`\/development\/requirements\/\$\{id\}\/execution-target`/)
  assert.match(api, /http\.post\(`\/development\/requirements\/\$\{id\}\/execution-target\/change`/)
  assert.match(api, /http\.get\(`\/development\/requirements\/\$\{id\}\/execution-target\/history`/)
})

test('requirement execution is registered only for requirement-management templates', () => {
  const registry = read('../../components/workflow/workflow-component-registry.ts')
  const host = read('../../components/workflow/WorkflowRuntimeComponentHost.vue')
  const model = read('../admin/workflows/workflow-template-model.mjs')

  assert.match(registry, /REQUIREMENT_EXECUTION:\s*'requirement-execution'/)
  assert.match(registry, /key: WorkflowRuntimeComponentKey\.REQUIREMENT_EXECUTION[\s\S]*processTypeCodes: \['requirement-management'\]/)
  assert.match(host, /getWorkflowRuntimeComponentDefinition/)
  assert.match(model, /processTypeCode === 'requirement-management'/)
  assert.match(model, /sourceProjectNodeKey: _projectOnlyBinding/)
  assert.match(model, /sourceTopicNodeKey: _storyOnlyBinding/)
})
