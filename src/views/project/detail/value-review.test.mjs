import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { isValueReviewComplete, valueReviewResultStatuses } from './value-review.ts'

const detailRoot = path.resolve(import.meta.dirname)

const completeState = {
  resultStatus: 'ACHIEVED',
  actualResult: '上线后订单处理时长下降。',
  retrospectiveConclusion: '范围控制有效，跨团队同步仍需提前。',
}

test('value review completion requires a conclusion and actual result', () => {
  assert.deepEqual(valueReviewResultStatuses, ['ACHIEVED', 'PARTIAL', 'NOT_ACHIEVED'])
  assert.equal(isValueReviewComplete(completeState), true)
  assert.equal(isValueReviewComplete({ ...completeState, resultStatus: 'PENDING' }), false)
  assert.equal(isValueReviewComplete({ ...completeState, actualResult: '' }), false)
  assert.equal(isValueReviewComplete({ ...completeState, retrospectiveConclusion: '  ' }), false)
})

test('mounts the value review workbench only for the review node and keeps completion manual', () => {
  const page = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')
  const api = fs.readFileSync(path.join(detailRoot, '../../../api/node-value-review.ts'), 'utf8')
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/ValueReviewWorkbench.vue'), 'utf8')

  assert.match(page, /ValueReviewWorkbench/)
  assert.match(page, /activeNode\.nodeKey === 'review'/)
  assert.match(page, /valueReviewCompletionReady\.value/)
  assert.match(page, /detail\.valueReview\.completionRequired/)
  assert.match(api, /nodes\/\$\{nodeId\}\/value-review/)
  assert.match(workbench, /completion-ready/)
  assert.doesNotMatch(workbench, /task-columns/)
  assert.doesNotMatch(workbench, /自动完成节点/)
  assert.match(workbench, /@focusout="handleWorkbenchFocusOut"/)
  assert.match(workbench, /target\.matches\('input, textarea, \[role="combobox"\]'\)/)
  assert.doesNotMatch(workbench, /watch\(state,/)
})
