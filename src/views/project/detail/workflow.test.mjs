import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canRollbackNode,
  buildTaskPayload,
  getFlowNodeState,
  getNodeDetailFields,
  getNodeProgress,
  getNodeStatusMeta,
  getNodeOwnerDisplay,
  getNodeScopedParams,
  getMissingKickoffProfileFields,
  formatPersonLabel,
  getProjectManagerDisplay,
  getProjectProfileFields,
  getPersonDisplay,
  getSinglePersonSelection,
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
import { getProjectStatusLabel, ProjectStatus, statusTagColor } from '../../../enums/index.ts'

test('maps node status to the visual state used by the flow', () => {
  assert.deepEqual(getFlowNodeState(2), {
    label: '已完成',
    tone: 'completed',
    canSelect: true,
  })
  assert.deepEqual(getFlowNodeState(1), {
    label: '进行中',
    tone: 'active',
    canSelect: true,
  })
  assert.deepEqual(getFlowNodeState(0), {
    label: '未开始',
    tone: 'locked',
    canSelect: true,
  })
  assert.deepEqual(getFlowNodeState(3), {
    label: '已终止',
    tone: 'terminated',
    canSelect: true,
  })
})

test('uses the shared node status metadata and lock rule', () => {
  assert.deepEqual(getNodeStatusMeta(0), { label: '未开始', tone: 'locked', readOnly: false })
  assert.deepEqual(getNodeStatusMeta(1), { label: '进行中', tone: 'active', readOnly: false })
  assert.deepEqual(getNodeStatusMeta(2), { label: '已完成', tone: 'completed', readOnly: true })
  assert.deepEqual(getNodeStatusMeta(3), { label: '已终止', tone: 'terminated', readOnly: true })
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
  assert.deepEqual([1, 2, 3, 4].map((status) => statusTagColor[status]), [
    'orange',
    'green',
    'red',
    'red',
  ])
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
    { key: 'description', label: '节点说明', value: '确认项目目标', wide: true },
    { key: 'deliverable', label: '交付物', items: ['项目章程', '范围基线'] },
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
    'schedule',
    'businessLine',
  ])
})

test('requires all kickoff profile fields except followers', () => {
  assert.deepEqual(getMissingKickoffProfileFields({
    description: '  ',
    priority: null,
    ownerId: undefined,
    schedule: ['2026-08-01'],
    memberIds: [],
    followerIds: [],
  }), ['项目描述', '优先级', '项目经理', '项目排期', '项目成员'])

  assert.deepEqual(getMissingKickoffProfileFields({
    description: '项目说明',
    priority: 1,
    projectManagerId: 1,
    schedule: ['2026-08-01', '2026-08-10'],
    memberIds: [1],
  }), [])
})

test('shows an unconfirmed project manager as pending', () => {
  assert.equal(getProjectManagerDisplay(undefined), '待确认')
  assert.equal(getProjectManagerDisplay('  '), '待确认')
  assert.equal(getProjectManagerDisplay('张三'), '张三')
})

test('shows an unassigned node owner as pending assignment', () => {
  assert.equal(getNodeOwnerDisplay(undefined), '待分配')
  assert.equal(getNodeOwnerDisplay('  '), '待分配')
  assert.equal(getNodeOwnerDisplay('李四'), '李四')
})

test('formats people consistently as name and account', () => {
  assert.equal(formatPersonLabel({ id: 1, nickname: '朱晨', username: 'Gloria.Zhu' }), '朱晨（Gloria.Zhu）')
  assert.equal(formatPersonLabel({ id: 4, nickname: '管理员（admin）', username: 'admin' }), '管理员（admin）')
  assert.equal(formatPersonLabel({ id: 5, displayName: '管理员（admin） (admin)', username: 'admin' }), '管理员（admin）')
  assert.equal(formatPersonLabel({ id: 2, nickname: '', username: 'lisi' }), 'lisi')
  assert.equal(formatPersonLabel({ id: 3 }), '用户 3')
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
    milestoneId: undefined,
    dueDate: null,
  }, 12), {
    title: '资料评审',
    description: '评审说明',
    deliverable: '评审结论与问题清单',
    status: 0,
    priority: 1,
    assigneeId: 1,
    milestoneId: undefined,
    dueDate: undefined,
    nodeId: 12,
  })
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
