import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const detail = fs.readFileSync(new URL('./detail/DevelopmentItemDetailPage.vue', import.meta.url), 'utf8')
const flow = fs.readFileSync(new URL('./detail/components/DevelopmentItemFlow.vue', import.meta.url), 'utf8')
const fields = fs.readFileSync(new URL('./detail/components/DevelopmentItemWorkflowFields.vue', import.meta.url), 'utf8')
const api = fs.readFileSync(new URL('../../api/development-item.ts', import.meta.url), 'utf8')

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
  assert.match(detail, /@click="completeSelectedNode"/)
  assert.match(detail, /@click="confirmRollbackNode"/)
  assert.match(detail, /<DevelopmentItemTaskBoard/)
})

test('development node completion runs directly without a confirmation dialog', () => {
  const completionBlock = detail.slice(detail.indexOf('async function completeSelectedNode'), detail.indexOf('\nasync function autoCompleteDevelopmentNode'))
  assert.match(completionBlock, /async function completeSelectedNode\(\)/)
  assert.doesNotMatch(completionBlock, /Modal\.confirm/)
  assert.match(completionBlock, /saveAllNodeEdits\(\)/)
  assert.match(completionBlock, /completeDevelopmentItemNode\(/)
})

test('completed development nodes keep project-style disabled assignment controls', () => {
  const assignments = detail.slice(detail.indexOf('<template #assignments>'), detail.indexOf('<template #fields>'))
  assert.match(assignments, /<PersonSelect[\s\S]*:disabled="!selectedNodeEditable \|\| savingNode"/)
  assert.match(assignments, /<a-range-picker[\s\S]*:disabled="!selectedNodeEditable \|\| savingNode"/)
  assert.doesNotMatch(assignments, /<strong v-else>/)
})

test('completed development nodes expose the same reason-based rollback contract as projects', () => {
  assert.match(api, /export function rollbackDevelopmentItemNode\(/)
  assert.match(api, /nodes\/\$\{nodeId\}\/rollback/)
  assert.match(api, /\{ reason \}/)
  assert.match(detail, /const rollingBack = ref\(false\)/)
  assert.match(detail, /rollbackDevelopmentItemNode\(/)
  assert.match(detail, /rollbackReason/)
  assert.match(detail, /回滚原因不能为空|rollbackReasonRequired/)
  const rollbackHandler = detail.slice(detail.indexOf('async function submitRollbackNode'), detail.indexOf('\nfunction onDetailUpdated'))
  assert.doesNotMatch(rollbackHandler, /saveNode\(\)/)
})

test('node header keeps completion and rollback actions at the right edge by status', () => {
  const header = detail.slice(detail.indexOf('<template #header>'), detail.indexOf('</template>', detail.indexOf('<template #header>')))
  assert.match(header, /class="node-detail-actions"/)
  assert.match(header, /v-if="selectedNode\.status === 2"[\s\S]*confirmRollbackNode/)
  assert.match(header, /v-else-if="selectedNode\.status === 1(?: && !detail\.terminalStatus)?"[\s\S]*completeSelectedNode/)
  assert.doesNotMatch(header, /selectedNode\.status === 0[\s\S]*@click/)
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
  assert.match(detail, /:bound-values="selectedNode\.boundFieldValues \|\| \{\}"/)
  assert.match(detail, /:model-value="nodeForm\.fieldValues"/)
  assert.match(detail, /@update:model-value="onNodeFieldValuesChange"/)
  assert.match(detail, /fieldValues:\s*\{ \.\.\.nodeForm\.fieldValues \}/)
})

test('development workflow fields render template bindings from the item record', () => {
  assert.match(fields, /boundValues: Record<string, unknown>/)
  assert.match(fields, /Object\.prototype\.hasOwnProperty\.call\(props\.modelValue, field\.key\)/)
  assert.match(fields, /return props\.disabled/)
  assert.doesNotMatch(fields, /isEditableBinding/)
  assert.doesNotMatch(fields, /visibleFields = computed\(\(\) => props\.fields\.filter\(\(field\) => field\.visible !== false && !field\.binding\)\)/)
})

test('development workflow field controls forward their emitted values to the form model', () => {
  assert.equal((fields.match(/@change="setValue\(field\.key, \$event \?\? null\)"/g) || []).length, 5)
  assert.match(fields, /@update:model-value="setValue\(field\.key, \$event\)"/)
  assert.doesNotMatch(fields, /@(change|update:model-value)="(?:valueChangeHandler|dateChangeHandler|rangeChangeHandler)\(field\.key\)"/)
})

test('workflow nodes expose editable metadata, template fields, and tasks with lifecycle guards', () => {
  const board = fs.readFileSync(new URL('./detail/components/DevelopmentItemTaskBoard.vue', import.meta.url), 'utf8')
  assert.match(detail, /const selectedNodeEditable = computed\(\(\) => selectedNode\.value != null\s*&& !isNodeReadOnly\(selectedNode\.value\.status\)\s*&& !detail\.value\?\.terminalStatus && !completingNode\.value\s*\)/)
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

test('topic story splitting is rendered as a node-scoped runtime component', () => {
  const split = fs.readFileSync(new URL('./detail/DevelopmentStorySplitComponent.vue', import.meta.url), 'utf8')
  assert.match(detail, /DevelopmentStorySplitComponent/)
  assert.match(detail, /componentKey === WorkflowRuntimeComponentKey\.STORY_SPLIT/)
  assert.match(detail, /:node-id="selectedNode\.id"/)
  assert.match(detail, /:can-edit="selectedNodeEditable"/)
  assert.doesNotMatch(detail, /<TopicStorySection/)
  assert.match(split, /getDevelopmentTopicStories/)
  assert.match(split, /story\.topicWorkflowNodeId === props\.nodeId/)
  assert.match(split, /canEdit: boolean/)
  assert.match(split, /v-if="canEdit"/)
  assert.match(split, /development\/stories\//)
  assert.match(split, /:lock-topic="true"/)
})

test('topic detail renders the configurable story list workbench with scoped creation and status filtering', () => {
  const storyList = fs.readFileSync(new URL('./detail/DevelopmentStoryListComponent.vue', import.meta.url), 'utf8')
  assert.match(detail, /DevelopmentStoryListComponent/)
  assert.match(detail, /componentKey === WorkflowRuntimeComponentKey\.STORY_LIST/)
  assert.match(detail, /:topic-id="detail\.id"/)
  assert.match(detail, /:node-id="selectedNode\.id"/)
  assert.match(storyList, /getDevelopmentTopicStories/)
  assert.match(storyList, /searchKeyword/)
  assert.match(storyList, /statusFilter/)
  assert.match(storyList, /DevelopmentStoryEditModal/)
  assert.match(storyList, /:lock-topic="true"/)
  assert.match(storyList, /storyListTitle/)
})
