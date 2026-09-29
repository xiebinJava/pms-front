import test from 'node:test'
import assert from 'node:assert/strict'
import {
  REQUIREMENT_NODE_WORKBENCH_COMPONENT,
  createRequirementNodeWorkbenchConfig,
  getRequirementNodeWorkbenchBlueprint,
  isRequirementClarificationNode,
  isRequirementIntegrationNode,
  isRequirementSchedulingNode,
} from './requirement-node-workbench.mjs'

test('defines a separate workbench blueprint for each requirement node', () => {
  assert.equal(REQUIREMENT_NODE_WORKBENCH_COMPONENT, 'requirement-node-workbench')
  assert.deepEqual(createRequirementNodeWorkbenchConfig({ key: 'clarify', name: '需求澄清' }), {
    nodeKey: 'clarify',
    nodeName: '需求澄清',
    purpose: '补充背景、目标、边界和验收标准，形成可执行的需求说明。',
    activities: [
      '补充需求背景与目标',
      '明确范围边界和约束',
      '确认验收标准',
      '记录澄清结论',
    ],
  })
})

test('keeps requirement release workbench aligned with the restored publish version field', () => {
  const blueprint = getRequirementNodeWorkbenchBlueprint({ key: 'release', name: '需求上线' })
  assert.deepEqual(blueprint.activities, [
    '确认发布版本和范围',
    '完成上线前检查',
    '准备交接与回滚方案',
    '记录上线结果',
  ])
  assert.equal(blueprint.display, undefined)
})

test('falls back safely for a custom requirement node without borrowing another node blueprint', () => {
  const blueprint = getRequirementNodeWorkbenchBlueprint({ key: 'custom', name: '自定义需求节点' })
  assert.equal(blueprint.purpose, '补充当前节点的关键活动和完成结果。')
  assert.deepEqual(blueprint.activities, ['明确本节点目标', '记录关键结论', '确认交付结果'])
})

test('identifies clarification nodes consistently for template and runtime previews', () => {
  assert.equal(isRequirementClarificationNode({ name: '需求澄清' }), true)
  assert.equal(isRequirementClarificationNode({ name: '需求接收' }), false)
})

test('identifies integration nodes consistently for template and runtime previews', () => {
  assert.equal(isRequirementIntegrationNode({ name: '需求整合' }), true)
  assert.equal(isRequirementIntegrationNode({ name: '需求排期' }), false)
})

test('identifies scheduling nodes consistently for template and runtime previews', () => {
  assert.equal(isRequirementSchedulingNode({ name: '需求排期' }), true)
  assert.equal(isRequirementSchedulingNode({ name: '需求开发' }), false)
})
