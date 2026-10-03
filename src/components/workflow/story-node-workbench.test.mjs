import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createStoryNodeWorkbenchConfig,
  getStoryNodeWorkbenchBlueprint,
  getStoryWorkbenchVariant,
  STORY_WORKBENCH_PALETTE,
  STORY_NODE_WORKBENCH_COMPONENT,
  STORY_TESTING_COMPONENT,
} from './story-node-workbench.mjs'

test('maps every story node name to its workbench variant', () => {
  assert.equal(getStoryWorkbenchVariant({ name: '故事写卡' }), 'writing')
  assert.equal(getStoryWorkbenchVariant({ name: '迭代计划会' }), 'iteration')
  assert.equal(getStoryWorkbenchVariant({ name: '开发中' }), 'development')
  assert.equal(getStoryWorkbenchVariant({ name: '验收中' }), 'acceptance')
  assert.equal(getStoryWorkbenchVariant({ name: '待发布' }), 'release')
  assert.equal(getStoryWorkbenchVariant({ name: '已上线' }), 'launch')
})

test('does not assign a workbench variant to the testing node or unknown names', () => {
  assert.equal(getStoryWorkbenchVariant({ name: '测试中' }), null)
  assert.equal(getStoryWorkbenchVariant({ name: '自定义节点' }), null)
  assert.equal(getStoryNodeWorkbenchBlueprint({ name: '测试中' }), null)
})

test('creates a node-bound workbench config with default purpose and activities', () => {
  const config = createStoryNodeWorkbenchConfig({ key: 'writing', name: '故事写卡' })
  assert.deepEqual(config, {
    nodeKey: 'writing',
    nodeName: '故事写卡',
    variant: 'writing',
    purpose: '确认故事目标、范围和验收标准，形成可开发的卡片。',
    activities: ['确认故事目标与范围', '明确验收标准', '确认负责人与排期'],
  })
  assert.equal(createStoryNodeWorkbenchConfig({ key: 'x', name: '测试中' }), null)
})

test('story palette exposes seven dedicated entries over two runtime components', () => {
  assert.equal(STORY_WORKBENCH_PALETTE.length, 7)
  assert.deepEqual(STORY_WORKBENCH_PALETTE.map((entry) => entry.key), [
    'story-writing-workbench',
    'story-iteration-workbench',
    'story-development-workbench',
    'story-testing-workbench',
    'story-acceptance-workbench',
    'story-release-workbench',
    'story-launch-workbench',
  ])
  const testing = STORY_WORKBENCH_PALETTE.find((entry) => entry.key === 'story-testing-workbench')
  assert.equal(testing.runtimeKey, STORY_TESTING_COMPONENT)
  for (const entry of STORY_WORKBENCH_PALETTE.filter((item) => item.key !== 'story-testing-workbench')) {
    assert.equal(entry.runtimeKey, STORY_NODE_WORKBENCH_COMPONENT)
    assert.deepEqual(entry.processTypeCodes, ['story-management'])
    assert.deepEqual(entry.workbenchTypes, ['story'])
  }
})
