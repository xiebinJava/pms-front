import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canRollbackNode,
  getFlowNodeState,
  getNodeDetailFields,
  getNodeProgress,
  isKickoffNode,
  splitNodeItems,
  shouldAutoSaveProfile,
} from './workflow.ts'

test('maps node status to the visual state used by the flow', () => {
  assert.deepEqual(getFlowNodeState(2), {
    label: '已完成',
    tone: 'completed',
    canSelect: true,
  })
  assert.deepEqual(getFlowNodeState(1), {
    label: '进行中',
    tone: 'active',
    canSelect: true,
  })
  assert.deepEqual(getFlowNodeState(0), {
    label: '待开始',
    tone: 'locked',
    canSelect: true,
  })
})

test('calculates project progress from completed nodes', () => {
  assert.equal(getNodeProgress(0, 9), 0)
  assert.equal(getNodeProgress(3, 9), 33)
  assert.equal(getNodeProgress(9, 9), 100)
  assert.equal(getNodeProgress(0, 0), 0)
})

test('only allows rollback for completed nodes', () => {
  assert.equal(canRollbackNode(0, 0), false)
  assert.equal(canRollbackNode(1, 0), false)
  assert.equal(canRollbackNode(1, 1), false)
  assert.equal(canRollbackNode(1, 2), true)
  assert.equal(canRollbackNode(0, 2), true)
})

test('splits node metadata into clean display items', () => {
  assert.deepEqual(splitNodeItems('项目章程、阶段计划;风险登记册\n验收清单'), [
    '项目章程',
    '阶段计划',
    '风险登记册',
    '验收清单',
  ])
  assert.deepEqual(splitNodeItems(''), [])
  assert.deepEqual(splitNodeItems(undefined), [])
})

test('only exposes configured fields for the selected node', () => {
  assert.deepEqual(getNodeDetailFields({
    description: '确认项目目标',
    deliverable: '项目章程、范围基线',
    roles: '',
  }), [
    { key: 'description', label: '节点说明', value: '确认项目目标', wide: true },
    { key: 'deliverable', label: '交付物', items: ['项目章程', '范围基线'] },
  ])
  assert.deepEqual(getNodeDetailFields({}), [])
})

test('shows project profile content only on the kickoff node tab', () => {
  assert.equal(isKickoffNode('kickoff'), true)
  assert.equal(isKickoffNode('requirement'), false)
  assert.equal(isKickoffNode(undefined), false)
})

test('autosaves only when a dirty profile receives an outside click', () => {
  assert.equal(shouldAutoSaveProfile(true, false, false), true)
  assert.equal(shouldAutoSaveProfile(false, false, false), false)
  assert.equal(shouldAutoSaveProfile(true, true, false), false)
  assert.equal(shouldAutoSaveProfile(true, false, true), false)
})
