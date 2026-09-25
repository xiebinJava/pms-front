import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const detail = fs.readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
const card = fs.readFileSync(new URL('./components/ProjectReadinessCard.vue', import.meta.url), 'utf8')
const taskKanban = fs.readFileSync(new URL('./components/TaskKanban.vue', import.meta.url), 'utf8')

test('places the compact readiness summary inside the project header', () => {
  const header = detail.slice(detail.indexOf('<section class="project-header'), detail.indexOf('<section class="flow-card'))
  assert.match(header, /<ProjectReadinessCard/)
  assert.match(header, /project-header__insights/)
  assert.doesNotMatch(detail.slice(detail.indexOf('<ProjectReadinessCard'), detail.indexOf('<section class="flow-card')), /project-readiness-card pms-detail-panel/)
})

test('opens all project attention items in a modal instead of expanding the page inline', () => {
  assert.match(card, /<a-modal/)
  assert.doesNotMatch(card, /project-readiness-summary__view-all/)
  assert.match(card, /v-if="!visibleItems\.length"/)
  assert.doesNotMatch(card, /expanded = ref\(false\)/)
  assert.doesNotMatch(card, /v-if="expanded" class="project-readiness-card__list"/)
})

test('compresses readiness details into inline action chips', () => {
  assert.match(card, /project-readiness-summary/)
  assert.match(card, /v-if="criticalCount"/)
  assert.match(card, /project-readiness-summary__chip--critical/)
  assert.match(card, /project-readiness-summary__chip--warning/)
  assert.match(card, /project-readiness-summary__next-action/)
  assert.match(card, /height: 24px/)
  assert.match(card, /padding: 0 7px/)
  assert.doesNotMatch(card, /project-readiness-summary__view-all/)
  assert.doesNotMatch(card, /project-readiness-card__metrics/)
  assert.doesNotMatch(card, /project-readiness-card__next-panel/)
})

test('filters future-node issues from readiness counts, next action, and details', () => {
  assert.match(card, /isCurrentNodeAction/)
  assert.match(card, /const visibleItems = computed\(\(\) => readiness\.value\.items\.filter\(isCurrentNodeAction\)\)/)
  assert.match(card, /const criticalCount = computed\(\(\) => visibleItems\.value\.filter/)
  assert.match(card, /const warningCount = computed\(\(\) => visibleItems\.value\.filter/)
  assert.match(card, /v-for="item in visibleItems"/)
})

test('puts the node before its issue status and colors the marker by severity', () => {
  assert.match(card, /item\.nodeName \|\| item\.taskName \|\| item\.title/)
  assert.match(card, /<small>\{\{ item\.title \}\}<\/small>/)
  assert.match(card, /project-readiness-summary__item\.is-warning \.project-readiness-summary__item-dot/)
  assert.match(card, /\.is-warning \.project-readiness-summary__item-dot \{\s*background: var\(--pms-status-active\)/)
  assert.match(card, /project-readiness-summary__item\.is-info \.project-readiness-summary__item-dot/)
})

test('shows the backend action label for each reminder item', () => {
  assert.match(card, /function actionLabel\(item: ProjectActionItem\)/)
  assert.match(card, /if \(!item\.canAct\) return t\('detail\.attentionView'\)/)
  assert.match(card, /return item\.actionLabel \|\| t\('detail\.attentionAction'\)/)
  assert.match(card, /\{\{ actionLabel\(item\) \}\}/)
})

test('refreshes project readiness after a node schedule is saved', () => {
  const scheduleSave = detail.slice(
    detail.indexOf('async function persistNodeSchedule'),
    detail.indexOf('async function onNodeScheduleChange'),
  )
  assert.match(scheduleSave, /await refreshProjectReadiness\(\)/)
  assert.doesNotMatch(scheduleSave, /await getProject\(projectId\.value\)/)
})

test('refreshes project readiness after task progress changes', () => {
  const taskProgress = detail.slice(
    detail.indexOf('function onTaskProgress'),
    detail.indexOf('function onCreateTaskFromRequirement'),
  )
  assert.match(detail, /async function refreshProjectReadiness/)
  assert.match(detail, /project\.value = refreshedProject/)
  assert.match(taskProgress, /void refreshProjectReadiness\(\)/)
})

test('refreshes project readiness after a node owner is updated', () => {
  const ownerSave = detail.slice(
    detail.indexOf('async function onNodeOwnerChange'),
    detail.indexOf('function onNodeOwnerSelection'),
  )
  assert.match(ownerSave, /void refreshProjectReadiness\(\)/)
})

test('reopens a focused task when the task query changes on an already loaded board', () => {
  assert.match(taskKanban, /watch\(\(\) => props\.focusTaskId/)
  assert.match(taskKanban, /consumedFocusId\.value = null/)
  assert.match(taskKanban, /hasLoadedOnce\.value/)
  assert.match(taskKanban, /void maybeOpenFocusedTask\(\)/)
  assert.match(taskKanban, /focused\.projectId !== requestedProjectId/)
  assert.match(taskKanban, /focused\.nodeId !== requestedNodeId/)
  assert.match(taskKanban, /focusSequence/)
})

test('refreshes project readiness after automatic default owner writes', () => {
  const ownerDefaults = detail.slice(
    detail.indexOf('async function persistDefaultNodeOwners'),
    detail.indexOf('function markMembersDirty'),
  )
  assert.match(ownerDefaults, /void refreshProjectReadiness\(\)/)
})

test('keeps parent task focus request-scoped and retries after node switching settles', () => {
  const focusTask = detail.slice(
    detail.indexOf('async function applyFocusTask'),
    detail.indexOf('async function applyFocusNode'),
  )
  assert.match(focusTask, /const requestedTaskId = focusTaskId\.value/)
  assert.match(focusTask, /requestedTaskId !== focusTaskId\.value/)
  assert.match(focusTask, /requestedProjectId !== projectId\.value/)
  assert.match(detail, /watch\(switchingNode, \(switching\)/)
  assert.match(detail, /if \(!switching && focusTaskId\.value\) void applyFocusTask\(\)/)
})
