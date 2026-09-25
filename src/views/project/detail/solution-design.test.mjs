import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  allSolutionReviewsPassed,
  allSolutionReviewsReady,
  canEditSolutionReviews,
  canSubmitSolutionPackage,
  isSolutionDecisionComplete,
  isSolutionPackageComplete,
  shouldAutoConfirmDecision,
  solutionReviewTypes,
} from './solution-design.ts'

const detailRoot = path.resolve(import.meta.dirname)
const backendRoot = path.resolve(detailRoot, '../../../../../pms-backend')

const completePackage = {
  productSolution: '产品方案',
  technicalSolution: '技术方案',
}

test('requires only product and technical solutions before submitting the solution package', () => {
  assert.equal(isSolutionPackageComplete(completePackage), true)
  assert.equal(isSolutionPackageComplete({ ...completePackage, technicalSolution: ' ' }), false)
  assert.equal(isSolutionPackageComplete({ ...completePackage, productSolution: '' }), false)
  assert.equal(isSolutionPackageComplete({ productSolution: null, technicalSolution: null }), false)
})

test('blocks solution package submission until the requirement baseline is confirmed', () => {
  assert.equal(canSubmitSolutionPackage(true, completePackage, { confirmed: true }), true)
  assert.equal(canSubmitSolutionPackage(true, completePackage, { confirmed: false }), false)
  assert.equal(canSubmitSolutionPackage(true, completePackage, undefined), false)
  assert.equal(canSubmitSolutionPackage(false, completePackage, { confirmed: true }), false)
})

test('requires all three fixed reviews before confirming a decision', () => {
  assert.deepEqual(solutionReviewTypes, ['BUSINESS_PRODUCT', 'TECHNICAL', 'TEST_RELEASE'])
  assert.equal(allSolutionReviewsPassed(solutionReviewTypes.map((reviewType) => ({ reviewType, status: 'PASSED' }))), true)
  assert.equal(allSolutionReviewsPassed([{ reviewType: 'BUSINESS_PRODUCT', status: 'PASSED' }]), false)
  assert.equal(allSolutionReviewsReady(solutionReviewTypes.map((reviewType) => ({ reviewType, status: 'PASSED', reviewerId: 7 }))), true)
  assert.equal(allSolutionReviewsReady(solutionReviewTypes.map((reviewType) => ({ reviewType, status: 'PASSED' }))), false)
})

test('allows review details only while the node is editable', () => {
  assert.equal(canEditSolutionReviews(true, false), true)
  assert.equal(canEditSolutionReviews(false, false), false)
  assert.equal(canEditSolutionReviews(true, true), false)
})

test('requires only a decision result and conditions for a conditional pass', () => {
  assert.equal(isSolutionDecisionComplete({ result: 'PASS' }), true)
  assert.equal(isSolutionDecisionComplete({ result: 'CONDITIONAL_PASS' }), false)
  assert.equal(isSolutionDecisionComplete({ result: 'CONDITIONAL_PASS', conditions: '上线前补齐监控' }), true)
  assert.equal(isSolutionDecisionComplete({ result: 'RETURN_FOR_CHANGES' }), true)
})

test('auto-confirms a complete decision only after the submitted package and reviews are ready', () => {
  const reviews = solutionReviewTypes.map((reviewType) => ({ reviewType, status: 'PASSED', reviewerId: 7 }))
  const decision = { result: 'PASS', conditions: '' }
  assert.equal(shouldAutoConfirmDecision(true, 'SUBMITTED', reviews, decision), true)
  assert.equal(shouldAutoConfirmDecision(true, 'DRAFT', reviews, decision), false)
  assert.equal(shouldAutoConfirmDecision(true, 'SUBMITTED', [{ ...reviews[0] }], decision), false)
  assert.equal(shouldAutoConfirmDecision(true, 'SUBMITTED', reviews, { result: undefined }), false)
})

test('exposes the solution design API endpoints and only mounts its workbench for the design node', () => {
  const api = fs.readFileSync(path.join(detailRoot, '../../../api/node-solution-design.ts'), 'utf8')
  const detail = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')
  assert.match(api, /solution-design/)
  assert.match(api, /reviews\/\$\{reviewType\}\/complete/)
  assert.match(api, /reviews\/\$\{reviewType\}\/reviewer/)
  assert.match(api, /updateNodeSolutionReview/)
  assert.match(api, /decision\/confirm/)
  assert.match(api, /saveNodeSolutionDecisionDraft/)
  assert.match(api, /saveNodeSolutionDecisionDraft[\s\S]*http\.put/)
  assert.doesNotMatch(api, /decision\/reopen|reopenNodeSolutionDecision/)
  assert.match(detail, /SolutionDesignWorkbench/)
  assert.match(detail, /nodeHasComponent\(activeNode, 'solution-design'\)/)
  assert.match(detail, /nodeHasComponent\(activeNode, 'requirement-scope'\)/)
})

test('keeps the design workbench bounded to one package and three review rows', () => {
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/SolutionDesignWorkbench.vue'), 'utf8')
  const domain = fs.readFileSync(path.join(detailRoot, '../../../types/domain.ts'), 'utf8')
  assert.match(workbench, /方案包|solutionPackage/)
  assert.match(workbench, /BUSINESS_PRODUCT/)
  assert.match(workbench, /TECHNICAL/)
  assert.match(workbench, /TEST_RELEASE/)
  assert.doesNotMatch(workbench, /reopenDecision|reopenNodeSolutionDecision|重新打开|ReloadOutlined/)
  assert.match(workbench, /!props\.canEdit \|\| !state\.decision\.canEdit/)
  assert.match(workbench, /reviewerOptions|assignReviewer|reviewerId/)
  const template = workbench.slice(workbench.indexOf('<template>'), workbench.indexOf('<style'))
  assert.doesNotMatch(template, /solution-design-upstream/)
  assert.doesNotMatch(template, /solution-design-checklist/)
  assert.doesNotMatch(template, /package\.version|package\.summary|package\.scopeCoverage|package\.rolloutPremise|decision\.reason/)
  assert.doesNotMatch(template, /solution-design-block__state/)
  assert.match(workbench, /<a-input v-model:value="state\.solutionPackage\.productSolution"/)
  assert.match(workbench, /<a-input v-model:value="state\.solutionPackage\.technicalSolution"/)
  assert.match(workbench, /productSolution: next\.solutionPackage\?\.productSolution \?\? ''/)
  assert.match(workbench, /technicalSolution: next\.solutionPackage\?\.technicalSolution \?\? ''/)
  assert.match(workbench, /productSolution\?\.trim\(\)/)
  assert.match(workbench, /technicalSolution\?\.trim\(\)/)
  const personSelect = fs.readFileSync(path.join(detailRoot, 'components/PersonSelect.vue'), 'utf8')
  assert.match(workbench, /PersonSelect/)
  assert.match(personSelect, /show-search/)
  assert.match(personSelect, /option-filter-prop="label"/)
  assert.match(workbench, /t\('detail\.solutionDesign\.reviewerAssigned'\)/)
  assert.match(workbench, /t\('detail\.solutionDesign\.reviewerAssignFailed'\)/)
  assert.doesNotMatch(workbench, /detail\.solutionDesign\.reviews\.reviewer(?:Assigned|AssignFailed)/)
  assert.doesNotMatch(workbench, /候选方案|score|upload/i)
  const packageType = domain.slice(domain.indexOf('export interface NodeSolutionPackage'), domain.indexOf('export type NodeResourceStatus'))
  const decisionType = domain.slice(domain.indexOf('export interface NodeSolutionDecision'), domain.indexOf('export type NodeResourceStatus'))
  assert.doesNotMatch(packageType, /packageVersion|summary|scopeCoverage|rolloutPremise/)
  assert.doesNotMatch(decisionType, /reason/)
  assert.match(workbench, /assigningType/)
})

test('captures optional review suggestions and hides the decision confirmation date', () => {
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/SolutionDesignWorkbench.vue'), 'utf8')
  const template = workbench.slice(workbench.indexOf('<template>'), workbench.indexOf('<style'))
  assert.match(template, /review\.comment/)
  assert.match(workbench, /completeNodeSolutionReview\([^)]*review\.comment/)
  assert.match(template, /detail\.solutionDesign\.reviews\.suggestion/)
  assert.match(template, /detail\.solutionDesign\.reviews\.suggestionPlaceholder/)
  assert.match(template, /<a-input[\s\S]*v-model:value="review\.comment"[\s\S]*@blur="saveReviewSuggestion\(review\)"/)
  assert.doesNotMatch(template, /a-popover/)
  const suggestionIndex = template.indexOf('solution-design-review-row__suggestion')
  const reviewerIndex = template.indexOf('solution-design-review-row__reviewer')
  assert.ok(suggestionIndex >= 0 && suggestionIndex < reviewerIndex)
  assert.match(template, /@blur="saveReviewSuggestion\(review\)"/)
  assert.doesNotMatch(template, /:disabled="[^\"]*review\.status === 'PASSED'/)
  assert.doesNotMatch(template, /detail\.solutionDesign\.package\.(?:submitted|draft)/)
  assert.doesNotMatch(template, /detail\.solutionDesign\.description/)
  assert.doesNotMatch(template, /solution-design-field--wide/)
  assert.doesNotMatch(template, /decision\.confirmedAt/)
  assert.doesNotMatch(template, /solution-design-decision-date/)
})

test('keeps decision controls aligned at the same compact height', () => {
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/SolutionDesignWorkbench.vue'), 'utf8')
  const template = workbench.slice(workbench.indexOf('<template>'), workbench.indexOf('<style'))
  assert.match(template, /<a-textarea[\s\S]*class="solution-design-decision__conditions"[\s\S]*:rows="1"/)
  assert.match(workbench, /solution-design-decision :deep\(\.ant-select-arrow\)/)
})

test('persists package and decision fields automatically without redundant action controls', () => {
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/SolutionDesignWorkbench.vue'), 'utf8')
  const template = workbench.slice(workbench.indexOf('<template>'), workbench.indexOf('<style'))
  assert.match(workbench, /schedulePackagePersistence/)
  assert.match(workbench, /scheduleDecisionPersistence/)
  assert.match(workbench, /saveNodeSolutionDecisionDraft/)
  assert.match(template, /@focusout="handleWorkbenchFocusOut"/)
  assert.match(workbench, /target\.matches\('input, textarea, \[role="combobox"\]'\)/)
  assert.doesNotMatch(template, /@input="schedulePackagePersistence"/)
  assert.doesNotMatch(template, /@input="scheduleDecisionPersistence"/)
  assert.doesNotMatch(template, /detail\.solutionDesign\.package\.(?:saveDraft|submit)/)
  assert.doesNotMatch(template, /detail\.solutionDesign\.decision\.pending/)
  assert.doesNotMatch(template, /@click="confirmDecision"/)
  const persistDecision = workbench.slice(workbench.indexOf('async function persistDecision'), workbench.indexOf('async function completeReview'))
  assert.match(persistDecision, /await saveDecisionDraft\(\)/)
  assert.ok(persistDecision.indexOf('await saveDecisionDraft()') < persistDecision.indexOf('await confirmDecision()'))
})

test('documents the solution design decision gate and its fixed review flow', () => {
  const userManual = fs.readFileSync(path.join(detailRoot, '../../../../docs/user-manual.md'), 'utf8')
  assert.match(userManual, /方案包/)
  assert.match(userManual, /业务\/产品、技术、测试\/发布三类评审/)
  assert.match(userManual, /决策确认/)

  // Sibling backend checkout exists locally, but frontend CI only has this repo.
  const specPath = path.join(backendRoot, 'docs/business-specification.md')
  if (!fs.existsSync(specPath)) {
    return
  }
  const businessSpec = fs.readFileSync(specPath, 'utf8')
  assert.match(businessSpec, /方案设计、评审与决策/)
  assert.match(businessSpec, /三类评审/)
  assert.match(businessSpec, /决策确认后锁定/)
})
