import test from 'node:test'
import assert from 'node:assert/strict'
import { isWorkbenchFilled, areWorkflowFieldsFilled } from './workbench-filled.mjs'

const node = (key, state, config = {}) => ({ fieldValues: { __components: { [key]: state } }, componentConfigs: { [key]: config } })
test('research only requires report content and a saved complete branch', () => {
  const key = 'topic-research'
  const saved = node(key, { needed: 'YES', goal: '比较功能', reportUrl: 'https://example.com/report' })
  assert.equal(isWorkbenchFilled(key, saved), true)
  assert.equal(isWorkbenchFilled(key, saved, {}, true), false)
  for (const state of [{ needed: 'YES', goal: '目标', reportUrl: '' }, { needed: 'YES', goal: '目标', reportUrl: ' ' }, { needed: 'NO', skipReason: ' ' }, {}]) assert.equal(isWorkbenchFilled(key, node(key, state)), false)
  assert.equal(isWorkbenchFilled(key, node(key, { needed: 'YES', goal: '目标', reportUrl: '内部文档/调研报告' })), true)
  assert.equal(isWorkbenchFilled(key, node(key, { needed: 'NO', skipReason: '已有调研' })), true)
})
test('product review does not require optional design or technology reviews', () => {
  const key = 'topic-design-review'
  const state = { productPlanUrl: 'https://example.com/plan', productReviewerIds: [1], productReviewStatus: 'PASSED' }
  assert.equal(isWorkbenchFilled(key, node(key, state)), true)
  assert.equal(isWorkbenchFilled(key, node(key, { ...state, productPlanUrl: '内部产品方案', uiPlanUrl: '设计文件', technicalPlanUrl: '技术文档' })), true)
  assert.equal(isWorkbenchFilled(key, node(key, { ...state, productPlanUrl: '' })), false)
  assert.equal(isWorkbenchFilled(key, node(key, { ...state, productReviewerIds: [] })), false)
  assert.equal(isWorkbenchFilled(key, node(key, { ...state, productReviewStatus: 'PENDING' })), false)
})
test('requirements follow conditional integration and acceptance inputs', () => {
  const key = 'requirement-node-workbench'
  assert.equal(isWorkbenchFilled(key, { ...node(key, { shouldIntegrate: 'NO', requirementSpecification: 'TOPIC' }), name: '需求整合' }), true)
  assert.equal(isWorkbenchFilled(key, { ...node(key, { shouldIntegrate: 'YES', requirementSpecification: 'TOPIC', requirementIds: [] }), name: '需求整合' }), false)
  assert.equal(isWorkbenchFilled(key, { ...node(key, { businessResult: 'PASSED', businessConfirmation: '已确认', residualIssues: [] }), name: '需求验收' }), true)
  assert.equal(isWorkbenchFilled(key, { ...node(key, { businessResult: 'PASSED', businessConfirmation: ' ' }), name: '需求验收' }), false)
})
test('story variants use their own fields and never treat old development fields as complete', () => {
  const key = 'story-node-workbench'
  assert.equal(isWorkbenchFilled(key, node(key, { descriptionAndAcceptance: '描述及验收标准', priority: 'NORMAL' }, { variant: 'writing' }), { title: '故事' }), true)
  assert.equal(isWorkbenchFilled(key, node(key, { descriptionAndAcceptance: '' }, { variant: 'writing' }), { title: '故事' }), false)
  assert.equal(isWorkbenchFilled(key, node(key, { iterationPlanId: '3', developerIds: [1], testerIds: [2] }, { variant: 'iteration' })), true)
  assert.equal(isWorkbenchFilled(key, node(key, { testCases: [{ name: '登录', priority: 'HIGH', expectedResult: '成功' }], mergeStatus: 'MERGED', deployEnv: '测试环境' }, { variant: 'development' })), true)
  assert.equal(isWorkbenchFilled(key, node(key, { implementationNote: '旧内容', selfTestResult: '成功', codeLink: 'https://example.com' }, { variant: 'development' })), false)
})
test('required fields honor hidden and optional fields, bindings, zero, false and dates', () => {
  const fields = [{ key: 'name', type: 'TEXT', required: true }, { key: 'score', type: 'NUMBER', required: true }, { key: 'optional', required: false }, { key: 'hidden', required: true, visible: false }]
  assert.equal(areWorkflowFieldsFilled(fields, { name: '需求', score: 0 }), true)
  assert.equal(areWorkflowFieldsFilled(fields, { name: ' ', score: 0 }), false)
  assert.equal(areWorkflowFieldsFilled([{ key: 'bound', binding: 'requirement.title', required: true }], {}, { bound: '已保存名称' }), true)
  assert.equal(areWorkflowFieldsFilled([{ key: 'date', type: 'DATE_RANGE', required: true }], { date: ['2026-10-06', ''] }), false)
  assert.equal(areWorkflowFieldsFilled([], {}), false)
})
test('empty optional-only testing and unknown components stay neutral', () => {
  assert.equal(isWorkbenchFilled('story-testing', node('story-testing', {})), false)
  assert.equal(isWorkbenchFilled('story-testing', node('story-testing', { reportUrl: 'https://example.com/test', residualIssues: [] })), true)
  assert.equal(isWorkbenchFilled('unknown', node('unknown', { anything: 'value' })), false)
})
test('receiving respects configured required inputs and conditional decision notes', () => {
  const key = 'requirement-receiving-analysis'
  const config = { showAnalysis: true, requireCategory: true, showStrategicFitScore: true, requireStrategicFitScore: true, showDecision: true }
  const state = { category: 'FUNCTIONAL', strategicFitScore: 4, decision: 'PASS' }
  assert.equal(isWorkbenchFilled(key, node(key, state, config)), true)
  assert.equal(isWorkbenchFilled(key, node(key, { ...state, strategicFitScore: null }, config)), false)
  assert.equal(isWorkbenchFilled(key, node(key, { ...state, decision: 'NEEDS_INFO' }, config)), false)
  assert.equal(isWorkbenchFilled(key, node(key, { ...state, decision: 'NEEDS_INFO', supplementNote: '补充业务场景' }, config)), true)
})
test('topic testing uses the same report indicator without requiring optional defects', () => {
  assert.equal(isWorkbenchFilled('story-testing', node('story-testing', { reportUrl: '内部测试报告' })), true)
  assert.equal(isWorkbenchFilled('story-list', node('story-list', { reportUrl: '内部测试报告' }, { testingResultsEnabled: true })), true)
  assert.equal(isWorkbenchFilled('story-list', node('story-list', { reportUrl: 'https://example.com/test' }, { testingResultsEnabled: true })), true)
  assert.equal(isWorkbenchFilled('story-list', node('story-list', {}, { testingResultsEnabled: true })), false)
})
