import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  isRequirementBaselineComplete,
  nextRequirementCode,
  scopeItemCount,
} from './requirement-scope.ts'

const detailRoot = path.resolve(import.meta.dirname)

test('requires the minimum content before confirming a requirement baseline', () => {
  assert.equal(isRequirementBaselineComplete({
    objective: '',
    deliverable: '验收基线',
    scopeItems: [],
    requirements: [],
  }), false)
  assert.equal(isRequirementBaselineComplete({
    scopeItems: [{ direction: 'IN', title: '订单流程' }],
    requirements: [{ status: 1, name: '订单流转', acceptanceCriteria: '状态可追踪' }],
  }), true)
  assert.equal(isRequirementBaselineComplete({
    objective: '明确范围',
    deliverable: '验收基线',
    scopeItems: [{ direction: 'IN', title: '订单流程' }],
    requirements: [{ status: 1, name: '订单流转', acceptanceCriteria: '状态可追踪' }],
  }), true)
  assert.equal(isRequirementBaselineComplete({
    objective: '明确范围',
    deliverable: '验收基线',
    scopeItems: [{ direction: 'OUT', title: '供应商系统' }],
    requirements: [{ status: 1, name: '订单流转', acceptanceCriteria: '状态可追踪' }],
  }), false)
})

test('generates the next requirement code without colliding with existing rows', () => {
  assert.equal(nextRequirementCode([]), 'REQ-001')
  assert.equal(nextRequirementCode([{ code: 'REQ-001' }, { code: 'REQ-004' }]), 'REQ-002')
  assert.equal(nextRequirementCode([{ code: 'REQ-001' }, { code: 'REQ-002' }, { code: 'REQ-004' }]), 'REQ-003')
})

test('counts in-scope and out-of-scope items independently', () => {
  const items = [{ direction: 'IN' }, { direction: 'IN' }, { direction: 'OUT' }]
  assert.deepEqual(scopeItemCount(items), { inScope: 2, outScope: 1 })
})

test('integrates the requirement workbench only into the requirement node', () => {
  const source = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')
  assert.match(source, /RequirementScopeWorkbench/)
  assert.match(source, /activeNode\.nodeKey === 'requirement'/)
  assert.match(source, /<TaskKanban/) 
})

test('sends and retains the requirement baseline version for optimistic locking', () => {
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/RequirementScopeWorkbench.vue'), 'utf8')
  assert.match(workbench, /version: next\.version/)
  assert.match(workbench, /version: state\.version/)
})

test('keeps requirement details focused on scope and the requirement list', () => {
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/RequirementScopeWorkbench.vue'), 'utf8')
  assert.doesNotMatch(workbench, /requirementScope\.(objective|deliverable)/)
  assert.doesNotMatch(workbench, /requirement-scope-footer/)
})

test('exposes lightweight requirement-to-task actions and progress', () => {
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/RequirementScopeWorkbench.vue'), 'utf8')
  const kanban = fs.readFileSync(path.join(detailRoot, 'components/TaskKanban.vue'), 'utf8')
  assert.match(workbench, /create-task/)
  assert.match(workbench, /completedTaskCount/)
  assert.match(workbench, /taskCount/)
  assert.match(workbench, /item\.status !== 1/)
  assert.match(workbench, /requirement-create-task-tooltip-target/)
  assert.match(workbench, /createTaskRequiresConfirmation/)
  assert.match(workbench, /scheduleAutoSave/)
  assert.match(workbench, /@focusout="handleWorkbenchFocusOut"/)
  assert.match(workbench, /target\.matches\('input, textarea, \[role="combobox"\]'\)/)
  assert.doesNotMatch(workbench, /watch\(state,/)
  assert.doesNotMatch(workbench, /detail\.requirementScope\.confirmBaseline'/)
  assert.match(kanban, /openCreateForRequirement/)
  assert.match(kanban, /requirementId/)
})

test('keeps requirement rows compact and uses a dot-only status indicator', () => {
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/RequirementScopeWorkbench.vue'), 'utf8')
  const codeCellStart = workbench.indexOf('class="requirement-code-cell"')
  const nameCellStart = workbench.indexOf('class="requirement-name-cell"')
  const progressStart = workbench.indexOf('class="requirement-task-progress"')
  const codeCell = workbench.slice(codeCellStart, nameCellStart)
  const nameCell = workbench.slice(nameCellStart, workbench.indexOf('class="requirement-row-actions"'))

  assert.match(codeCell, /requirement-status-dot/)
  assert.match(codeCell, /requirement-task-progress/)
  assert.ok(codeCellStart < progressStart && progressStart < nameCellStart)
  assert.doesNotMatch(codeCell, /requirement-status-tag/)
  assert.doesNotMatch(nameCell, /requirement-task-progress/)
})

test('completion flushes autosave without asking for a separate baseline confirmation', () => {
  const page = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/RequirementScopeWorkbench.vue'), 'utf8')
  const completionBlock = page.slice(page.indexOf('async function onComplete'), page.indexOf('async function refreshAfterLifecycle'))

  assert.match(page, /flushAutoSave/)
  assert.match(completionBlock, /requirementContentIncomplete/)
  assert.doesNotMatch(completionBlock, /requirementBaselineRequired/)
  assert.match(workbench, /defineExpose\(\{ refresh: load, flushAutoSave \}\)/)
  assert.doesNotMatch(workbench, /requirement-scope-workbench__title-row/)
  assert.doesNotMatch(workbench, /detail\.requirementScope\.title/)
})
