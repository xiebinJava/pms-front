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
