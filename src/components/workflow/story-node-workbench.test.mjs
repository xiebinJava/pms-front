import test from 'node:test'
import { getStoryDevelopmentPeople } from './story-node-workbench.mjs'

test('development people inherit the persisted iteration variant even after renaming and ignore other nodes', () => {
  const people = getStoryDevelopmentPeople([
    { name: '迭代计划会', componentConfigs: { 'story-node-workbench': { variant: 'development' } }, fieldValues: { __components: { 'story-node-workbench': { testerIds: [99] } } } },
    { name: '已改名', componentConfigs: { 'story-node-workbench': { variant: 'iteration' } }, fieldValues: { __components: { 'story-node-workbench': { developerIds: [3, 3], testerIds: [7] } } } },
  ])
  assert.deepEqual(people, { developerIds: [3], testerIds: [7] })
  assert.deepEqual(getStoryDevelopmentPeople([]), { developerIds: [], testerIds: [] })
})
import assert from 'node:assert/strict'
import {
  createStoryNodeWorkbenchConfig,
  getStoryNodeWorkbenchBlueprint,
  getStoryWorkbenchVariant,
  STORY_WORKBENCH_PALETTE,
  STORY_NODE_WORKBENCH_COMPONENT,
  STORY_TESTING_COMPONENT,
  normalizeStoryWorkbenchState,
  mergeStoryWorkbenchState,
  STORY_WORKBENCH_FIELDS,
} from './story-node-workbench.mjs'
import * as writing from './story-node-workbench.mjs'

test('writing combines legacy text without discarding either part and uses the actual story identity', () => {
  const values = { __components: { 'story-node-workbench': { background: '用户需要退款', acceptanceCriteria: '退款成功', title: '旧副本', legacy: 'keep' } } }
  const state = writing.normalizeStoryWritingState(values, { title: '退款故事', topicId: 7 })
  assert.equal(state.title, '退款故事')
  assert.equal(state.topicId, '7')
  assert.equal(state.descriptionAndAcceptance, '用户需要退款\n\n退款成功')
  assert.equal(state.priority, 'NORMAL')
  const merged = writing.mergeStoryWritingState(values, { ...state, descriptionAndAcceptance: '新的描述及标准' }, { title: '退款故事', topicId: 7 })
  assert.equal(merged.__components['story-node-workbench'].background, '用户需要退款')
  assert.equal(merged.__components['story-node-workbench'].legacy, 'keep')
  assert.equal(merged.__components['story-node-workbench'].descriptionAndAcceptance, '新的描述及标准')
  assert.equal(values.__components['story-node-workbench'].acceptanceCriteria, '退款成功')
})

test('writing respects intentionally cleared combined text instead of restoring legacy text', () => {
  const values = { __components: { 'story-node-workbench': { descriptionAndAcceptance: '', background: '旧内容' } } }
  assert.equal(writing.normalizeStoryWritingState(values, { title: '故事', topicId: null }).descriptionAndAcceptance, '')
})

test('external refresh preserves an unsaved story identity and its conflict baseline', () => {
  const draft = { title: '未保存名称', topicId: '8' }
  const baseline = { title: '原名称', topicId: 7 }
  writing.reconcileStoryWritingIdentity(draft, baseline, { title: '其他人的名称', topicId: 9 })
  assert.deepEqual(draft, { title: '未保存名称', topicId: '8' })
  assert.deepEqual(baseline, { title: '原名称', topicId: 7 })
  writing.reconcileStoryWritingIdentity(draft, baseline, { title: '未保存名称', topicId: 8 })
  assert.deepEqual(baseline, { title: '未保存名称', topicId: 8 })
})

test('queued writing identity rebases against its own acknowledged save without dropping the later edit', () => {
  const wrap = state => ({ __components: { 'story-node-workbench': state } })
  const sent = wrap({ title: '第一次修改', baseTitle: '原名称', topicId: '8', baseTopicId: '7' })
  const queued = wrap({ title: '第二次修改', baseTitle: '原名称', topicId: '9', baseTopicId: '7', descriptionAndAcceptance: '后续输入' })
  const rebased = writing.rebaseStoryWritingAcknowledgement(queued, sent, { title: '第一次修改', topicId: 8 })
  assert.deepEqual(rebased.__components['story-node-workbench'], {
    title: '第二次修改', baseTitle: '第一次修改', topicId: '9', baseTopicId: '8', descriptionAndAcceptance: '后续输入',
  })
  assert.equal(queued.__components['story-node-workbench'].baseTitle, '原名称')
  const external = writing.rebaseStoryWritingAcknowledgement(queued, wrap({ title: '原名称', baseTitle: '原名称', topicId: '7', baseTopicId: '7' }), { title: '其他人的名称', topicId: 10 })
  assert.equal(external.__components['story-node-workbench'].baseTitle, '原名称')
})

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

test('story workbench state normalizes and merges per variant without sharing objects', () => {
  const values = { __components: { 'story-node-workbench': { acceptanceCriteria: '标准', legacy: 'keep' }, 'story-testing': { buildVersion: '1' } } }
  const state = normalizeStoryWorkbenchState(values, 'writing')
  assert.deepEqual(state, { acceptanceCriteria: '标准', background: '' })
  state.acceptanceCriteria = '已修改'
  const merged = mergeStoryWorkbenchState(values, 'writing', state)
  assert.deepEqual(merged.__components['story-node-workbench'], { acceptanceCriteria: '已修改', background: '', legacy: 'keep' })
  assert.deepEqual(merged.__components['story-testing'], { buildVersion: '1' })
  assert.equal(values.__components['story-node-workbench'].acceptanceCriteria, '标准')
  assert.deepEqual(Object.keys(STORY_WORKBENCH_FIELDS).sort(), ['acceptance', 'development', 'iteration', 'launch', 'release', 'writing'])
})
