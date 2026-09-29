import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const component = fs.readFileSync(new URL('./RequirementReceivingAnalysisComponent.vue', import.meta.url), 'utf8')
const detailPage = fs.readFileSync(new URL('./DevelopmentItemDetailPage.vue', import.meta.url), 'utf8')

test('requirement receiving keeps only category, strategic fit, and receiving decision controls', () => {
  assert.match(component, /需求分类[\s\S]*a-select/)
  assert.match(component, /战略契合度[\s\S]*a-select/)
  assert.match(component, /接收结论[\s\S]*a-select/)
  assert.doesNotMatch(component, /需求过滤|有效性|需求解释|过滤原因|可实现性|ROI|综合价值|分析结论/)
})

test('requirement receiving saves fields automatically without a separate save panel', () => {
  assert.doesNotMatch(component, /保存分析/)
  assert.doesNotMatch(component, /requirement-receiving-analysis__header/)
  assert.match(component, /function requestAutoSave\(\)/)
  assert.match(component, /@change="requestAutoSave"/)
  assert.match(component, /@blur="requestAutoSave"/)
})

test('requirement detail uses the fixed receiving-analysis configuration', () => {
  const configBlock = detailPage.match(/const receivingAnalysisConfig = computed[\s\S]*?\n\}\)/)?.[0] || ''
  assert.match(configBlock, /showFilter:\s*false/)
  assert.match(configBlock, /showAnalysis:\s*true/)
  assert.match(configBlock, /requireCategory:\s*true/)
  assert.match(configBlock, /showStrategicFitScore:\s*true/)
  assert.match(configBlock, /showFeasibilityScore:\s*false/)
  assert.match(configBlock, /showRoiScore:\s*false/)
  assert.match(configBlock, /requireAnalysisConclusion:\s*false/)
})
