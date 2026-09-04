import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  allSolutionReviewsPassed,
  isSolutionDecisionComplete,
  isSolutionPackageComplete,
  solutionReviewTypes,
} from './solution-design.ts'

const detailRoot = path.resolve(import.meta.dirname)
const backendRoot = path.resolve(detailRoot, '../../../../../pms-backend')

const completePackage = {
  packageVersion: 'v1.0',
  productSolution: '产品方案',
  technicalSolution: '技术方案',
  summary: '方案摘要',
  scopeCoverage: '覆盖范围',
  rolloutPremise: '上线前提',
}

test('requires a version and five non-empty fields before submitting the solution package', () => {
  assert.equal(isSolutionPackageComplete(completePackage), true)
  assert.equal(isSolutionPackageComplete({ ...completePackage, technicalSolution: ' ' }), false)
  assert.equal(isSolutionPackageComplete({ ...completePackage, packageVersion: '' }), false)
})

test('requires all three fixed reviews before confirming a decision', () => {
  assert.deepEqual(solutionReviewTypes, ['BUSINESS_PRODUCT', 'TECHNICAL', 'TEST_RELEASE'])
  assert.equal(allSolutionReviewsPassed(solutionReviewTypes.map((reviewType) => ({ reviewType, status: 'PASSED' }))), true)
  assert.equal(allSolutionReviewsPassed([{ reviewType: 'BUSINESS_PRODUCT', status: 'PASSED' }]), false)
})

test('requires decision reason and conditions only for a conditional pass', () => {
  assert.equal(isSolutionDecisionComplete({ result: 'PASS', reason: '可行' }), true)
  assert.equal(isSolutionDecisionComplete({ result: 'CONDITIONAL_PASS', reason: '可行' }), false)
  assert.equal(isSolutionDecisionComplete({ result: 'CONDITIONAL_PASS', reason: '可行', conditions: '上线前补齐监控' }), true)
  assert.equal(isSolutionDecisionComplete({ result: 'RETURN_FOR_CHANGES', reason: '' }), false)
})

test('exposes the solution design API endpoints and only mounts its workbench for the design node', () => {
  const api = fs.readFileSync(path.join(detailRoot, '../../../api/node-solution-design.ts'), 'utf8')
  const detail = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')
  assert.match(api, /solution-design/)
  assert.match(api, /reviews\/\$\{reviewType\}\/complete/)
  assert.match(api, /decision\/confirm/)
  assert.match(api, /decision\/reopen/)
  assert.match(detail, /SolutionDesignWorkbench/)
  assert.match(detail, /activeNode\.nodeKey === 'design'/)
  assert.match(detail, /activeNode\.nodeKey === 'requirement'/)
})

test('keeps the design workbench bounded to one package and three review rows', () => {
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/SolutionDesignWorkbench.vue'), 'utf8')
  assert.match(workbench, /方案包|solutionPackage/)
  assert.match(workbench, /BUSINESS_PRODUCT/)
  assert.match(workbench, /TECHNICAL/)
  assert.match(workbench, /TEST_RELEASE/)
  assert.match(workbench, /reopenDecision|重新打开/)
  assert.match(workbench, /!props\.canEdit \|\| !state\.decision\.canEdit/)
  assert.doesNotMatch(workbench, /候选方案|score|upload/i)
})

test('documents the solution design decision gate and its fixed review flow', () => {
  const businessSpec = fs.readFileSync(path.join(backendRoot, 'docs/business-specification.md'), 'utf8')
  const userManual = fs.readFileSync(path.join(detailRoot, '../../../../docs/user-manual.md'), 'utf8')
  assert.match(businessSpec, /方案设计、评审与决策/)
  assert.match(businessSpec, /三类评审/)
  assert.match(businessSpec, /决策确认后锁定/)
  assert.match(userManual, /方案包/)
  assert.match(userManual, /业务\/产品、技术、测试\/发布三类评审/)
  assert.match(userManual, /决策确认/)
})
