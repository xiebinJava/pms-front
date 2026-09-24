import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const detail = fs.readFileSync(new URL('./detail/DevelopmentItemDetailPage.vue', import.meta.url), 'utf8')
const flow = fs.readFileSync(new URL('./detail/components/DevelopmentItemFlow.vue', import.meta.url), 'utf8')

test('development item detail follows the project detail page structure', () => {
  assert.match(detail, /class="detail-breadcrumb"/)
  assert.match(detail, /class="project-detail-page pms-page-stack"/)
  assert.match(detail, /class="development-item-detail__summary project-header pms-detail-panel pms-detail-hero card-surface"/)
  assert.match(flow, /class="flow-card pms-detail-panel pms-section-panel card-surface"/)
  assert.match(detail, /class="node-detail-card pms-detail-panel pms-section-panel card-surface"/)
})

test('workflow cards keep owner and schedule metadata while allowing locked nodes to be inspected', () => {
  assert.match(flow, /node\.ownerName/)
  assert.match(flow, /node\.endDate/)
  assert.match(flow, /@click="emit\('select', node\.id\)"/)
  assert.doesNotMatch(flow, /:disabled=/)
})

test('node details preserve assignment editing, completion, and node-scoped tasks', () => {
  assert.match(detail, /class="node-assignment-row pms-assignment-grid"/)
  assert.match(detail, /class="node-owner-row"[^>]*role="group"/)
  assert.match(detail, /class="node-owner-row node-schedule-row"[^>]*role="group"/)
  assert.doesNotMatch(detail, /@click="saveNode"/)
  assert.match(detail, /@change="onNodeOwnerChange"/)
  assert.match(detail, /@change="onScheduleChange"/)
  assert.match(detail, /@click="confirmCompleteNode"/)
  assert.match(detail, /<DevelopmentItemTaskBoard/)
})

test('historical assignees returned by detail remain selectable for display without project-member loading', () => {
  assert.match(detail, /function collectDetailPeople\(workflow: DevelopmentItemWorkflowDetail\)/)
  assert.match(detail, /add\(node\.ownerId, node\.ownerName\)/)
  assert.match(detail, /add\(task\.assigneeId, task\.assigneeName\)/)
  assert.match(detail, /members\.value = collectDetailPeople\(result\)/)
  assert.doesNotMatch(detail, /getProjectMembers|getMembers\(/)
})

test('node detail headers omit the redundant numbered workflow-node label', () => {
  assert.doesNotMatch(detail, /class="development-item-detail__node-label"/)
})

test('development node template fields autosave when focus leaves the editor or the user clicks outside', () => {
  assert.match(detail, /@focusout\.capture="onNodeFieldsFocusOut"/)
  assert.match(detail, /shouldAutoSaveOnBlur\(nodeFormDirty\.value/)
  assert.match(detail, /shouldAutoSaveProfile\(nodeFormDirty\.value, clickedInsideNodeFields, clickedInsideOverlay\)/)
  assert.match(detail, /document\.addEventListener\('pointerdown', onDocumentPointerDown\)/)
  assert.match(detail, /document\.removeEventListener\('pointerdown', onDocumentPointerDown\)/)
  assert.match(detail, /if \(!nodeFormDirty\.value\) return/)
  assert.match(detail, /nodeFormDirty\.value = false/)
})

test('development node autosave queues edits made while a save is in flight', () => {
  assert.match(detail, /let queuedNodeSave = false/)
  assert.match(detail, /if \(activeNodeSave\) \{\s*queuedNodeSave = true\s*return activeNodeSave/s)
  assert.match(detail, /if \(queuedNodeSave\) \{[\s\S]*void saveNode\(\)/)
})

test('node assignment labels do not retain desktop fixed widths on mobile', () => {
  const mobileStyles = detail.slice(detail.indexOf('@media (max-width: 640px)'))
  assert.match(mobileStyles, /\.node-owner-row__label\s*\{[^}]*flex:\s*0 0 auto/)
})

test('development workflow renders and saves the fields configured on each template node', () => {
  assert.match(detail, /<DevelopmentItemWorkflowFields/)
  assert.match(detail, /:fields="selectedNode\.fields"/)
  assert.match(detail, /:model-value="nodeForm\.fieldValues"/)
  assert.match(detail, /@update:model-value="onNodeFieldValuesChange"/)
  assert.match(detail, /fieldValues:\s*\{ \.\.\.nodeForm\.fieldValues \}/)
})

test('all uncompleted workflow nodes expose editable metadata, template fields, and tasks', () => {
  const board = fs.readFileSync(new URL('./detail/components/DevelopmentItemTaskBoard.vue', import.meta.url), 'utf8')
  assert.match(detail, /const selectedNodeEditable = computed\(\(\) => selectedNode\.value != null && !isNodeReadOnly\(selectedNode\.value\.status\)\)/)
  assert.match(detail, /v-if="selectedNodeEditable"/)
  assert.match(detail, /:disabled="!selectedNodeEditable \|\| savingNode"/)
  assert.match(detail, /if \(!detail\.value \|\| !node \|\| isNodeReadOnly\(node\.status\)\) return Promise\.resolve\(false\)/)
  assert.match(board, /const canEdit = computed\(\(\) => !isNodeReadOnly\(props\.node\.status\)\)/)
})

test('development node tasks use the same three-column Kanban structure as project tasks', () => {
  const board = fs.readFileSync(new URL('./detail/components/DevelopmentItemTaskBoard.vue', import.meta.url), 'utf8')
  assert.match(board, /class="task-board-shell"/)
  assert.match(board, /class="pms-task-column"/)
  assert.match(board, /class="pms-task-card pms-task-card__surface item-task-board__task"/)
  assert.match(board, /groupTasksByStatus/)
  assert.match(board, /openCreate\(undefined, col\.status\)/)
})

test('development detail pages use the shared project-detail color system', () => {
  const board = fs.readFileSync(new URL('./detail/components/DevelopmentItemTaskBoard.vue', import.meta.url), 'utf8')
  const topicStories = fs.readFileSync(new URL('./detail/TopicStorySection.vue', import.meta.url), 'utf8')

  assert.doesNotMatch(detail, /#[0-9a-f]{3,8}/i)
  assert.doesNotMatch(board, /#[0-9a-f]{3,8}/i)
  assert.doesNotMatch(topicStories, /#[0-9a-f]{3,8}/i)
  assert.match(detail, /class="development-item-detail__summary project-header pms-detail-panel pms-detail-hero card-surface"/)
  assert.match(detail, /class="node-detail-card pms-detail-panel pms-section-panel card-surface"/)
  assert.match(flow, /var\(--pms-border\)/)
  assert.match(board, /class="pms-task-column"/)
  assert.match(board, /class="pms-task-card pms-task-card__surface item-task-board__task"/)
})
