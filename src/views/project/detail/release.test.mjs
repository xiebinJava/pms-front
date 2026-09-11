import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { isReleaseComplete } from './release.ts'

const completeState = {
  releaseVersion: 'v2.6.0',
  releaseWindowStart: '2026-09-26T20:00:00',
  releaseWindowEnd: '2026-09-26T22:00:00',
  releaseType: 'GRAY',
  packageReady: true,
  configConfirmed: true,
  rollbackReady: true,
  monitoringConfirmed: true,
  onCallConfirmed: true,
  decisionResult: 'APPROVED',
  handoverNotes: '运维已接收发布说明。',
  observationItems: '重点观察订单错误率。',
  emergencyContact: '值班电话 400-000-0000',
}

test('release completion requires release information, decision, and handover fields', () => {
  assert.equal(isReleaseComplete(completeState), true)
  assert.equal(isReleaseComplete({
    ...completeState,
    packageReady: false,
    configConfirmed: false,
    rollbackReady: false,
    monitoringConfirmed: false,
    onCallConfirmed: false,
  }), true)
  assert.equal(isReleaseComplete({ ...completeState, decisionResult: 'PENDING' }), false)
  assert.equal(isReleaseComplete({ ...completeState, emergencyContact: '' }), false)
})

test('release completion stays manual and is not derived from task progress', () => {
  assert.equal(isReleaseComplete({ ...completeState, taskCount: 0, completedTaskCount: 0 }), true)
  assert.equal(isReleaseComplete({ ...completeState, taskCount: 10, completedTaskCount: 0 }), true)
})

test('mounts the release workbench only for the release node and uses the lifecycle gate', () => {
  const detailRoot = path.resolve(import.meta.dirname)
  const page = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')
  const api = fs.readFileSync(path.join(detailRoot, '../../../api/node-release.ts'), 'utf8')
  assert.match(page, /ReleaseDecisionHandoverWorkbench/)
  assert.match(page, /activeNode\.nodeKey === 'release'/)
  assert.match(page, /releaseCompletionReady\.value/)
  assert.match(page, /detail\.release\.completionRequired/)
  assert.match(api, /nodes\/\$\{nodeId\}\/release/)
})

test('does not render the removed launch checklist in the release workbench', () => {
  const detailRoot = path.resolve(import.meta.dirname)
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/ReleaseDecisionHandoverWorkbench.vue'), 'utf8')
  assert.match(workbench, /detail\.release\.infoTitle/)
  assert.match(workbench, /detail\.release\.decisionTitle/)
  assert.match(workbench, /detail\.release\.handoverTitle/)
  assert.match(workbench, /completion-ready/)
  assert.doesNotMatch(workbench, /detail\.release\.checklistTitle/)
  assert.doesNotMatch(workbench, /release-checklist/)
  assert.doesNotMatch(workbench, /完成节点/)
  assert.doesNotMatch(workbench, /task-columns/)
})

test('saves release drafts when an editable control loses focus', () => {
  const detailRoot = path.resolve(import.meta.dirname)
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/ReleaseDecisionHandoverWorkbench.vue'), 'utf8')

  assert.match(workbench, /@focusout="handleWorkbenchFocusOut"/)
  assert.match(workbench, /target\.matches\('input, textarea, \[role="combobox"\]'\)/)
  assert.doesNotMatch(workbench, /document\.addEventListener|pointerdown|handleDocumentPointerDown/)
  assert.doesNotMatch(workbench, /scheduleAutoSave|persistAutoSave/)
})

test('saves the release draft before opening the lifecycle completion confirmation', () => {
  const detailRoot = path.resolve(import.meta.dirname)
  const page = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/ReleaseDecisionHandoverWorkbench.vue'), 'utf8')
  const completionBlock = page.slice(page.indexOf('async function onComplete'), page.indexOf('async function refreshAfterLifecycle'))

  assert.match(page, /const releaseWorkbenchRef = ref<\{ saveDraft: \(\) => Promise<boolean> \} \| null>\(null\)/)
  assert.match(page, /ref="releaseWorkbenchRef"/)
  assert.match(completionBlock, /const nodeToComplete = activeNode\.value/)
  assert.match(completionBlock, /const saved = await releaseWorkbenchRef\.value\?\.saveDraft\(\)/)
  assert.match(completionBlock, /if \(!saved\) return/)
  assert.ok(completionBlock.indexOf('const saved = await releaseWorkbenchRef.value?.saveDraft()') < completionBlock.indexOf('Modal.confirm'))
  assert.match(completionBlock, /completeNode\(projectId\.value, nodeToComplete\.id\)/)
  assert.match(workbench, /async function saveDraft\(showSuccess = false\): Promise<boolean>/)
  assert.match(workbench, /defineExpose\(\{ saveDraft \}\)/)
  assert.match(workbench, /handleWorkbenchFocusOut/)
  assert.doesNotMatch(workbench, /detail\.release\.saveDraft'/)
})
