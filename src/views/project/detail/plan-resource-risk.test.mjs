import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  isPlanResourceRiskComplete,
  isPlanResourceRiskDraftValid,
  isPlanResourceRiskEditable,
  mergePlanResourceRiskSaveResult,
  splitRoleNames,
} from './plan-resource-risk.ts'

test('splits node roles into clean role names', () => {
  assert.deepEqual(splitRoleNames('项目经理、技术负责人 / 产品负责人; 测试负责人'), [
    '项目经理',
    '技术负责人',
    '产品负责人',
    '测试负责人',
  ])
})

test('requires iteration plans, resource ownership, and risk ownership', () => {
  const base = {
    iterationPlans: [{ name: '迭代一', ownerId: 1, startDate: '2026-09-01', dueDate: '2026-09-07' }],
    resources: [{ role: '技术负责人', ownerId: 1, focus: '投入重点' }],
    risks: [{ title: '风险', ownerId: 1, response: '应对措施' }],
  }

  assert.equal(isPlanResourceRiskComplete(base), true)
  assert.equal(isPlanResourceRiskComplete({ ...base, iterationPlans: [] }), false)
  assert.equal(isPlanResourceRiskComplete({ ...base, resources: [{ ownerId: 1, focus: '' }] }), false)
  assert.equal(isPlanResourceRiskComplete({ ...base, risks: [] }), false)
})

test('does not autosave blank rows while allowing partially completed draft rows', () => {
  assert.equal(isPlanResourceRiskDraftValid({ iterationPlans: [], resources: [], risks: [] }), true)
  assert.equal(isPlanResourceRiskDraftValid({ iterationPlans: [{ name: '' }], resources: [], risks: [] }), false)
  assert.equal(isPlanResourceRiskDraftValid({ iterationPlans: [], resources: [{ role: '' }], risks: [] }), false)
  assert.equal(isPlanResourceRiskDraftValid({ iterationPlans: [], resources: [], risks: [{ title: '' }] }), false)
})

test('keeps local rows when an autosave response only advances baseline metadata', () => {
  const resources = [{ role: '项目经理', status: 'PENDING' }]
  const risks = [{ title: '延期风险', level: 'MEDIUM', status: 'OPEN' }]
  const current = {
    projectId: 2,
    nodeId: 8,
    version: 3,
    baselineStatus: 0,
    sourceDecisionChanged: false,
    canEdit: true,
    iterationPlans: [{ id: 11, name: '迭代一' }],
    resources,
    risks,
  }
  const saved = {
    ...current,
    version: 4,
    iterationPlans: [{ id: 11, name: '迭代一' }],
    resources: [{ ...resources[0], id: 201 }],
    risks: [{ ...risks[0], id: 301 }],
  }
  const merged = mergePlanResourceRiskSaveResult(current, saved)

  assert.equal(merged.version, 4)
  assert.equal(merged.iterationPlans, current.iterationPlans)
  assert.equal(merged.resources, resources)
  assert.equal(merged.risks, risks)
  assert.equal(merged.resources[0].id, 201)
  assert.equal(merged.risks[0].id, 301)
})

test('renders iteration plans in the plan workbench', () => {
  const detailRoot = path.resolve(import.meta.dirname)
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/PlanResourceRiskWorkbench.vue'), 'utf8')
  const domain = fs.readFileSync(path.join(detailRoot, '../../../types/domain.ts'), 'utf8')
  const api = fs.readFileSync(path.join(detailRoot, '../../../api/iteration-plan.ts'), 'utf8')

  assert.match(workbench, /iterationTitle/)
  assert.match(workbench, /state\.iterationPlans/)
  assert.match(workbench, /addIterationPlan/)
  assert.match(workbench, /<a-range-picker/)
  assert.match(domain, /iterationPlans: NodeIterationPlan\[\]/)
  assert.match(api, /\/iteration-plans/)
})

test('removes the project milestone block from the plan workbench', () => {
  const detailRoot = path.resolve(import.meta.dirname)
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/PlanResourceRiskWorkbench.vue'), 'utf8')
  const domain = fs.readFileSync(path.join(detailRoot, '../../../types/domain.ts'), 'utf8')

  const template = workbench.slice(workbench.indexOf('<template>'), workbench.indexOf('<style'))
  assert.doesNotMatch(template, /milestoneTitle|open-milestones|state\.milestones/)
  assert.doesNotMatch(domain, /milestones: Milestone\[\]/)
  assert.doesNotMatch(workbench, /addPlanItem|planItems|plan-resource-risk-table--plan/)
  assert.doesNotMatch(domain, /planItems: NodePlanItem\[\]/)
})

test('saves the plan workbench after an editable control loses focus', () => {
  const detailRoot = path.resolve(import.meta.dirname)
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/PlanResourceRiskWorkbench.vue'), 'utf8')
  assert.match(workbench, /@focusout="handleWorkbenchFocusOut"/)
  assert.match(workbench, /target\.matches\('input, textarea, \[role="combobox"\]'\)/)
  assert.doesNotMatch(workbench, /watch\(state,/)
})

test('keeps plan inputs editable while an autosave request is in flight', () => {
  assert.equal(isPlanResourceRiskEditable({
    canEdit: true,
    nodeReadOnly: false,
    stateCanEdit: true,
    loading: false,
    confirming: false,
  }), true)
})

test('mounts the plan workbench without a separate reopen endpoint', () => {
  const detailRoot = path.resolve(import.meta.dirname)
  const page = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')
  const api = fs.readFileSync(path.join(detailRoot, '../../../api/node-plan-resource-risk.ts'), 'utf8')
  assert.match(page, /PlanResourceRiskWorkbench/)
  assert.match(page, /nodeHasComponent\(activeNode, 'plan-resource-risk'\)/)
  assert.match(page, /planBaselineStatus\.value !== 1/)
  assert.match(api, /plan-resource-risk/)
  assert.match(api, /confirmNodePlanResourceRisk/)
  assert.doesNotMatch(api, /reopenNodePlanResourceRisk|\/reopen/)
})

test('locks resource status controls together with the plan baseline', () => {
  const detailRoot = path.resolve(import.meta.dirname)
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/PlanResourceRiskWorkbench.vue'), 'utf8')
  assert.match(workbench, /v-model:value="item\.status" :disabled="!editable" :options="resourceStatusOptions"/)
})

test('does not hard-display source-change warnings or a reopen action', () => {
  const detailRoot = path.resolve(import.meta.dirname)
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/PlanResourceRiskWorkbench.vue'), 'utf8')
  assert.match(workbench, /sourceDecisionChanged/)
  const template = workbench.slice(workbench.indexOf('<template>'), workbench.indexOf('<style'))
  assert.doesNotMatch(template, /sourceChanged|state\.sourceDecisionChanged/)
  assert.match(template, /v-if="!loadError && !loading"[\s\S]*resourceTitle/)
  assert.doesNotMatch(workbench, /v-if="isConfirmed \|\| needsReopen"/)
  assert.doesNotMatch(workbench, /onReopen|reopening|ReloadOutlined/)
})

test('does not render the plan confirmation checklist footer', () => {
  const detailRoot = path.resolve(import.meta.dirname)
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/PlanResourceRiskWorkbench.vue'), 'utf8')
  assert.doesNotMatch(workbench, /plan-resource-risk-footer/)
  assert.doesNotMatch(workbench, /checklist/)
  assert.doesNotMatch(workbench, /CheckCircleOutlined/)
})
