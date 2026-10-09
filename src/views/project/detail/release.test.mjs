import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import * as releasePresentation from './release.ts'

const { isReleaseComplete } = releasePresentation

const completeState = {
  handoverOwnerId: 42,
  handoverNotes: '运维已接收发布说明。',
}

test('completed release nodes show completed instead of ready when release data is complete', () => {
  assert.equal(releasePresentation.getReleaseWorkbenchStatus?.({ nodeStatus: 2, completionReady: true }), 'completed')
})

test('terminated release nodes do not show a completion-ready label', () => {
  assert.equal(releasePresentation.getReleaseWorkbenchStatus?.({ nodeStatus: 3, completionReady: true }), 'terminated')
})

test('active release nodes show ready only when required release data is complete', () => {
  assert.equal(releasePresentation.getReleaseWorkbenchStatus?.({ nodeStatus: 1, completionReady: true }), 'ready')
  assert.equal(releasePresentation.getReleaseWorkbenchStatus?.({ nodeStatus: 1, completionReady: false }), 'draft')
})

test('release completion requires a handover owner and handover notes', () => {
  assert.equal(isReleaseComplete(completeState), true)
  assert.equal(isReleaseComplete({ ...completeState, handoverOwnerId: undefined }), false)
  assert.equal(isReleaseComplete({ ...completeState, handoverNotes: '' }), false)
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
  assert.match(page, /nodeHasComponent\(activeNode, 'release-handover'\)/)
  assert.match(page, /releaseCompletionReady\.value/)
  assert.match(page, /detail\.release\.completionRequired/)
  assert.match(api, /nodes\/\$\{nodeId\}\/release/)
})

test('renders only iteration-derived versions and handover notes', () => {
  const detailRoot = path.resolve(import.meta.dirname)
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/ReleaseDecisionHandoverWorkbench.vue'), 'utf8')
  assert.match(workbench, /detail\.release\.infoTitle/)
  assert.match(workbench, /detail\.release\.handoverTitle/)
  assert.match(workbench, /getIterationPlans/)
  assert.match(workbench, /iteration\.systemName/)
  assert.match(workbench, /iteration\.systemVersionNo/)
  assert.match(workbench, /PersonSelect/)
  assert.match(workbench, /state\.handoverOwnerId/)
  assert.match(workbench, /handoverOwnerName/)
  assert.match(workbench, /handoverOwnerUsername/)
  assert.match(workbench, /handoverOwnerDisplay/)
  assert.match(workbench, /completion-ready/)
  assert.doesNotMatch(workbench, /detail\.release\.checklistTitle/)
  assert.doesNotMatch(workbench, /release-checklist/)
  assert.doesNotMatch(workbench, /state\.releaseVersion/)
  assert.doesNotMatch(workbench, /state\.releaseWindowStart|state\.releaseWindowEnd|state\.releaseType/)
  assert.doesNotMatch(workbench, /state\.decisionResult|state\.decisionNote/)
  assert.doesNotMatch(workbench, /state\.observationItems/)
  assert.doesNotMatch(workbench, /state\.emergencyContact/)
  assert.doesNotMatch(workbench, /rollbackReady|monitoringConfirmed|onCallConfirmed/)
  assert.doesNotMatch(workbench, /detail\.release\.window|detail\.release\.type|detail\.release\.decisionTitle/)
  assert.doesNotMatch(workbench, /releaseVersion|releaseWindowStart|releaseWindowEnd|releaseType|packageReady|configConfirmed|rollbackReady|monitoringConfirmed|onCallConfirmed|decisionResult|decisionNote|observationItems|emergencyContact/)
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

test('saves the release draft before completing the lifecycle node without confirmation', () => {
  const detailRoot = path.resolve(import.meta.dirname)
  const page = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/ReleaseDecisionHandoverWorkbench.vue'), 'utf8')
  const completionBlock = page.slice(page.indexOf('async function onComplete'), page.indexOf('async function refreshAfterLifecycle'))

  assert.match(page, /const releaseWorkbenchRef = ref<\{ saveDraft: \(\) => Promise<boolean> \} \| null>\(null\)/)
  assert.match(page, /ref="releaseWorkbenchRef"/)
  assert.match(completionBlock, /const nodeToComplete = activeNode\.value/)
  assert.match(completionBlock, /const saved = await releaseWorkbenchRef\.value\?\.saveDraft\(\)/)
  assert.match(completionBlock, /if \(!saved\) return/)
  assert.doesNotMatch(completionBlock, /Modal\.confirm/)
  assert.match(completionBlock, /submitting\.value = true/)
  assert.match(completionBlock, /completeNode\(projectId\.value, nodeToComplete\.id\)/)
  assert.match(workbench, /async function saveDraft\(showSuccess = false\): Promise<boolean>/)
  assert.match(workbench, /defineExpose\(\{ saveDraft \}\)/)
  assert.match(workbench, /handleWorkbenchFocusOut/)
  assert.doesNotMatch(workbench, /detail\.release\.saveDraft'/)
})
