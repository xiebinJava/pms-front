import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  canRollbackNode,
  buildTaskPayload,
  getFlowNodeState,
  getNodeDetailFields,
  getNodeProgress,
  getNodeStatusMeta,
  getNodeOwnerDisplay,
  defaultNodeOwnerId,
  listDefaultNodeOwnerAssignments,
  shouldAssignDefaultNodeOwner,
  getNodeScopedParams,
  getMissingKickoffProfileFields,
  formatPersonLabel,
  buildBusinessLineOptions,
  filterBusinessLineOptions,
  getBusinessLineDisplay,
  getBusinessLineLabels,
  getBusinessLineTreeRows,
  hoverBusinessLinePath,
  findOrgUnitById,
  getOrgUnitPath,
  getProjectManagerDisplay,
  getProjectOverallProgress,
  getProjectProfileFields,
  getPersonDisplay,
  getSinglePersonSelection,
  listPersonSelectOptions,
  pickFallbackPeople,
  readRecentPeople,
  rememberRecentPeople,
  RECENT_PERSON_LIMIT,
  isSelectableAccount,
  mergeMemberIdsAfterRefresh,
  getProjectStatusTone,
  normalizeRequiredReason,
  isKickoffNode,
  isNodeReadOnly,
  moveTaskStatus,
  shouldReloadNodeTasks,
  splitNodeItems,
  shouldAutoSaveProfile,
  sortTasksByPriority,
} from './workflow.ts'
import {
  getProjectStatusLabel,
  milestoneStatusTagColor,
  nodeStatusTagColor,
  ProjectStatus,
  projectStatusTagColor,
  taskStatusTagColor,
} from '../../../enums/index.ts'

const detailRoot = path.resolve(import.meta.dirname)

test('task board keeps drag surfaces and an accessible delete affordance', () => {
  const source = fs.readFileSync(path.join(detailRoot, 'components/TaskKanban.vue'), 'utf8')
  assert.match(source, /:draggable="Boolean\(task\.permissions\?\.canMove && !nodeReadOnly\)"/)
  assert.match(source, /class="[^"]*pms-task-card__delete[^"]*"[^>]*:aria-label=/)
  assert.match(source, /class="pms-task-card__actions"/)
})

test('project collaboration controls consume backend capabilities', () => {
  const list = fs.readFileSync(path.resolve(detailRoot, '../list/index.vue'), 'utf8')
  const detail = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')
  const kanban = fs.readFileSync(path.join(detailRoot, 'components/TaskKanban.vue'), 'utf8')
  const comments = fs.readFileSync(path.join(detailRoot, 'components/Comments.vue'), 'utf8')
  const workPanel = fs.readFileSync(path.join(detailRoot, 'components/TaskWorkPanel.vue'), 'utf8')
  assert.match(list, /userStore\.can\('project:create'\)/)
  assert.match(list, /v-if="canCreateProject"[^>]*class="[^"]*pms-primary-button[^"]*"/)
  assert.match(detail, /canManageMembers/)
  assert.match(detail, /canSetProjectManager/)
  assert.match(detail, /if \(canManageMembers\.value && profileMembersDirty\.value\)/)
  assert.match(detail, /if \(canSetProjectManager\.value && profileForm\.projectManagerId != null\)/)
  assert.match(comments, /v-if="canWrite"/)
  assert.match(comments, /v-if="item\.canDelete"/)
  assert.match(workPanel, /v-if="canWriteComment"/)
  assert.match(workPanel, /v-if="item\.canDelete"/)
  assert.match(workPanel, /v-if="item\.canDelete"[^>]*type="text"[^>]*size="small"[^>]*danger/)
  assert.match(kanban, /Boolean\(props\.node\.permissions\?\.canManageTasks\)/)
})

test('subtasks expose an editable status control backed by task capabilities', () => {
  const workPanel = fs.readFileSync(path.join(detailRoot, 'components/TaskWorkPanel.vue'), 'utf8')
  assert.match(workPanel, /TaskStatus\.options\(\)/)
  assert.match(workPanel, /:value="item\.status"/)
  assert.match(workPanel, /item\.permissions\?\.canEdit/)
  assert.match(workPanel, /updateTask\(item\.id, \{ status, version: item\.version \}\)/)
})

test('subtasks support optional due dates and capability-gated deletion', () => {
  const workPanel = fs.readFileSync(path.join(detailRoot, 'components/TaskWorkPanel.vue'), 'utf8')
  assert.match(workPanel, /deleteTask/)
  assert.match(workPanel, /subtaskDueDate/)
  assert.match(workPanel, /a-date-picker/)
  assert.match(workPanel, /clearDueDate: true/)
  assert.match(workPanel, /item\.permissions\?\.canDelete/)
  assert.match(workPanel, /onDeleteSubtask/)
  assert.match(workPanel, /detail\.status === DONE_TASK_STATUS/)
  assert.match(workPanel, /props\.detail\.status !== DONE_TASK_STATUS/)
})

test('project description stays a plain text field without image upload controls', () => {
  const detail = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')
  assert.match(detail, /project-description-control/)
  assert.doesNotMatch(detail, /descriptionImage|project-description-toolbar|PictureOutlined|insertImage|uploadProjectImage/)
})

test('project detail header uses the compact lifecycle menu and separates progress metrics', () => {
  const detail = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')
  assert.match(detail, /project-header__actions/)
  assert.match(detail, /MoreOutlined/)
  assert.match(detail, /:aria-label="\$t\('detail\.more'\)"/)
  assert.doesNotMatch(detail, /project-header__edit/)
  assert.doesNotMatch(detail, /detail\.editProject/)
  assert.match(detail, /pms-project-badge--level/)
  assert.match(detail, /pms-project-badge--priority/)
  assert.match(detail, /detail\.nodeProgress/)
  assert.match(detail, /detail\.nodeTaskCountSummary/)
  assert.match(detail, /project-header__insight-submetric-value/)
  assert.match(detail, /currentNodeProgress/)
  assert.match(detail, /task-progress/)
  assert.doesNotMatch(detail, /project-header__insight--node/)
  assert.doesNotMatch(detail, /project-header__insight--health/)
  assert.ok(detail.indexOf("detail.businessLine") < detail.indexOf("detail.projectPeriod"))
})

test('completed flow state uses the soft success treatment from the design system', () => {
  const navigator = fs.readFileSync(path.join(detailRoot, 'components/NodeNavigator.vue'), 'utf8')
  assert.match(navigator, /background: var\(--pms-success-soft\)/)
  assert.match(navigator, /color: var\(--pms-success\)/)
})

test('task cards keep high-value fields visible with a structured meta row', () => {
  const kanban = fs.readFileSync(path.join(detailRoot, 'components/TaskKanban.vue'), 'utf8')
  const styles = fs.readFileSync(path.resolve(detailRoot, '../../../styles/pms-theme.css'), 'utf8')
  assert.match(kanban, /CalendarOutlined/)
  assert.match(kanban, /UserOutlined/)
  assert.match(kanban, /task-card__assignee/)
  assert.match(kanban, /task-card__context/)
  assert.match(kanban, /pms-project-badge task-card__priority/)
  assert.match(kanban, /priorityBadgeClass/)
  assert.doesNotMatch(kanban, /pms-priority-tag--urgent/)
  assert.doesNotMatch(kanban, /ExclamationCircleOutlined/)
  assert.match(styles, /\.pms-project-badge--priority-urgent/)
})

test('node assignment row has no decorative separator borders', () => {
  const detail = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')
  const styles = fs.readFileSync(path.resolve(detailRoot, '../../../styles/pms-theme.css'), 'utf8')
  assert.match(detail, /class="node-assignment-row pms-assignment-grid"/)
  const assignmentStart = detail.indexOf('class="node-assignment-row pms-assignment-grid"')
  const profileStart = detail.indexOf('class="node-tab-profile"', assignmentStart)
  assert.ok(assignmentStart >= 0 && profileStart > assignmentStart)
  assert.doesNotMatch(detail.slice(assignmentStart, profileStart), /<a-divider \/>/)
  assert.doesNotMatch(styles, /\.node-assignment-row,\s*\n\.pms-assignment-grid\s*\{[^}]*border-top/)
  assert.doesNotMatch(styles, /\.node-assignment-row,\s*\n\.pms-assignment-grid\s*\{[^}]*border-bottom/)
})

test('task board reports current-node progress to the project header', () => {
  const kanban = fs.readFileSync(path.join(detailRoot, 'components/TaskKanban.vue'), 'utf8')
  assert.match(kanban, /task-progress/)
  assert.match(kanban, /status === 2/)
  assert.match(kanban, /emit\('task-progress'/)
})

test('task detail loading cannot cross-contaminate task modals', () => {
  const kanban = fs.readFileSync(path.join(detailRoot, 'components/TaskKanban.vue'), 'utf8')
  assert.match(kanban, /let detailSequence = 0/)
  assert.match(kanban, /detail\.value = null/)
  assert.match(kanban, /sequence !== detailSequence \|\| modalState\.editingId !== taskId/)
})

test('task drag progress ignores responses from an older node request', () => {
  const kanban = fs.readFileSync(path.join(detailRoot, 'components/TaskKanban.vue'), 'utf8')
  assert.match(kanban, /const originSequence = loadSequence/)
  assert.match(kanban, /const originNodeId = props\.nodeId/)
  assert.match(kanban, /originSequence !== loadSequence \|\| originProjectId !== props\.projectId \|\| originNodeId !== props\.nodeId/)
})

test('gantt node bars expose move and edge-resize interactions with parent synchronization', () => {
  const chart = fs.readFileSync(path.join(detailRoot, 'components/ProjectScheduleChart.vue'), 'utf8')
  const detail = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')
  assert.match(chart, /applyScheduleDrag/)
  assert.match(chart, /createScheduleFromDrag/)
  assert.match(chart, /startNodeRange/)
  assert.match(chart, /gantt__track--creatable/)
  assert.match(chart, /onNodeRangeEnd/)
  assert.match(chart, /gantt__zoom/)
  assert.match(chart, /adjustDayWidth/)
  assert.match(chart, /resize-start/)
  assert.match(chart, /resize-end/)
  assert.match(chart, /updateNodeSchedule/)
  assert.match(chart, /gantt-bar--editable/)
  assert.match(detail, /canEditScheduleNode/)
  assert.match(detail, /@update-node-schedule="onScheduleNodeScheduleChange"/)
  assert.match(chart, /suppressBarClick.value = true/)
  assert.match(chart, /window.setTimeout\(\(\) => \{ suppressBarClick.value = false \}, 0\)/)
  assert.match(detail, /scheduleSaveFailed/)
})

test('workflow cards show the node owner and deadline without removing click navigation', () => {
  const navigator = fs.readFileSync(path.join(detailRoot, 'components/NodeNavigator.vue'), 'utf8')
  assert.match(navigator, /node-owner/)
  assert.match(navigator, /node-deadline/)
  assert.match(navigator, /node\.ownerName/)
  assert.match(navigator, /node\.endDate/)
  assert.match(navigator, /emit\('select', node\)/)
})

test('project detail surfaces follow the compact governance demo visual language', () => {
  const detail = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')
  assert.match(detail, /--pms-primary:\s*#1769e0/)
  assert.match(detail, /--pms-text:\s*#17243b/)
  assert.match(detail, /\.project-header\s*\{[^}]*padding:\s*24px 26px 19px/)
  assert.match(detail, /\.project-header\s*\{[^}]*border-radius:\s*14px/)
  assert.match(detail, /\.project-header\s*\{[^}]*box-shadow:\s*0 12px 28px/)
  assert.match(detail, /project-header__meta-item--divider/)
  assert.match(detail, /\.project-header__insights\s*\{[^}]*margin-top:\s*19px/)
})

test('maps node status to the visual state used by the flow', () => {
  assert.deepEqual(getFlowNodeState(2), {
    label: 'enum.nodeStatus.2',
    tone: 'completed',
    canSelect: true,
  })
  assert.deepEqual(getFlowNodeState(1), {
    label: 'enum.nodeStatus.1',
    tone: 'active',
    canSelect: true,
  })
  assert.deepEqual(getFlowNodeState(0), {
    label: 'enum.nodeStatus.0',
    tone: 'locked',
    canSelect: true,
  })
  assert.deepEqual(getFlowNodeState(3), {
    label: 'enum.nodeStatus.3',
    tone: 'terminated',
    canSelect: true,
  })
})

test('uses the shared node status metadata and lock rule', () => {
  assert.deepEqual(getNodeStatusMeta(0), { label: 'enum.nodeStatus.0', tone: 'locked', readOnly: false })
  assert.deepEqual(getNodeStatusMeta(1), { label: 'enum.nodeStatus.1', tone: 'active', readOnly: false })
  assert.deepEqual(getNodeStatusMeta(2), { label: 'enum.nodeStatus.2', tone: 'completed', readOnly: true })
  assert.deepEqual(getNodeStatusMeta(3), { label: 'enum.nodeStatus.3', tone: 'terminated', readOnly: true })
  assert.equal(isNodeReadOnly(0), false)
  assert.equal(isNodeReadOnly(1), false)
  assert.equal(isNodeReadOnly(2), true)
  assert.equal(isNodeReadOnly(3), true)
})

test('calculates project progress from completed nodes', () => {
  assert.equal(getNodeProgress(0, 9), 0)
  assert.equal(getNodeProgress(3, 9), 33)
  assert.equal(getNodeProgress(9, 9), 100)
  assert.equal(getNodeProgress(0, 0), 0)
})

test('maps every project status to the shared visual tone and color', () => {
  assert.deepEqual(ProjectStatus.options(), [
    { value: 1, label: '进行中' },
    { value: 2, label: '已完成' },
    { value: 3, label: '已终止' },
    { value: 4, label: '已删除' },
  ])
  assert.deepEqual([0, 1, 2, 3, 4].map(getProjectStatusTone), [
    'active',
    'active',
    'completed',
    'terminated',
    'deleted',
  ])
  assert.deepEqual([0, 1, 2, 3, 4].map(projectStatusTagColor), [
    'orange',
    'orange',
    'green',
    'red',
    '#5d6b7e',
  ])
  assert.deepEqual([0, 1, 2].map(taskStatusTagColor), ['default', 'orange', 'green'])
  assert.deepEqual([0, 1, 2, 3].map(nodeStatusTagColor), ['default', 'orange', 'green', 'red'])
  assert.deepEqual([0, 1, 2].map(milestoneStatusTagColor), ['default', 'orange', 'green'])
})

test('in-progress status styling uses the active orange token', () => {
  const detailStyle = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')
  const navigatorStyle = fs.readFileSync(path.join(detailRoot, 'components/NodeNavigator.vue'), 'utf8')
  const sharedStyle = fs.readFileSync(path.resolve(detailRoot, '../../../styles/pms-theme.css'), 'utf8')
  assert.match(detailStyle, /\.project-header__status/)
  assert.match(sharedStyle, /\.project-status-icon--active[^{]*\{[^}]*--pms-status-active/)
  assert.match(navigatorStyle, /\.flow-node--active \.flow-node__dot-core[^{]*\{[^}]*--pms-status-active/)
})

test('renders legacy project status zero as active', () => {
  assert.equal(getProjectStatusLabel(0), '进行中')
  assert.equal(getProjectStatusLabel(1), '进行中')
  assert.equal(getProjectStatusLabel(4), '已删除')
})

test('reloads tasks when the same node changes lifecycle state', () => {
  assert.equal(shouldReloadNodeTasks(
    { nodeId: 1, status: 2, readOnly: true },
    { nodeId: 1, status: 1, readOnly: false },
  ), true)
  assert.equal(shouldReloadNodeTasks(
    { nodeId: 1, status: 1, readOnly: false },
    { nodeId: 1, status: 1, readOnly: false },
  ), false)
  assert.equal(shouldReloadNodeTasks(
    { nodeId: 1, status: 1, readOnly: false },
    { nodeId: 2, status: 1, readOnly: false },
  ), true)
})

test('task board reloads in place without remounting the whole node detail', () => {
  const detail = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')
  const kanban = fs.readFileSync(path.join(detailRoot, 'components/TaskKanban.vue'), 'utf8')
  assert.doesNotMatch(detail, /<section\s+v-if="activeNode"\s+:key="activeNode\.id"/)
  assert.doesNotMatch(detail, /<TaskKanban[\s\S]*?:key="activeNode\.id"/)
  assert.match(detail, /:key="`node-owner-\$\{activeNode\.id\}`"/)
  assert.match(detail, /:key="`node-schedule-\$\{activeNode\.id\}`"/)
  assert.match(kanban, /tasks\.value = \[\]/)
  assert.match(kanban, /softLoading/)
  assert.match(kanban, /requestedNodeId !== props\.nodeId/)
})

test('node workbenches keep per-node keys while the shared detail chrome stays stable', () => {
  const detail = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')
  assert.match(detail, /RequirementScopeWorkbench[\s\S]*?:key="activeNode\.id"/)
  assert.match(detail, /class="node-detail-card/)
})

test('only allows rollback for completed nodes', () => {
  assert.equal(canRollbackNode(0, 0), false)
  assert.equal(canRollbackNode(1, 0), false)
  assert.equal(canRollbackNode(1, 1), false)
  assert.equal(canRollbackNode(1, 2), true)
  assert.equal(canRollbackNode(0, 2), true)
})

test('normalizes required lifecycle reasons before submission', () => {
  assert.equal(normalizeRequiredReason('  回滚节点，重新确认范围  '), '回滚节点，重新确认范围')
  assert.equal(normalizeRequiredReason('  \n  '), undefined)
  assert.equal(normalizeRequiredReason(undefined), undefined)
})

test('splits node metadata into clean display items', () => {
  assert.deepEqual(splitNodeItems('项目章程、阶段计划;风险登记册\n验收清单'), [
    '项目章程',
    '阶段计划',
    '风险登记册',
    '验收清单',
  ])
  assert.deepEqual(splitNodeItems(''), [])
  assert.deepEqual(splitNodeItems(undefined), [])
})

test('only exposes configured fields for the selected node', () => {
  assert.deepEqual(getNodeDetailFields({
    description: '确认项目目标',
    deliverable: '项目章程、范围基线',
    roles: '',
  }), [
    { key: 'description', label: 'detail.nodeDescription', value: '确认项目目标', wide: true },
    { key: 'deliverable', label: 'task.deliverable', items: ['项目章程', '范围基线'] },
  ])
  assert.deepEqual(getNodeDetailFields({}), [])
})

test('shows project profile content only on the kickoff node tab', () => {
  assert.equal(isKickoffNode('kickoff'), true)
  assert.equal(isKickoffNode('requirement'), false)
  assert.equal(isKickoffNode(undefined), false)
})

test('keeps creation time out of the editable project profile', () => {
  assert.deepEqual(getProjectProfileFields().map((field) => field.key), [
    'description',
    'priority',
    'projectLevel',
    'schedule',
    'businessLine',
  ])
})

test('project level is placed after priority in the editable project profile', () => {
  const detail = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')
  assert.match(detail, /profileForm\.projectLevel/)
  assert.match(detail, /ProjectLevel\.options\(\)/)
  assert.match(detail, /projectLevel: profileForm\.projectLevel/)
  assert.match(detail, /field\.key === 'projectLevel'/)
})

test('profile member save keeps a baseline so auto-joined people are not replaced away', () => {
  const detail = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')
  assert.match(detail, /expectedMemberIds/)
  assert.match(detail, /profileMembersDirty/)
  assert.match(detail, /mergeMemberIdsAfterRefresh/)
  assert.match(detail, /nodes\.value = await getNodes\(project\.value\.id\)/)
  assert.match(detail, /persistDefaultNodeOwners\(pendingPreviousManagerId\)/)
  assert.match(detail, /listDefaultNodeOwnerAssignments/)
  assert.match(detail, /updateNodeOwner\(project\.value!\.id, assignment\.node\.id/)
  assert.match(detail, /void onSaveProfile\(\)/)
})

test('builds hierarchical business line options without exposing the company root', () => {
  const tree = [{
    id: 1,
    name: '公司总部',
    typeCode: 'COMPANY',
    children: [{
      id: 2,
      name: '产品制造 BG',
      typeCode: 'BG',
      children: [{ id: 3, name: 'PDT-01', typeCode: 'TEAM' }],
    }],
  }]

  assert.deepEqual(buildBusinessLineOptions(tree), [{
    value: 2,
    label: '产品制造 BG',
    children: [{ value: 3, label: 'PDT-01' }],
  }])
  assert.deepEqual(getOrgUnitPath(tree, 3), [2, 3])
})

test('business line tree expands the hovered branch and filters by keyword', () => {
  const options = [{
    value: 2,
    label: '产品制造 BG',
    children: [{ value: 3, label: 'PDT-01' }],
  }, {
    value: 4,
    label: 'PMO',
  }]

  assert.deepEqual(hoverBusinessLinePath([], 0, 2), [2])
  assert.deepEqual(hoverBusinessLinePath([2, 3], 0, 4), [4])
  assert.deepEqual(getBusinessLineTreeRows(options, [2]).map((row) => row.label), ['产品制造 BG', 'PDT-01', 'PMO'])
  assert.deepEqual(getBusinessLineTreeRows(options, [4]).map((row) => row.label), ['产品制造 BG', 'PMO'])
  assert.deepEqual(getBusinessLineLabels(options, [2, 3]), ['产品制造 BG', 'PDT-01'])
  assert.equal(getBusinessLineDisplay(options, [2, 3]), '产品制造 BG / PDT-01')
  assert.equal(getBusinessLineDisplay(options, [], '公司总部 / 产品制造 BG'), '公司总部 / 产品制造 BG')
  assert.deepEqual(filterBusinessLineOptions(options, 'pmo').map((option) => option.label), ['PMO'])
  assert.equal(filterBusinessLineOptions(options, 'pdt')[0]?.label, '产品制造 BG')
  assert.deepEqual(getBusinessLineTreeRows(filterBusinessLineOptions(options, 'pdt'), [], true).map((row) => row.label), ['产品制造 BG', 'PDT-01'])
})

test('resolves the selected business line and its responsible leader', () => {
  const tree = [{
    id: 1,
    name: '公司总部',
    typeCode: 'COMPANY',
    children: [{ id: 2, name: '产品制造 BG', typeCode: 'BG', leaderUserId: 88 }],
  }]

  assert.deepEqual(findOrgUnitById(tree, 2), tree[0].children[0])
  assert.equal(findOrgUnitById(tree, 999), undefined)
})

test('requires all kickoff profile fields except followers', () => {
  assert.deepEqual(getMissingKickoffProfileFields({
    description: '  ',
    priority: null,
    ownerId: undefined,
    schedule: ['2026-08-01'],
    memberIds: [],
    followerIds: [],
  }), ['detail.profileDescription', 'detail.profilePriority', 'detail.manager', 'detail.profileSchedule', 'detail.members'])

  assert.deepEqual(getMissingKickoffProfileFields({
    description: '项目说明',
    priority: 1,
    projectManagerId: 1,
    schedule: ['2026-08-01', '2026-08-10'],
    memberIds: [1],
  }), [])
})

test('shows an unassigned project manager as pending assignment', () => {
  assert.equal(getProjectManagerDisplay(undefined), '')
  assert.equal(getProjectManagerDisplay('  '), '')
  assert.equal(getProjectManagerDisplay('待确认'), '')
  assert.equal(getProjectManagerDisplay('未设置'), '')
  assert.equal(getProjectManagerDisplay('张三'), '张三')
})

test('uses the server project progress so list and detail share one source', () => {
  assert.equal(getProjectOverallProgress(42, 1, 9), 42)
  assert.equal(getProjectOverallProgress(undefined, 3, 9), 33)
  assert.equal(getProjectOverallProgress(null, 0, 0), 0)
})

test('shows an unassigned node owner as pending assignment', () => {
  assert.equal(getNodeOwnerDisplay(undefined), '')
  assert.equal(getNodeOwnerDisplay('  '), '')
  assert.equal(getNodeOwnerDisplay('李四'), '李四')
})

test('later nodes inherit the project manager unless someone already assigned an owner', () => {
  assert.equal(defaultNodeOwnerId(true, 11, 22), 11)
  assert.equal(defaultNodeOwnerId(false, 11, 22), 22)
  assert.equal(shouldAssignDefaultNodeOwner(undefined, undefined, 22), true)
  assert.equal(shouldAssignDefaultNodeOwner(22, 22, 33), true)
  assert.equal(shouldAssignDefaultNodeOwner(99, 22, 33), false)
  const nodes = [
    { ownerId: 11, status: 1 },
    { ownerId: undefined, status: 0 },
    { ownerId: 99, status: 0 },
    { ownerId: undefined, status: 2 },
  ]
  assert.deepEqual(
    listDefaultNodeOwnerAssignments(nodes, 11, 22).map((item) => [item.index, item.ownerId]),
    [[1, 22]],
  )
  assert.deepEqual(
    listDefaultNodeOwnerAssignments([
      { ownerId: 11, status: 1 },
      { ownerId: 22, status: 0 },
      { ownerId: 99, status: 0 },
    ], 11, 33, 22).map((item) => [item.index, item.ownerId]),
    [[1, 33]],
  )
})

test('formats people consistently as name and account', () => {
  assert.equal(formatPersonLabel({ id: 1, nickname: '朱晨', username: 'Gloria.Zhu' }), '朱晨（Gloria.Zhu）')
  assert.equal(formatPersonLabel({ id: 4, nickname: '管理员（admin）', username: 'admin' }), '管理员（admin）')
  assert.equal(formatPersonLabel({ id: 5, displayName: '管理员（admin） (admin)', username: 'admin' }), '管理员（admin）')
  assert.equal(formatPersonLabel({ id: 2, nickname: '', username: 'lisi' }), 'lisi')
  assert.equal(formatPersonLabel({ id: 3 }), '用户 3')
})

test('falls back to email when optional names are missing', () => {
  assert.equal(formatPersonLabel({ id: 6, email: 'person@example.com' }), 'person@example.com')
  assert.equal(formatPersonLabel({ id: 8, username: 'user-0123456789abcdef', email: 'person@example.com' }), 'person@example.com')
  assert.equal(formatPersonLabel({ id: 7, nameZh: '张伟', email: 'alex.zhang@example.com' }), '张伟')
})

test('normalizes duplicate preformatted person display labels', () => {
  assert.deepEqual(getPersonDisplay({ label: '管理员（admin） (admin)', avatar: '/avatar.png' }), {
    label: '管理员（admin）',
    avatar: '/avatar.png',
  })
})

test('prefers the selected person label over the stale project fallback', () => {
  assert.deepEqual(getPersonDisplay({ label: '张三(zhangsan)', avatar: '/avatar.png' }, '管理员'), {
    label: '张三（zhangsan）',
    avatar: '/avatar.png',
  })
  assert.deepEqual(getPersonDisplay(undefined, undefined), {
    label: '待确认',
    avatar: undefined,
  })
})

test('replaces a single person selection with the latest choice', () => {
  assert.equal(getSinglePersonSelection([1, 2]), 2)
  assert.equal(getSinglePersonSelection([]), undefined)
})

test('keeps only the latest six recent people and shows them before search', () => {
  const storage = {
    data: {},
    getItem(key) { return this.data[key] ?? null },
    setItem(key, value) { this.data[key] = String(value) },
  }
  const zhang = { value: 1, label: '张伟（Alex.Zhang）' }
  const people = [
    zhang,
    { value: 2, label: '李强（Terry.Li）' },
    { value: 3, label: '周岚（Linda.Zhou）' },
    { value: 4, label: '陈宇（Kevin.Chen）' },
    { value: 5, label: '王璇（Claire.Wang）' },
    { value: 6, label: '赵晨（Ethan.Zhao）' },
    { value: 7, label: '刘洋（Andy.Liu）' },
  ]
  const recent = rememberRecentPeople(people, storage, 9)
  assert.equal(recent.length, RECENT_PERSON_LIMIT)
  assert.equal(recent[0].label, zhang.label)
  assert.equal(readRecentPeople(storage, 9).length, RECENT_PERSON_LIMIT)
  assert.deepEqual(listPersonSelectOptions({
    keyword: '',
    recent,
    searchResults: [{ value: 8, label: '管理员（admin）' }],
  }), recent)
  assert.deepEqual(listPersonSelectOptions({
    keyword: '张伟',
    recent,
    searchResults: [zhang],
  }), [zhang])
})

test('fills an empty or short recent list with random people up to six', () => {
  const zhang = { value: 1, label: '张伟（Alex.Zhang）' }
  const pool = [
    { value: 2, label: '李强（Terry.Li）' },
    { value: 3, label: '周岚（Linda.Zhou）' },
    { value: 4, label: '陈宇（Kevin.Chen）' },
    { value: 5, label: '王璇（Claire.Wang）' },
    { value: 6, label: '赵晨（Ethan.Zhao）' },
    { value: 7, label: '刘洋（Andy.Liu）' },
  ]
  const filled = pickFallbackPeople([zhang], pool, RECENT_PERSON_LIMIT, () => 0)
  assert.equal(filled.length, RECENT_PERSON_LIMIT)
  assert.equal(filled[0].value, zhang.value)
  assert.equal(new Set(filled.map((item) => item.value)).size, RECENT_PERSON_LIMIT)
  assert.deepEqual(listPersonSelectOptions({
    keyword: '',
    recent: [zhang],
    fallback: pool,
    random: () => 0,
  }), filled)
})

test('only activated accounts can be picked from search', () => {
  assert.equal(isSelectableAccount('ACTIVE'), true)
  assert.equal(isSelectableAccount('PENDING_ACTIVATION'), false)
  assert.equal(isSelectableAccount(undefined), false)
})

test('keeps unsaved member edits when refresh finds newly auto-joined people', () => {
  assert.deepEqual(mergeMemberIdsAfterRefresh([1, 2], [1, 3], [1], true), [1, 2, 3])
  assert.deepEqual(mergeMemberIdsAfterRefresh([1, 2], [1, 3], [1], false), [1, 3])
})

test('autosaves only when a dirty profile receives an outside click', () => {
  assert.equal(shouldAutoSaveProfile(true, false, false), true)
  assert.equal(shouldAutoSaveProfile(false, false, false), false)
  assert.equal(shouldAutoSaveProfile(true, true, false), false)
  assert.equal(shouldAutoSaveProfile(true, false, true), false)
})

test('builds node scope params only when a node is selected', () => {
  assert.deepEqual(getNodeScopedParams(12), { params: { nodeId: 12 } })
  assert.deepEqual(getNodeScopedParams(undefined), {})
})

test('updates only the dragged task status locally', () => {
  const tasks = [
    { id: 1, status: 0, title: '资料评审' },
    { id: 2, status: 2, title: '接口开发' },
  ]

  assert.deepEqual(moveTaskStatus(tasks, 1, 1), [
    { id: 1, status: 1, title: '资料评审' },
    { id: 2, status: 2, title: '接口开发' },
  ])
})

test('keeps task deliverables in the task payload', () => {
  assert.deepEqual(buildTaskPayload({
    title: '资料评审',
    description: '评审说明',
    deliverable: '评审结论与问题清单',
    status: 0,
    priority: 1,
    assigneeId: 1,
    dueDate: null,
  }, 12), {
    title: '资料评审',
    description: '评审说明',
    deliverable: '评审结论与问题清单',
    status: 0,
    priority: 1,
    assigneeId: 1,
    dueDate: undefined,
    parentId: undefined,
    nodeId: 12,
  })
})

test('removes task-to-milestone association from the task board', () => {
  const taskKanban = fs.readFileSync(path.join(detailRoot, 'components/TaskKanban.vue'), 'utf8')
  assert.doesNotMatch(taskKanban, /getMilestones|milestoneId|task\.milestone|task\.milestonePlaceholder/)
})

test('carries an optional linked requirement into task creation', () => {
  assert.equal(buildTaskPayload({
    title: '商品详情页开发',
    description: '',
    deliverable: '',
    status: 0,
    priority: 1,
    requirementId: 51,
    dueDate: null,
  }, 12).requirementId, 51)
})

test('tasks stay independent from development stories', () => {
  const payload = buildTaskPayload({
    title: '独立任务',
    description: '',
    deliverable: '',
    status: 0,
    priority: 1,
    dueDate: null,
  }, 12)
  assert.equal('developmentStoryId' in payload, false)
  const kanban = fs.readFileSync(path.join(detailRoot, 'components/TaskKanban.vue'), 'utf8')
  assert.doesNotMatch(kanban, /openTasksForDevelopmentStory|storyFilterId|developmentStoryId|当前任务将关联故事/)
})

test('sorts tasks by priority without using creation time', () => {
  const tasks = [
    { id: 1, title: '中优先级', priority: 1 },
    { id: 2, title: '紧急任务', priority: 3 },
    { id: 3, title: '高优先级', priority: 2 },
    { id: 4, title: '另一个高优先级', priority: 2 },
  ]

  assert.deepEqual(sortTasksByPriority(tasks).map((task) => task.id), [2, 3, 4, 1])
})
