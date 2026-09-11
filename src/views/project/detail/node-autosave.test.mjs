import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const componentRoot = path.join(path.resolve(import.meta.dirname), 'components')

const workbenches = [
  ['RequirementScopeWorkbench.vue', 'detail.requirementScope.saveDraft', 'detail.requirementScope.confirmBaseline'],
  ['PlanResourceRiskWorkbench.vue', 'detail.planResourceRisk.saveDraft', 'detail.planResourceRisk.confirmBaseline'],
  ['AcceptanceWorkbench.vue', 'detail.acceptance.saveDraft', 'detail.acceptance.confirm'],
  ['ReleaseDecisionHandoverWorkbench.vue', 'detail.release.saveDraft', null],
  ['ValueReviewWorkbench.vue', 'detail.valueReview.saveDraft', null],
]

test('node workbenches use local editing with an explicit persistence trigger', () => {
  for (const [filename, saveKey, confirmKey] of workbenches) {
    const source = fs.readFileSync(path.join(componentRoot, filename), 'utf8')
    const template = source.slice(source.indexOf('<template>'), source.indexOf('<style'))

    assert.doesNotMatch(template, new RegExp(`${saveKey.replaceAll('.', '\\.')}'`))
    if (confirmKey) assert.doesNotMatch(template, new RegExp(`${confirmKey.replaceAll('.', '\\.')}'`))
    if (filename === 'ReleaseDecisionHandoverWorkbench.vue') {
      assert.match(source, /@focusout="handleWorkbenchFocusOut"/)
      assert.match(source, /target\.matches\('input, textarea, \[role="combobox"\]'\)/)
      assert.doesNotMatch(source, /document\.addEventListener|pointerdown|handleDocumentPointerDown/)
      assert.doesNotMatch(source, /scheduleAutoSave|persistAutoSave/)
    } else {
      assert.match(source, /scheduleAutoSave/)
      assert.match(source, /@focusout="handleWorkbenchFocusOut"/)
      assert.match(source, /target\.matches\('input, textarea, \[role="combobox"\]'\)/)
      assert.doesNotMatch(source, /watch\(state,/)
    }
  }
})

test('development control waits for explicit confirmation before updating the page', () => {
  const source = fs.readFileSync(path.join(componentRoot, 'DevelopmentControlWorkbench.vue'), 'utf8')
  const template = source.slice(source.indexOf('<template>'), source.indexOf('<style'))

  assert.doesNotMatch(source, /scheduleAutoSave|persistAutoSave|watch\(draftTopic/)
  assert.match(template, /development-control__editor-actions/)
  assert.match(template, /@click="saveEditor"/)
  assert.match(source, /editorOpen\.value = false/)
  assert.match(source, /applyState\(next\)/)
})

test('completion flushes node autosave before lifecycle checks without a manual baseline prompt', () => {
  const page = fs.readFileSync(path.join(path.resolve(import.meta.dirname), 'index.vue'), 'utf8')
  const completionBlock = page.slice(page.indexOf('async function onComplete'), page.indexOf('async function refreshAfterLifecycle'))

  assert.match(completionBlock, /requirementScopeRef\.value\?\.flushAutoSave\(\)/)
  assert.match(completionBlock, /planResourceRiskRef\.value\?\.flushAutoSave\(\)/)
  assert.match(completionBlock, /acceptanceRef\.value\?\.flushAutoSave\(\)/)
  assert.doesNotMatch(completionBlock, /requirementBaselineRequired|planBaselineRequired|acceptanceRequired/)
})

test('uses node rollback as the only unlock path for confirmed workbenches', () => {
  const detailRoot = path.resolve(import.meta.dirname)
  const apiFiles = [
    'node-requirement-scope.ts',
    'node-plan-resource-risk.ts',
    'node-acceptance.ts',
    'node-solution-design.ts',
  ]
  const workbenchFiles = [
    'RequirementScopeWorkbench.vue',
    'PlanResourceRiskWorkbench.vue',
    'AcceptanceWorkbench.vue',
    'SolutionDesignWorkbench.vue',
  ]

  for (const filename of apiFiles) {
    const source = fs.readFileSync(path.join(detailRoot, '../../../api', filename), 'utf8')
    assert.doesNotMatch(source, /reopen|\/reopen/)
  }
  for (const filename of workbenchFiles) {
    const source = fs.readFileSync(path.join(componentRoot, filename), 'utf8')
    assert.doesNotMatch(source, /onReopen|reopenDecision|reopening|ReloadOutlined|重新打开/)
    assert.match(source, /nodeReadOnly/)
  }
})
