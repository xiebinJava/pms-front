<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeftOutlined,
  MoreOutlined,
  NodeIndexOutlined,
  RollbackOutlined,
} from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import { apiErrorMessage } from '/@/plugins/http'
import { getFollowers } from '/@/api/follower'
import { getMembers } from '/@/api/member'
import { getTask, getTasks } from '/@/api/task'
import { getIterationPlans } from '/@/api/iteration-plan'
import { getProject, restoreProject, terminateProject, updateProject } from '/@/api/project'
import type { ProjectUpdatePayload } from '/@/api/project'
import { completeNode, getNodes, rollbackNode, updateNodeOwner, updateNodeSchedule } from '/@/api/node'
import { getProjectOrgTree } from '/@/api/admin-org'
import {
  nodeStatusTagColor,
  priorityKey,
  projectLevelKey,
  projectStatusKey,
  projectStatusTagColor,
  ProjectLevel,
  Priority,
} from '/@/enums'
import { formatDate } from '/@/utils/format'
import {
  buildBusinessLineOptions,
  getBusinessLineDisplay,
  getMissingKickoffProfileFields,
  formatPersonLabel,
  getNodeOwnerDisplay,
  getPersonDisplay,
  getProjectProfileFields,
  getProjectManagerDisplay,
  getNodeProgress,
  getNodeStatusMeta,
  getOrgUnitPath,
  getInitialActiveNodeId,
  listDefaultNodeOwnerAssignments,
  isNodeReadOnly,
  isKickoffNode,
  mergeMemberIdsAfterRefresh,
  normalizeRequiredReason,
  NOTE_ASSIGNED_PROJECT_MEMBER,
  REMEMBER_PERSON_OPTION,
  shouldAutoSaveProfile,
} from './workflow'
import NodeNavigator from './components/NodeNavigator.vue'
import TaskKanban from './components/TaskKanban.vue'
import ProjectScheduleChart from './components/ProjectScheduleChart.vue'
import ProjectScheduleCalendar from './components/ProjectScheduleCalendar.vue'
import Members from './components/Members.vue'
import Comments from './components/Comments.vue'
import PersonSelect from './components/PersonSelect.vue'
import BusinessLineSelect from './components/BusinessLineSelect.vue'
import RequirementScopeWorkbench from './components/RequirementScopeWorkbench.vue'
import SolutionDesignWorkbench from './components/SolutionDesignWorkbench.vue'
import PlanResourceRiskWorkbench from './components/PlanResourceRiskWorkbench.vue'
import AcceptanceWorkbench from './components/AcceptanceWorkbench.vue'
import DevelopmentControlWorkbench from './components/DevelopmentControlWorkbench.vue'
import ReleaseDecisionHandoverWorkbench from './components/ReleaseDecisionHandoverWorkbench.vue'
import ValueReviewWorkbench from './components/ValueReviewWorkbench.vue'
import KnowledgeStandardWorkbench from './components/KnowledgeStandardWorkbench.vue'
import type { PersonOption } from './workflow'
import type { NodeIterationPlan, NodeRequirement, OrgUnit, Project, ProjectMember, ProjectNode, Task, User } from '/@/types/domain'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const projectId = computed(() => Number(route.params.id))
const focusTaskId = computed(() => {
  const raw = route.query.task
  const value = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isFinite(value) && value > 0 ? value : null
})
const focusNodeId = computed(() => {
  const raw = route.query.node
  const value = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isFinite(value) && value > 0 ? value : null
})
const project = ref<Project | null>(null)
const nodes = ref<ProjectNode[]>([])
const loading = ref(false)
const loadError = ref(false)
const submitting = ref(false)
const rollingBack = ref(false)
const lifecycleSaving = ref(false)
const nodeOwnerSaving = ref(false)
const profileDirty = ref(false)
const profileMembersDirty = ref(false)
const profileFollowersDirty = ref(false)
const profileSaving = ref(false)
const membersRevision = ref(0)
const knownMemberIds = ref<number[]>([])
let profileSavePromise: Promise<void> | null = null
let assignedMemberRefreshTimer: ReturnType<typeof setTimeout> | undefined
const profileContainer = ref<HTMLElement | null>(null)
const activeNodeId = ref<number | null>(null)
const activeSection = ref('gantt')
const projectProfileFields = getProjectProfileFields()
const priorityOptions = computed(() => Priority.options().map((opt) => ({
  ...opt,
  label: t(priorityKey(opt.value)),
})))
const projectLevelOptions = computed(() => ProjectLevel.options().map((opt) => ({
  ...opt,
  label: t(projectLevelKey(opt.value)),
})))
const members = ref<ProjectMember[]>([])
const followers = ref<User[]>([])
const profileUserOptions = ref<PersonOption[]>([])
const rememberedPersonOptions = ref<PersonOption[]>([])
let pendingPreviousManagerId: number | undefined
const orgTree = ref<OrgUnit[]>([])
const nodeSchedule = ref<string[]>([])
const nodeScheduleSaving = ref(false)
const scheduleSavingNodeId = ref<number | null>(null)
let scheduleSaveSequence = 0
const scheduleTasks = ref<Task[]>([])
const scheduleIterationPlans = ref<NodeIterationPlan[]>([])
const scheduleLoading = ref(false)
const scheduleLoaded = ref(false)
const activeNodeTaskSummary = ref({ done: 0, total: 0 })
const requirementScopeRef = ref<{
  refresh: () => Promise<void> | void
  flushAutoSave: () => Promise<boolean>
} | null>(null)
const planResourceRiskRef = ref<{ flushAutoSave: () => Promise<boolean> } | null>(null)
const acceptanceRef = ref<{ flushAutoSave: () => Promise<boolean> } | null>(null)
const releaseWorkbenchRef = ref<{ saveDraft: () => Promise<boolean> } | null>(null)
const valueReviewWorkbenchRef = ref<{ saveDraft: () => Promise<boolean> } | null>(null)
const knowledgeStandardRef = ref<{ flushAutoSave: () => Promise<boolean> } | null>(null)
const taskKanbanRef = ref<{
  openCreateForRequirement: (requirementId: number) => void
  refreshRequirements: () => Promise<void> | void
} | null>(null)
const requirementBaselineStatus = ref(0)
const planBaselineStatus = ref(0)
const acceptanceStatus = ref(0)
const releaseCompletionReady = ref(false)
const valueReviewCompletionReady = ref(false)
type ReasonAction = 'terminate' | 'restore' | 'rollback'

const reasonModal = reactive({
  open: false,
  action: null as ReasonAction | null,
  title: '',
  description: '',
  okText: '',
  okType: 'primary' as 'primary' | 'danger',
})
const reasonValue = ref('')
const reasonSubmitting = ref(false)
const rollbackTargetNode = ref<ProjectNode | null>(null)
const profileForm = reactive({
  description: '',
  priority: 1,
  projectLevel: 0,
  projectManagerId: undefined as number | undefined,
  schedule: [] as string[],
  orgUnitId: undefined as number | undefined,
  memberIds: [] as number[],
  followerIds: [] as number[],
})

const activeNode = computed<ProjectNode | null>(
  () => nodes.value.find((node) => node.id === activeNodeId.value) || null,
)
const doneNodeCount = computed(() => nodes.value.filter((node) => node.status === 2).length)
const projectProgress = computed(() => getNodeProgress(doneNodeCount.value, nodes.value.length))
const currentNodeProgress = computed(() => getNodeProgress(
  activeNodeTaskSummary.value.done,
  activeNodeTaskSummary.value.total,
))
const showKickoffProfile = computed(() => isKickoffNode(activeNode.value?.nodeKey))
const nodeOwnerOptions = computed(() => members.value.map((member) => ({
  value: member.userId,
  label: formatPersonLabel({ id: member.userId, nickname: member.nickname, username: member.username, email: member.email }),
  avatar: member.avatar,
})))
const businessLineOptions = computed(() => {
  return buildBusinessLineOptions(orgTree.value)
})
const businessLinePath = computed<number[] | undefined>({
  get: () => {
    const path = getOrgUnitPath(orgTree.value, profileForm.orgUnitId)
    return path.length ? path : undefined
  },
  set: (value) => {
    const path = Array.isArray(value) ? value : []
    profileForm.orgUnitId = path.length ? Number(path[path.length - 1]) : undefined
    if (project.value) {
      const label = getBusinessLineDisplay(businessLineOptions.value, path)
      project.value.orgUnitId = profileForm.orgUnitId
      project.value.orgUnitName = label.split(' / ').at(-1)
      project.value.orgUnitPath = label || undefined
    }
    markProfileDirty()
  },
})
const businessLineDisplay = computed(() => getBusinessLineDisplay(
  businessLineOptions.value,
  businessLinePath.value,
  project.value?.orgUnitPath || project.value?.orgUnitName,
))
function findRememberedPerson(userId?: number) {
  if (userId == null) return undefined
  return rememberedPersonOptions.value.find((option) => option.value === userId)
    || nodeOwnerOptions.value.find((option) => option.value === userId)
    || profileUserOptions.value.find((option) => option.value === userId)
}

function resolvePersonLabel(userId?: number, fallback?: string) {
  return findRememberedPerson(userId)?.label || fallback?.trim() || ''
}

const projectManagerOption = computed(() => {
  const managerId = profileForm.projectManagerId
  return managerId == null ? undefined : findRememberedPerson(managerId)
})
const projectManagerDisplay = computed(() => {
  const managerName = projectManagerOption.value?.label || project.value?.projectManagerName
  const display = getPersonDisplay(projectManagerOption.value, managerName)
  const assigned = getProjectManagerDisplay(managerName)
  return { ...display, label: assigned || t('detail.unassigned'), pending: !assigned }
})
const canManageProject = computed(() => Boolean(project.value?.permissions?.canManageProject))
const canManageMembers = computed(() => Boolean(project.value?.permissions?.canManageMembers))
const canSetProjectManager = computed(() => Boolean(project.value?.permissions?.canSetProjectManager))
const canAssignNodeOwner = computed(() => Boolean(project.value?.permissions?.canAssignNodeOwner))
const canWriteComment = computed(() => Boolean(project.value?.permissions?.canWriteComment))
const canEditActiveNode = computed(() => Boolean(activeNode.value?.permissions?.canEdit))
const canTerminateProject = computed(() => project.value?.permissions?.canTerminateProject ?? false)
const canRestoreProject = computed(() => project.value?.permissions?.canRestoreProject ?? false)
const activeNodeReadOnly = computed(() => Boolean(
  activeNode.value && ((activeNode.value.permissions?.readOnly ?? isNodeReadOnly(activeNode.value.status))
    || project.value?.status !== 1),
))
const canCompleteActiveNode = computed(() => Boolean(
  activeNode.value && Boolean(activeNode.value.permissions?.canComplete),
))
const canRollbackActiveNode = computed(() => Boolean(
  activeNode.value && Boolean(activeNode.value.permissions?.canRollback),
))

function getNodeStatusLabel(status: number): string {
  return t(getNodeStatusMeta(status).label)
}

function getProjectLevelCode(level?: number): string {
  return ({ 0: 'C', 1: 'B', 2: 'A', 3: 'S' } as Record<number, string>)[level ?? 0] || 'C'
}

function getProjectLevelLabel(level?: number): string {
  return t(projectLevelKey(level ?? 0)).replace(/\s*[（(][A-Z][）)]\s*$/, '')
}

function getProjectLevelBadge(level?: number): string {
  return t('detail.projectLevelBadge', {
    code: getProjectLevelCode(level),
    label: getProjectLevelLabel(level),
  })
}

function getPriorityBadge(priority: number): string {
  return t('detail.priorityBadge', { label: t(priorityKey(priority)) })
}

function joinLocalizedFields(keys: string[]): string {
  return keys.map((key) => t(key)).join(locale.value.startsWith('zh') ? '、' : ', ')
}

async function loadData() {
  loading.value = true
  loadError.value = false
  try {
    const [projectData, nodeData, memberData, followerData, orgData] = await Promise.all([
      getProject(projectId.value),
      getNodes(projectId.value),
      getMembers(projectId.value),
      getFollowers(projectId.value),
      getProjectOrgTree().catch(() => []),
    ])
    project.value = projectData
    nodes.value = nodeData
    activeNodeTaskSummary.value = { done: 0, total: 0 }
    members.value = memberData
    followers.value = followerData
    orgTree.value = orgData
    resetProfileForm()
    profileUserOptions.value = []
    syncProfileUserOptions()
    await persistDefaultNodeOwners()
    activeNodeId.value = getInitialActiveNodeId(nodes.value)
    await applyFocusTask()
    applyFocusNode()
    if (isScheduleSection(activeSection.value)) {
      scheduleLoaded.value = false
      void loadSchedule()
    }
  } catch (error) {
    loadError.value = !project.value
    message.error((error as Error).message || t('detail.loadFailed'))
  } finally {
    loading.value = false
  }
}

async function applyFocusTask() {
  if (!focusTaskId.value) return
  try {
    const task = await getTask(focusTaskId.value)
    if (task.projectId !== projectId.value) return
    if (task.nodeId) activeNodeId.value = task.nodeId
  } catch {
    // Keep the default node when the focused task is gone or unreadable.
  }
}

function applyFocusNode() {
  if (focusTaskId.value || !focusNodeId.value) return
  if (nodes.value.some((node) => node.id === focusNodeId.value)) {
    activeNodeId.value = focusNodeId.value
  }
}

function onTaskFocusConsumed() {
  if (!route.query.task) return
  const query = { ...route.query }
  delete query.task
  void router.replace({ query })
}

function onSelectNode(node: ProjectNode) {
  if (profileDirty.value) void onSaveProfile()
  activeNodeId.value = node.id
}

function isScheduleSection(section: string) {
  return section === 'gantt' || section === 'calendar'
}

async function loadSchedule() {
  if (!scheduleLoaded.value) scheduleLoading.value = true
  try {
    const [taskData, iterationPlanData] = await Promise.all([
      getTasks(projectId.value),
      getIterationPlans(projectId.value),
    ])
    scheduleTasks.value = taskData
    scheduleIterationPlans.value = iterationPlanData
    scheduleLoaded.value = true
  } catch (error) {
    message.error((error as Error).message || t('schedule.empty'))
  } finally {
    scheduleLoading.value = false
  }
}

watch(activeSection, (section) => {
  if (isScheduleSection(section)) void loadSchedule()
})

watch(projectId, () => {
  scheduleLoaded.value = false
  scheduleTasks.value = []
  scheduleIterationPlans.value = []
})

watch(focusTaskId, (taskId) => {
  if (taskId) void applyFocusTask()
})

watch(focusNodeId, () => {
  applyFocusNode()
})

function onScheduleSelectNode(nodeId: number) {
  const node = nodes.value.find((item) => item.id === nodeId)
  if (node) onSelectNode(node)
}

function onScheduleOpenTask(taskId: number, nodeId?: number) {
  if (nodeId) activeNodeId.value = nodeId
  void router.replace({ query: { ...route.query, task: String(taskId) } })
  document.querySelector('.node-task-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function resetProfileForm() {
  if (!project.value) return
  Object.assign(profileForm, {
    description: project.value.description || '',
    priority: project.value.priority,
    projectLevel: project.value.projectLevel ?? 0,
    projectManagerId: project.value.projectManagerId,
    schedule: [project.value.startDate, project.value.endDate].filter(Boolean) as string[],
    orgUnitId: project.value.orgUnitId,
    memberIds: members.value.map((member) => member.userId),
    followerIds: followers.value.map((user) => user.id),
  })
  knownMemberIds.value = members.value.map((member) => member.userId)
  profileDirty.value = false
  profileMembersDirty.value = false
  profileFollowersDirty.value = false
}

watch(activeNode, (node) => {
  nodeSchedule.value = [node?.startDate, node?.endDate].filter(Boolean) as string[]
}, { immediate: true })

watch(activeNodeId, () => {
  activeNodeTaskSummary.value = { done: 0, total: 0 }
  requirementBaselineStatus.value = 0
  planBaselineStatus.value = 0
  acceptanceStatus.value = 0
  releaseCompletionReady.value = false
  valueReviewCompletionReady.value = false
})

function onTaskProgress(payload: { projectId: number; nodeId: number; done: number; total: number }) {
  if (payload.projectId !== projectId.value || payload.nodeId !== activeNodeId.value) return
  activeNodeTaskSummary.value = { done: payload.done, total: payload.total }
  if (activeNode.value?.nodeKey === 'requirement') void requirementScopeRef.value?.refresh()
}

function onCreateTaskFromRequirement(requirement: NodeRequirement) {
  if (requirement.id == null) return
  taskKanbanRef.value?.openCreateForRequirement(requirement.id)
}

function onRequirementSaved() {
  void taskKanbanRef.value?.refreshRequirements()
}

function onRequirementBaselineStatus(status: number) {
  requirementBaselineStatus.value = status
}

function onPlanBaselineStatus(status: number) {
  planBaselineStatus.value = status
}

function onAcceptanceStatus(status: number) {
  acceptanceStatus.value = status
}

function onReleaseCompletionReady(ready: boolean) {
  releaseCompletionReady.value = ready
}

function onValueReviewCompletionReady(ready: boolean) {
  valueReviewCompletionReady.value = ready
}

function formatUserOption(user: User): PersonOption {
  return { value: user.id, label: formatPersonLabel(user), avatar: user.avatar }
}

function mergeProfileUsers(users: User[]) {
  const optionMap = new Map(profileUserOptions.value.map((option) => [option.value, option]))
  users.forEach((user) => optionMap.set(user.id, formatUserOption(user)))
  profileUserOptions.value = Array.from(optionMap.values())
}

function syncProfileUserOptions() {
  mergeProfileUsers([
    ...members.value.map((member) => ({
      id: member.userId,
      username: member.username || '',
      nickname: member.nickname || '',
      email: member.email,
      avatar: member.avatar,
    })),
    ...followers.value,
  ])
}

function markProfileDirty() {
  profileDirty.value = true
}

function rememberPersonOption(option: PersonOption) {
  rememberedPersonOptions.value = [
    option,
    ...rememberedPersonOptions.value.filter((item) => item.value !== option.value),
  ]
}

function applyDefaultNodeOwnersLocally(
  assignments: Array<{ index: number; ownerId: number }>,
  managerId?: number,
) {
  if (!assignments.length || !project.value) return
  const managerLabel = resolvePersonLabel(managerId, project.value.projectManagerName)
  const creatorId = project.value.createdBy ?? project.value.ownerId
  const creatorLabel = resolvePersonLabel(creatorId, project.value.createdByName || project.value.ownerName)
  nodes.value = nodes.value.map((node, index) => {
    const assignment = assignments.find((item) => item.index === index)
    if (!assignment) return node
    return {
      ...node,
      ownerId: assignment.ownerId,
      ownerName: assignment.ownerId === managerId ? managerLabel : creatorLabel,
    }
  })
}

async function persistDefaultNodeOwners(previousManagerId?: number) {
  if (!project.value || !(canAssignNodeOwner.value || canSetProjectManager.value)) return
  const creatorId = project.value.createdBy ?? project.value.ownerId
  const managerId = profileForm.projectManagerId ?? project.value.projectManagerId
  const assignments = listDefaultNodeOwnerAssignments(
    nodes.value,
    creatorId,
    managerId,
    previousManagerId,
  )
  if (!assignments.length) return
  applyDefaultNodeOwnersLocally(assignments, managerId)
  const [first, ...rest] = assignments
  const writeOwner = (assignment: typeof first) => updateNodeOwner(project.value!.id, assignment.node.id, {
    ownerId: assignment.ownerId,
    version: assignment.node.version ?? 0,
  })
  const updatedNodes: Awaited<ReturnType<typeof updateNodeOwner>>[] = []
  try {
    if (first) updatedNodes.push(await writeOwner(first))
    const remaining = await Promise.allSettled(rest.map(writeOwner))
    remaining.forEach((result) => {
      if (result.status === 'fulfilled') updatedNodes.push(result.value)
    })
  } catch (error) {
    message.error(apiErrorMessage(error, t('detail.ownerSaveFailed')))
    return
  }
  updatedNodes.forEach((updated) => {
    const index = nodes.value.findIndex((node) => node.id === updated.id)
    if (index >= 0) nodes.value[index] = updated
  })
}

function markMembersDirty() {
  profileMembersDirty.value = true
  markProfileDirty()
}

function markFollowersDirty() {
  profileFollowersDirty.value = true
  markProfileDirty()
}

function onProjectManagerChange(value: number | number[] | undefined) {
  pendingPreviousManagerId = project.value?.projectManagerId
  const managerId = Array.isArray(value) ? value[0] : value
  profileForm.projectManagerId = managerId
  if (managerId != null && !profileForm.memberIds.includes(managerId)) {
    profileForm.memberIds = [...profileForm.memberIds, managerId]
    markMembersDirty()
  }
  markProfileDirty()
  const creatorId = project.value?.createdBy ?? project.value?.ownerId
  applyDefaultNodeOwnersLocally(
    listDefaultNodeOwnerAssignments(
      nodes.value,
      creatorId,
      managerId,
      pendingPreviousManagerId,
    ).map((item) => ({ index: item.index, ownerId: item.ownerId })),
    managerId,
  )
  void onSaveProfile()
}

async function refreshMembers() {
  members.value = await getMembers(projectId.value)
  const serverIds = members.value.map((member) => member.userId)
  profileForm.memberIds = mergeMemberIdsAfterRefresh(
    profileForm.memberIds,
    serverIds,
    knownMemberIds.value,
    profileMembersDirty.value,
  )
  knownMemberIds.value = serverIds
  syncProfileUserOptions()
  membersRevision.value += 1
}

function noteAssignedProjectMember() {
  if (assignedMemberRefreshTimer) clearTimeout(assignedMemberRefreshTimer)
  assignedMemberRefreshTimer = setTimeout(() => {
    assignedMemberRefreshTimer = undefined
    void refreshMembers()
  }, 1000)
}

provide(NOTE_ASSIGNED_PROJECT_MEMBER, noteAssignedProjectMember)
provide(REMEMBER_PERSON_OPTION, rememberPersonOption)

async function onNodeOwnerChange(ownerId: number | undefined) {
  if (!activeNode.value || !canAssignNodeOwner.value) {
    message.info(t('detail.noAssignOwner'))
    return
  }
  if (profileSavePromise) await profileSavePromise
  nodeOwnerSaving.value = true
  try {
    const updatedNode = await updateNodeOwner(projectId.value, activeNode.value.id, {
      ownerId,
      version: activeNode.value.version ?? 0,
    })
    const index = nodes.value.findIndex((node) => node.id === updatedNode.id)
    if (index >= 0) nodes.value[index] = updatedNode
    await refreshMembers()
    message.success(t('detail.ownerUpdated'))
  } catch (error) {
    message.error(apiErrorMessage(error, t('detail.ownerSaveFailed')))
  } finally {
    nodeOwnerSaving.value = false
  }
}

function onNodeOwnerSelection(value: number | number[] | undefined) {
  const ownerId = Array.isArray(value) ? value[0] : value
  void onNodeOwnerChange(ownerId)
}

function canEditScheduleNode(node: ProjectNode): boolean {
  return Boolean(
    project.value?.status === 1
      && node.permissions?.canEdit
      && !node.permissions?.readOnly
      && !isNodeReadOnly(node.status),
  )
}

function isConflictError(error: unknown): boolean {
  return (error as { response?: { status?: number } }).response?.status === 409
}

async function persistNodeSchedule(nodeId: number, next: string[]) {
  const index = nodes.value.findIndex((node) => node.id === nodeId)
  const current = index >= 0 ? nodes.value[index] : undefined
  if (!current) return
  const previous = { startDate: current.startDate, endDate: current.endDate }
  const nextDates = {
    startDate: next[0] || undefined,
    endDate: next[1] || undefined,
  }
  nodes.value[index] = { ...current, ...nextDates }
  if (activeNodeId.value === nodeId) nodeSchedule.value = next.filter(Boolean)
  const sequence = ++scheduleSaveSequence
  scheduleSavingNodeId.value = nodeId
  if (activeNodeId.value === nodeId) nodeScheduleSaving.value = true
  try {
    const updated = await updateNodeSchedule(projectId.value, nodeId, {
      ...nextDates,
      version: current.version ?? 0,
    })
    if (sequence !== scheduleSaveSequence) return
    const updatedIndex = nodes.value.findIndex((node) => node.id === updated.id)
    if (updatedIndex >= 0) nodes.value[updatedIndex] = updated
    if (activeNodeId.value === nodeId) nodeSchedule.value = [updated.startDate, updated.endDate].filter(Boolean) as string[]
    message.success(t('detail.scheduleUpdated'))
  } catch (error) {
    if (sequence !== scheduleSaveSequence) return
    if (!isConflictError(error)) {
      const currentIndex = nodes.value.findIndex((node) => node.id === nodeId)
      if (currentIndex >= 0) nodes.value[currentIndex] = { ...nodes.value[currentIndex], ...previous }
      if (activeNodeId.value === nodeId) nodeSchedule.value = [previous.startDate, previous.endDate].filter(Boolean) as string[]
    }
    message.error(apiErrorMessage(error, t('detail.scheduleSaveFailed')))
  } finally {
    if (sequence === scheduleSaveSequence) {
      scheduleSavingNodeId.value = null
      if (activeNodeId.value === nodeId) nodeScheduleSaving.value = false
    }
  }
}

async function onNodeScheduleChange(value: unknown, dateStrings?: string[] | string) {
  if (!activeNode.value || scheduleSavingNodeId.value != null) return
  const next = (Array.isArray(dateStrings)
    ? dateStrings
    : Array.isArray(value) && value.every((item) => typeof item === 'string')
      ? value as string[]
      : []).filter(Boolean)
  if (next.length === 1) {
    message.warning(t('detail.scheduleIncomplete'))
    nodeSchedule.value = [activeNode.value.startDate, activeNode.value.endDate].filter(Boolean) as string[]
    return
  }
  if (!canEditActiveNode.value || activeNodeReadOnly.value) {
    message.info(t('detail.noEditSchedule'))
    return
  }
  await persistNodeSchedule(activeNode.value.id, next)
}

async function onScheduleNodeScheduleChange(payload: { nodeId: number; startDate: string; endDate: string }) {
  const node = nodes.value.find((item) => item.id === payload.nodeId)
  if (!node || !canEditScheduleNode(node) || scheduleSavingNodeId.value != null) {
    message.info(t('detail.noEditSchedule'))
    return
  }
  await persistNodeSchedule(payload.nodeId, [payload.startDate, payload.endDate])
}

function isProfileOverlayTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && Boolean(target.closest('.ant-select-dropdown, .ant-picker-dropdown, .ant-dropdown, .ant-popover, .business-line-select-dropdown'))
}

function onDocumentPointerDown(event: PointerEvent) {
  const target = event.target
  const clickedInsideProfile = target instanceof Node && Boolean(profileContainer.value?.contains(target))
  const clickedInsideOverlay = isProfileOverlayTarget(target)
  if (shouldAutoSaveProfile(profileDirty.value, clickedInsideProfile, clickedInsideOverlay)) {
    void onSaveProfile()
  }
}

async function onSaveProfile() {
  if (!project.value || !profileDirty.value || profileSaving.value) return
  if (!canManageProject.value || activeNodeReadOnly.value) {
    profileDirty.value = false
    message.info(t('detail.profileReadonly'))
    return
  }
  profileDirty.value = false
  profileSaving.value = true
  const savePromise = (async () => {
    try {
      const payload: ProjectUpdatePayload = {
        version: project.value!.version,
        name: project.value!.name,
        description: profileForm.description,
        priority: profileForm.priority,
        projectLevel: profileForm.projectLevel,
        startDate: profileForm.schedule?.[0] || undefined,
        endDate: profileForm.schedule?.[1] || undefined,
        orgUnitId: profileForm.orgUnitId,
      }
      if (canSetProjectManager.value && profileForm.projectManagerId != null) {
        payload.projectManagerId = profileForm.projectManagerId
      }
      if (canManageMembers.value && profileMembersDirty.value) {
        payload.memberIds = profileForm.memberIds
        payload.expectedMemberIds = [...knownMemberIds.value]
      }
      if (canManageMembers.value && profileFollowersDirty.value) {
        payload.followerIds = profileForm.followerIds
      }
      project.value = await updateProject(project.value!.id, payload)
      nodes.value = await getNodes(project.value.id)
      await persistDefaultNodeOwners(pendingPreviousManagerId)
      pendingPreviousManagerId = undefined
      members.value = await getMembers(project.value.id)
      followers.value = await getFollowers(project.value.id)
      resetProfileForm()
      syncProfileUserOptions()
      membersRevision.value += 1
    } catch (error) {
      profileDirty.value = true
      message.error(apiErrorMessage(error, t('detail.profileSaveFailed')))
    } finally {
      profileSaving.value = false
    }
  })()
  profileSavePromise = savePromise
  try {
    await savePromise
  } finally {
    if (profileSavePromise === savePromise) profileSavePromise = null
  }
}

async function onComplete() {
  const nodeToComplete = activeNode.value
  if (!nodeToComplete || !canCompleteActiveNode.value) {
    message.info(t('detail.cannotComplete'))
    return
  }
  if (nodeToComplete.nodeKey === 'requirement') {
    const ready = await requirementScopeRef.value?.flushAutoSave()
    if (!ready || requirementBaselineStatus.value !== 1) {
      message.warning(t('detail.requirementContentIncomplete'))
      return
    }
  }
  if (nodeToComplete.nodeKey === 'plan') {
    const ready = await planResourceRiskRef.value?.flushAutoSave()
    if (!ready || planBaselineStatus.value !== 1) {
      message.warning(t('detail.planContentIncomplete'))
      return
    }
  }
  if (nodeToComplete.nodeKey === 'acceptance') {
    const ready = await acceptanceRef.value?.flushAutoSave()
    if (!ready || acceptanceStatus.value !== 1) {
      message.warning(t('detail.acceptanceContentIncomplete'))
      return
    }
  }
  if (nodeToComplete.nodeKey === 'release' && !releaseCompletionReady.value) {
    message.warning(t('detail.release.completionRequired'))
    return
  }
  if (nodeToComplete.nodeKey === 'review' && !valueReviewCompletionReady.value) {
    message.warning(t('detail.valueReview.completionRequired'))
    return
  }
  if (isKickoffNode(nodeToComplete.nodeKey)) {
    const missingFields = getMissingKickoffProfileFields(profileForm)
    if (missingFields.length) {
      message.warning(t('detail.completeMissing', { fields: joinLocalizedFields(missingFields) }))
      return
    }
  }
  if (nodeToComplete.nodeKey === 'release') {
    const saved = await releaseWorkbenchRef.value?.saveDraft()
    if (!saved) return
  }
  if (nodeToComplete.nodeKey === 'review') {
    const saved = await valueReviewWorkbenchRef.value?.saveDraft()
    if (!saved) return
  }
  if (nodeToComplete.nodeKey === 'knowledge') {
    const saved = await knowledgeStandardRef.value?.flushAutoSave()
    if (!saved) return
  }
  Modal.confirm({
    title: t('detail.completeTitle'),
    content: t('detail.completeContent', { name: nodeToComplete.name }),
    okText: t('detail.completeOk'),
    cancelText: t('common.cancel'),
    onOk: async () => {
      if (profileSavePromise) await profileSavePromise
      submitting.value = true
      try {
        const nextNodes = await completeNode(projectId.value, nodeToComplete.id)
        nodes.value = nextNodes
        project.value = await getProject(projectId.value)
        const current = nextNodes.find((node) => node.status === 1)
        activeNodeId.value = current?.id ?? nodeToComplete.id
        message.success(t('detail.completeSuccess'))
      } finally {
        submitting.value = false
      }
    },
  })
}

async function refreshAfterLifecycle(preferredStatus: number) {
  await loadData()
  const preferredNode = nodes.value.find((node) => node.status === preferredStatus)
  if (preferredNode) activeNodeId.value = preferredNode.id
}

function openReasonModal(action: ReasonAction, targetNode?: ProjectNode) {
  reasonValue.value = ''
  rollbackTargetNode.value = targetNode || null
  Object.assign(reasonModal, {
    open: true,
    action,
    title: action === 'terminate' ? t('detail.terminateTitle') : action === 'restore' ? t('detail.restoreTitle') : t('detail.rollbackTitle'),
    description: action === 'terminate'
      ? t('detail.terminateHint')
      : action === 'restore'
        ? t('detail.restoreHint')
        : t('detail.rollbackHint', { name: targetNode?.name || '' }),
    okText: action === 'terminate' ? t('detail.terminateTitle') : action === 'restore' ? t('detail.restoreTitle') : t('detail.rollbackOk'),
    okType: action === 'terminate' ? 'danger' : 'primary',
  })
}

function closeReasonModal() {
  if (reasonSubmitting.value) return
  reasonModal.open = false
  reasonModal.action = null
  rollbackTargetNode.value = null
  reasonValue.value = ''
}

async function onReasonModalOk() {
  const reason = normalizeRequiredReason(reasonValue.value)
  if (!reason) {
    message.warning(t('detail.reasonRequired'))
    return
  }

  const action = reasonModal.action
  if (!action) return

  reasonSubmitting.value = true
  if (action === 'rollback') rollingBack.value = true
  else lifecycleSaving.value = true

  try {
    if (action === 'terminate') {
      await terminateProject(projectId.value, reason)
      await refreshAfterLifecycle(3)
      message.success(t('detail.terminated'))
    } else if (action === 'restore') {
      await restoreProject(projectId.value, reason)
      await refreshAfterLifecycle(1)
      message.success(t('detail.restored'))
    } else {
      const targetNode = rollbackTargetNode.value
      if (!targetNode) {
        message.error(t('detail.rollbackMissing'))
        return
      }
      const nextNodes = await rollbackNode(projectId.value, targetNode.id, reason)
      nodes.value = nextNodes
      project.value = await getProject(projectId.value)
      activeNodeId.value = targetNode.id
      message.success(t('detail.rollbackSuccess', { name: targetNode.name }))
    }
    reasonModal.open = false
    reasonModal.action = null
    rollbackTargetNode.value = null
    reasonValue.value = ''
  } catch {
    message.error(action === 'rollback' ? t('detail.rollbackFailed') : t('detail.lifecycleFailed'))
  } finally {
    reasonSubmitting.value = false
    rollingBack.value = false
    lifecycleSaving.value = false
  }
}

function onTerminate() {
  if (!canTerminateProject.value) return
  openReasonModal('terminate')
}

function onRestore() {
  if (!canRestoreProject.value) return
  openReasonModal('restore')
}

function onRollback() {
  const targetNode = activeNode.value
  if (!targetNode || !canRollbackActiveNode.value) {
    message.info(t('detail.cannotRollback'))
    return
  }
  openReasonModal('rollback', targetNode)
}

onMounted(() => {
  loadData()
  document.addEventListener('pointerdown', onDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  if (assignedMemberRefreshTimer) clearTimeout(assignedMemberRefreshTimer)
})
</script>

<template>
  <div class="project-detail-root">
  <div v-if="loading && !project" class="detail-loading"><a-spin size="large" /></div>
  <div v-else-if="loadError" class="detail-load-error card-surface" role="alert">
    <div class="detail-load-error__icon">!</div>
    <div class="detail-load-error__copy">
      <h1>{{ $t('detail.loadFailed') }}</h1>
      <p>{{ $t('detail.loadFailedHint') }}</p>
    </div>
    <a-button type="primary" class="pms-primary-button" @click="loadData">
      {{ $t('detail.loadRetry') }}
    </a-button>
  </div>
  <div v-else-if="project" class="project-detail-page pms-page-stack">
    <div class="detail-breadcrumb">
      <span class="detail-breadcrumb__back" @click="router.push('/projects')">
        <ArrowLeftOutlined /> {{ $t('detail.breadcrumbList') }}
      </span>
      <span class="detail-breadcrumb__separator">/</span>
      <span>{{ $t('detail.breadcrumbCurrent') }}</span>
    </div>

    <section class="project-header pms-detail-panel pms-detail-hero card-surface">
      <div class="project-header__top">
        <div class="project-header__identity">
          <h1>{{ project.name }}</h1>
          <a-tag :color="projectStatusTagColor(project.status)" class="project-header__status">
            {{ $t(projectStatusKey(project.status)) }}
          </a-tag>
          <span class="pms-project-badge pms-project-badge--level">{{ getProjectLevelBadge(project.projectLevel) }}</span>
          <span class="pms-project-badge pms-project-badge--priority">{{ getPriorityBadge(project.priority) }}</span>
        </div>
        <div class="project-header__actions">
          <a-dropdown v-if="canTerminateProject || canRestoreProject" placement="bottomRight">
            <a-button
              class="project-header__more pms-project-button pms-project-button--text pms-project-button--icon pms-project-button--small"
              :aria-label="$t('detail.more')"
              :title="$t('detail.more')"
            >
              <MoreOutlined />
            </a-button>
            <template #overlay>
              <a-menu>
                <a-menu-item v-if="canTerminateProject" key="terminate" :disabled="lifecycleSaving" @click="onTerminate">
                  {{ $t('detail.terminate') }}
                </a-menu-item>
                <a-menu-item v-if="canRestoreProject" key="restore" :disabled="lifecycleSaving" @click="onRestore">
                  {{ $t('detail.restore') }}
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </div>

      <div class="project-header__meta">
        <div class="project-header__meta-item project-header__meta-item--divider">
          <span>{{ $t('detail.manager') }}：</span>
          <strong>{{ projectManagerDisplay.label }}</strong>
        </div>
        <div class="project-header__meta-item project-header__meta-item--wide project-header__meta-item--divider">
          <span>{{ $t('detail.businessLine') }}：</span>
          <strong :title="businessLineDisplay">{{ businessLineDisplay || $t('detail.unassigned') }}</strong>
        </div>
        <div class="project-header__meta-item">
          <span>{{ $t('detail.projectPeriod') }}：</span>
          <strong>{{ formatDate(project.startDate) }} → {{ formatDate(project.endDate) }}</strong>
        </div>
      </div>

      <div class="project-header__insights">
        <div class="project-header__insight">
          <span>{{ $t('detail.projectProgress') }}</span>
          <strong>{{ projectProgress }}%</strong>
          <small class="project-header__insight-details">
            <span class="project-header__insight-submetric">
              {{ $t('detail.nodeProgress') }}
              <strong class="project-header__insight-submetric-value">{{ currentNodeProgress }}%</strong>
              <span class="project-header__insight-task-count">{{ $t('detail.nodeTaskCountSummary', { done: activeNodeTaskSummary.done, total: activeNodeTaskSummary.total }) }}</span>
            </span>
          </small>
        </div>
      </div>
    </section>

    <section class="flow-card pms-detail-panel pms-section-panel card-surface">
      <div class="section-title-row pms-section-heading">
        <div>
          <h2>{{ $t('detail.flow') }}</h2>
        </div>
        <span class="flow-count"><NodeIndexOutlined /> {{ $t('detail.nodeCount', { count: nodes.length }) }}</span>
      </div>
      <NodeNavigator :nodes="nodes" :active-id="activeNodeId ?? 0" @select="onSelectNode" />
    </section>

    <section v-if="activeNode" class="node-detail-card pms-detail-panel pms-section-panel card-surface">
      <div class="node-detail-header">
        <div class="node-detail-title">
          <div class="node-detail-title__copy">
            <div class="node-detail-title__heading">
              <span class="node-detail-title__dot" :class="`node-detail-title__dot--${activeNode.status}`" />
              <h2>{{ activeNode.name }}</h2>
              <a-tag :color="nodeStatusTagColor(activeNode.status)">{{ getNodeStatusLabel(activeNode.status) }}</a-tag>
            </div>
            <p v-if="activeNode.description" class="node-detail-title__description">{{ activeNode.description }}</p>
            <p v-if="activeNodeReadOnly" class="node-detail-title__readonly-hint" role="note">
              {{ $t('detail.nodeReadonlyHint') }}
            </p>
          </div>
        </div>
        <div class="node-detail-actions">
          <a-button
            v-if="canRollbackActiveNode"
            class="pms-project-button pms-project-button--secondary"
            :loading="rollingBack"
            @click="onRollback"
          >
            <RollbackOutlined /> {{ $t('detail.rollback') }}
          </a-button>
          <a-button
            v-if="canCompleteActiveNode"
            type="primary"
            class="pms-primary-button pms-project-button pms-project-button--primary"
            :loading="submitting"
            @click="onComplete"
          >
            {{ $t('detail.completeNode') }}
          </a-button>
        </div>
      </div>

      <div class="node-assignment-row pms-assignment-grid">
        <div class="node-owner-row" role="group" :aria-label="$t('detail.nodeAssignment')">
          <span class="node-owner-row__label">{{ $t('detail.nodeOwner') }}</span>
          <div class="node-owner-row__control">
            <PersonSelect
              :key="`node-owner-${activeNode.id}`"
              :model-value="activeNode.ownerId"
              class="node-owner-row__select"
              :options="nodeOwnerOptions"
              :loading="nodeOwnerSaving"
              :disabled="!canAssignNodeOwner || activeNodeReadOnly"
              :placeholder="getNodeOwnerDisplay(activeNode.ownerName) || $t('detail.unassigned')"
              @change="onNodeOwnerSelection"
            />
          </div>
        </div>

        <div class="node-owner-row node-schedule-row" role="group" :aria-label="$t('detail.nodeSchedule')">
          <span class="node-owner-row__label">{{ $t('detail.nodeSchedule') }}</span>
          <div class="node-owner-row__control">
            <a-range-picker
              :key="`node-schedule-${activeNode.id}`"
              v-model:value="nodeSchedule"
              value-format="YYYY-MM-DD"
              class="node-schedule-picker"
              :placeholder="[$t('project.startDate'), $t('project.endDate')]"
              :disabled="!canEditActiveNode || activeNodeReadOnly"
              @change="onNodeScheduleChange"
            />
            <a-spin v-if="nodeScheduleSaving" size="small" />
          </div>
        </div>
      </div>

      <div v-if="showKickoffProfile" ref="profileContainer" class="node-tab-profile">
        <div class="project-profile-section">
          <div class="profile-section-title-row">
            <div class="profile-section-title">{{ $t('detail.profileBasics') }}</div>
            <span v-if="profileSaving" class="profile-save-state">{{ $t('detail.profileSaving') }}</span>
          </div>
          <div class="project-profile-grid">
            <template
              v-for="field in projectProfileFields"
              :key="field.key"
            >
              <div
                class="project-profile-field"
                :class="{
                  'project-profile-field--wide': field.wide,
                  'project-profile-field--multiline': field.multiline,
                }"
              >
                <span class="project-profile-field__label project-profile-field__label--required">{{ $t(field.label) }}</span>
                <div v-if="field.key === 'description'" class="project-description-editor">
                  <a-textarea
                    v-model:value="profileForm.description"
                    :rows="4"
                    :disabled="!canManageProject || activeNodeReadOnly"
                    class="project-profile-control project-description-control"
                    @input="markProfileDirty"
                  />
                </div>
                <a-select
                  v-else-if="field.key === 'priority'"
                  v-model:value="profileForm.priority"
                  class="project-profile-control"
                  :options="priorityOptions"
                  :disabled="!canManageProject || activeNodeReadOnly"
                  @change="markProfileDirty"
                />
                <a-select
                  v-else-if="field.key === 'projectLevel'"
                  v-model:value="profileForm.projectLevel"
                  class="project-profile-control"
                  :options="projectLevelOptions"
                  :disabled="!canManageProject || activeNodeReadOnly"
                  @change="markProfileDirty"
                />
                <BusinessLineSelect
                  v-else-if="field.key === 'businessLine'"
                  v-model="businessLinePath"
                  class="project-profile-control"
                  :options="businessLineOptions"
                  :placeholder="$t('detail.selectBusinessLine')"
                  :disabled="!canManageProject || activeNodeReadOnly"
                />
                <a-range-picker
                  v-else-if="field.key === 'schedule'"
                  v-model:value="profileForm.schedule"
                  value-format="YYYY-MM-DD"
                  class="project-profile-control"
                  :placeholder="[$t('project.startDate'), $t('project.endDate')]"
                  :disabled="!canManageProject || activeNodeReadOnly"
                  @change="markProfileDirty"
                />
              </div>
            </template>
          </div>
        </div>

        <a-divider />

        <div class="project-profile-section">
          <div class="profile-section-title">{{ $t('detail.profilePeople') }}</div>
          <div class="project-people-grid">
            <div class="project-people-item">
              <span class="project-profile-field__label project-profile-field__label--required">{{ $t('detail.manager') }}</span>
              <PersonSelect
                v-model="profileForm.projectManagerId"
                class="project-profile-control project-people-control"
                :options="nodeOwnerOptions"
                :disabled="!canSetProjectManager || activeNodeReadOnly"
                @change="onProjectManagerChange"
              />
            </div>
            <div class="project-people-item">
              <span class="project-profile-field__label project-profile-field__label--required">{{ $t('detail.members') }}</span>
              <PersonSelect
                v-model="profileForm.memberIds"
                class="project-profile-control project-people-control project-members-control"
                multiple
                allow-clear
                :max-tag-count="2"
                :options="profileUserOptions"
                :placeholder="$t('detail.selectMembers')"
                :disabled="!canManageMembers || activeNodeReadOnly"
                @change="markMembersDirty"
              />
            </div>
            <div class="project-people-item">
              <span class="project-profile-field__label">{{ $t('detail.followers') }}</span>
              <PersonSelect
                v-model="profileForm.followerIds"
                class="project-profile-control project-people-control project-members-control"
                multiple
                allow-clear
                :max-tag-count="2"
                :options="profileUserOptions"
                :placeholder="$t('detail.selectFollowers')"
                :disabled="!canManageMembers || activeNodeReadOnly"
                @change="markFollowersDirty"
              />
            </div>
          </div>
        </div>

        <a-divider />
      </div>

      <RequirementScopeWorkbench
        v-if="activeNode.nodeKey === 'requirement'"
        ref="requirementScopeRef"
        :key="activeNode.id"
        :project-id="projectId"
        :node-id="activeNode.id"
        :node-read-only="activeNodeReadOnly"
        :can-edit="canEditActiveNode"
        :can-create-task="Boolean(activeNode.permissions?.canManageTasks)"
        @baseline-status="onRequirementBaselineStatus"
        @saved="onRequirementSaved"
        @create-task="onCreateTaskFromRequirement"
      />

      <SolutionDesignWorkbench
        v-if="activeNode.nodeKey === 'design'"
        :key="activeNode.id"
        :project-id="projectId"
        :node-id="activeNode.id"
        :node-read-only="activeNodeReadOnly"
        :can-edit="canEditActiveNode"
        :reviewer-options="nodeOwnerOptions"
      />

      <PlanResourceRiskWorkbench
        v-if="activeNode.nodeKey === 'plan'"
        ref="planResourceRiskRef"
        :key="activeNode.id"
        :project-id="projectId"
        :node-id="activeNode.id"
        :node-roles="activeNode.roles"
        :owner-options="nodeOwnerOptions"
        :node-read-only="activeNodeReadOnly"
        :can-edit="canEditActiveNode"
        @baseline-status="onPlanBaselineStatus"
      />

      <AcceptanceWorkbench
        v-if="activeNode.nodeKey === 'acceptance'"
        ref="acceptanceRef"
        :key="activeNode.id"
        :project-id="projectId"
        :node-id="activeNode.id"
        :node-read-only="activeNodeReadOnly"
        :can-edit="canEditActiveNode"
        @baseline-status="onAcceptanceStatus"
      />

      <DevelopmentControlWorkbench
        v-if="activeNode.nodeKey === 'develop'"
        :key="activeNode.id"
        :project-id="projectId"
        :node-id="activeNode.id"
        :project-name="project.name"
        :project-manager-name="projectManagerDisplay.label"
        :node-read-only="activeNodeReadOnly"
        :can-edit="canEditActiveNode"
        :owner-options="nodeOwnerOptions"
      />

      <ReleaseDecisionHandoverWorkbench
        v-if="activeNode.nodeKey === 'release'"
        ref="releaseWorkbenchRef"
        :key="activeNode.id"
        :project-id="projectId"
        :node-id="activeNode.id"
        :node-read-only="activeNodeReadOnly"
        :can-edit="canEditActiveNode"
        @completion-ready="onReleaseCompletionReady"
      />

      <ValueReviewWorkbench
        v-if="activeNode.nodeKey === 'review'"
        ref="valueReviewWorkbenchRef"
        :key="activeNode.id"
        :project-id="projectId"
        :node-id="activeNode.id"
        :node-read-only="activeNodeReadOnly"
        :can-edit="canEditActiveNode"
        @completion-ready="onValueReviewCompletionReady"
      />

      <KnowledgeStandardWorkbench
        v-if="activeNode.nodeKey === 'knowledge'"
        ref="knowledgeStandardRef"
        :key="activeNode.id"
        :project-id="projectId"
        :node-id="activeNode.id"
        :node-read-only="activeNodeReadOnly"
        :can-edit="canEditActiveNode"
        :owner-options="nodeOwnerOptions"
      />

      <a-divider />

      <section class="node-task-section">
        <div class="section-title-row section-title-row--compact pms-section-heading">
          <div>
            <h2>{{ $t('task.board') }}</h2>
          </div>
        </div>
        <TaskKanban
          ref="taskKanbanRef"
          :project-id="projectId"
          :node-id="activeNode.id"
          :project="project"
          :node="activeNode"
          :focus-task-id="focusTaskId"
          @focused="onTaskFocusConsumed"
          @task-progress="onTaskProgress"
        />
      </section>
    </section>

    <section class="management-card pms-detail-panel pms-section-panel card-surface">
      <div class="section-title-row section-title-row--compact pms-section-heading">
        <div>
          <h2 id="project-collaboration-title">{{ $t('detail.collaboration') }}</h2>
        </div>
      </div>
      <a-tabs
        v-model:activeKey="activeSection"
        class="project-collaboration-tabs"
        :destroy-inactive-tab-pane="true"
        aria-labelledby="project-collaboration-title"
      >
        <a-tab-pane key="gantt" :tab="$t('detail.viewGantt')">
          <div v-if="scheduleLoading" class="schedule-loading"><a-spin /></div>
          <ProjectScheduleChart
            v-else
            :project="project"
            :nodes="nodes"
            :tasks="scheduleTasks"
            :iteration-plans="scheduleIterationPlans"
            :selected-node-id="activeNodeId"
            :can-edit-node="canEditScheduleNode"
            :saving-node-id="scheduleSavingNodeId"
            @select-node="onScheduleSelectNode"
            @open-task="onScheduleOpenTask"
            @update-node-schedule="onScheduleNodeScheduleChange"
          />
        </a-tab-pane>
        <a-tab-pane key="calendar" :tab="$t('detail.viewCalendar')">
          <div v-if="scheduleLoading" class="schedule-loading"><a-spin /></div>
          <ProjectScheduleCalendar
            v-else
            :project="project"
            :nodes="nodes"
            :tasks="scheduleTasks"
            :iteration-plans="scheduleIterationPlans"
            :selected-node-id="activeNodeId"
            @select-node="onScheduleSelectNode"
            @open-task="onScheduleOpenTask"
          />
        </a-tab-pane>
        <a-tab-pane key="members" :tab="$t('detail.memberTab')">
          <Members :project-id="projectId" :can-manage="canManageMembers" :revision="membersRevision" />
        </a-tab-pane>
        <a-tab-pane key="comments" :tab="$t('detail.comments')">
          <Comments :project-id="projectId" :can-write="canWriteComment" />
        </a-tab-pane>
      </a-tabs>
    </section>

    <a-modal
      v-model:open="reasonModal.open"
      class="pms-project-modal"
      :title="reasonModal.title"
      :ok-text="reasonModal.okText"
      :ok-type="reasonModal.okType"
      :confirm-loading="reasonSubmitting"
      :mask-closable="!reasonSubmitting"
      :closable="!reasonSubmitting"
      @ok="onReasonModalOk"
      @cancel="closeReasonModal"
    >
      <p class="reason-modal__description">{{ reasonModal.description }}</p>
      <div class="reason-modal__field">
        <div class="reason-modal__label"><span>*</span> {{ $t('detail.reason') }}</div>
        <a-textarea
          v-model:value="reasonValue"
          :rows="4"
          :maxlength="200"
          show-count
          :disabled="reasonSubmitting"
          :placeholder="$t('detail.reasonPlaceholder')"
        />
      </div>
    </a-modal>
  </div>
  </div>
</template>

<style scoped>
.project-detail-root { min-width: 0; }
.project-detail-page { max-width: 1440px; margin: 0 auto; }
.detail-loading { display: flex; align-items: center; justify-content: center; min-height: 420px; }
.detail-load-error { display: flex; align-items: center; gap: 16px; max-width: 760px; margin: 96px auto; padding: 24px; }
.detail-load-error__icon { display: grid; flex: 0 0 auto; width: 36px; height: 36px; place-items: center; color: #fff; font-size: 20px; font-weight: 700; background: var(--pms-danger); border-radius: 50%; }
.detail-load-error__copy { flex: 1; min-width: 0; }
.detail-load-error__copy h1 { margin: 0; color: var(--pms-text); font-size: 18px; font-weight: 650; }
.detail-load-error__copy p { margin: 5px 0 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-body); }
.card-surface { background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: var(--pms-radius); box-shadow: var(--pms-shadow-sm); }
.detail-breadcrumb { display: flex; align-items: center; gap: 9px; margin-bottom: 14px; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.detail-breadcrumb__back { color: var(--pms-text-muted); cursor: pointer; }
.detail-breadcrumb__back:hover { color: var(--pms-primary); }
.detail-breadcrumb__separator { color: var(--pms-text-faint); }
.project-header {
  --pms-primary: #1769e0;
  --pms-primary-dark: #1258bf;
  --pms-primary-soft: #eaf2ff;
  --pms-bg: #f5f7fb;
  --pms-surface-muted: #f8faff;
  --pms-text: #17243b;
  --pms-text-muted: #5d6d85;
  --pms-text-faint: #8997aa;
  --pms-border: #e5eaf2;
  --pms-border-strong: #d7dfeb;
  --pms-success: #21a366;
  --pms-success-soft: #eaf8f0;
  --pms-warning: #b9680c;
  --pms-warning-soft: #fff5e8;
  --pms-status-active: #ef8e1b;
  --pms-danger: #d95b58;
  --pms-danger-soft: #fff0ef;
  --pms-shadow-sm: 0 1px 2px rgb(31 54 92 / 4%), 0 8px 20px rgb(31 54 92 / 4%);
  --pms-shadow-interactive: 0 5px 12px rgb(23 105 224 / 20%);
  padding: 24px 26px 19px;
  border-radius: 14px;
  box-shadow: 0 12px 28px rgb(31 54 92 / 7%);
}
.project-header__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.project-header__meta, .project-header__insights { display: flex; align-items: baseline; justify-content: flex-start; }
.project-header__identity, .project-header__actions { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
.project-header__identity { min-width: 0; }
.project-header__identity h1, .section-title-row h2, .node-detail-title h2 { margin: 0; color: var(--pms-text); }
.project-header__identity h1 { overflow: hidden; font-size: 24px; font-weight: 720; letter-spacing: -.02em; line-height: var(--pms-line-height-tight); text-overflow: ellipsis; white-space: nowrap; }
.project-header__status { margin: 0; }
.project-header__actions { flex: 0 0 auto; }
.project-header__more { flex: 0 0 32px; color: var(--pms-text-muted); }
.project-header__meta { flex-wrap: wrap; gap: 9px 25px; min-width: 0; margin-top: 13px; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.project-header__meta-item { display: flex; align-items: baseline; min-width: 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); white-space: nowrap; }
.project-header__meta-item > span { flex: 0 0 auto; }
.project-header__meta-item strong { min-width: 0; overflow: hidden; color: #3d4b63; font-weight: 650; text-overflow: ellipsis; }
.project-header__meta-item--wide { flex: 0 1 auto; max-width: min(100%, 620px); }
.project-header__meta-item--divider { padding-right: 20px; border-right: 1px solid #e8edf4; }
.project-header__insights { gap: 24px; margin-top: 19px; padding-top: 17px; border-top: 1px solid var(--pms-border); }
.project-header__insight { display: flex; align-items: baseline; min-width: 0; gap: 8px; }
.project-header__insight > span { color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.project-header__insight > strong { color: #31415b; font-size: 14px; font-weight: 720; }
.project-header__insight small { color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.project-header__insight-details { display: inline-flex; flex-wrap: wrap; align-items: baseline; min-width: 0; gap: 4px 8px; }
.project-header__insight-submetric { color: var(--pms-text-muted); font-weight: 400; }
.project-header__insight-submetric-value { margin-left: 4px; color: #31415b; font-weight: 720; }
.project-header__insight-task-count { margin-left: 4px; font-weight: 400; }
.node-detail-title__dot { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 20px; height: 20px; color: #fff; font-size: var(--pms-font-size-compact); border-radius: 6px; }
.node-detail-title__dot--1 { background: var(--pms-status-active); }
.node-detail-title__dot--2 { background: var(--pms-success); }
.node-detail-title__dot--3 { background: var(--pms-danger); }
.node-detail-title__dot--0 { background: var(--pms-status-neutral); }
.flow-card, .node-detail-card, .management-card { margin-top: 14px; padding: 20px 24px; }
.section-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.section-title-row h2 { font-size: var(--pms-font-size-section); font-weight: 600; line-height: var(--pms-line-height-tight); }
.section-title-row p { margin: 5px 0 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.flow-count { display: inline-flex; align-items: center; gap: 5px; padding: 5px 9px; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); background: var(--pms-surface-muted); border-radius: 6px; }
.node-detail-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.node-detail-title, .node-detail-actions { display: flex; align-items: flex-start; gap: 12px; }
.node-detail-title { align-items: center; }
.node-detail-title { flex: 1; min-width: 0; }
.node-detail-actions { flex: 0 0 auto; }
.node-detail-title__dot { width: 12px; height: 12px; border-radius: 50%; }
.node-detail-title h2 { font-size: 17px; font-weight: 600; line-height: var(--pms-line-height-tight); }
.node-detail-card :deep(.ant-divider) { margin: 16px 0; border-color: var(--pms-border); }
.node-detail-title__copy { min-width: 0; flex: 1; }
.node-detail-title__heading { display: flex; align-items: center; gap: 10px; min-width: 0; }
.node-detail-title__description { max-width: 100%; margin: 4px 0 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-normal); }
.node-detail-title__readonly-hint { margin: 7px 0 0; color: var(--pms-warning); font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-normal); }
.node-assignment-row { display: flex; align-items: flex-end; gap: 24px; margin-top: 16px; }
.node-owner-row { display: flex; align-items: center; flex: 1 1 0; gap: 10px; width: auto; min-width: 0; }
.node-owner-row { min-height: 58px; padding: 10px 12px; background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: 8px; }
.node-owner-row__label { flex: 0 0 76px; color: var(--pms-text-muted); font-size: var(--pms-font-size-body); }
.node-owner-row__control { display: flex; flex: 1 1 auto; align-items: center; gap: 8px; width: auto; min-width: 0; }
.node-owner-row__select { width: 100%; }
.node-schedule-row { margin-top: 0; }
.node-schedule-picker { width: min(100%, 380px); }
.profile-section-title { margin-bottom: 14px; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.profile-section-title-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.profile-section-title-row .profile-section-title { margin-bottom: 0; }
.profile-save-state { color: var(--pms-primary); font-size: var(--pms-font-size-compact); }
.project-profile-section { margin-top: 2px; }
.node-tab-profile { padding: 16px 18px; background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: 6px; }
.project-profile-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 36px; row-gap: 12px; }
.project-profile-field { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 12px; align-items: start; min-width: 0; }
.project-profile-field--wide { grid-column: span 2; }
.project-profile-field__label { padding-top: 8px; color: var(--pms-text-muted); font-size: var(--pms-font-size-body); white-space: nowrap; }
.project-profile-field__label--required { display: inline-flex; align-items: center; }
.project-profile-field__label--required::before { content: '*'; display: inline-block; margin-right: 3px; color: var(--pms-danger); line-height: 1; }
.project-profile-control { width: 100%; }
.project-profile-control :deep(.ant-select-selector), .project-profile-control :deep(.ant-picker), .project-profile-control :deep(.ant-input), .project-profile-control :deep(.business-line-select__trigger) { min-height: 36px; }
.project-description-control { min-height: 96px; max-height: 320px; resize: vertical; }
.project-description-editor { min-width: 0; }
.project-members-control :deep(.ant-select-selector) { max-height: 36px; min-height: 36px; overflow: hidden; align-items: center; }
.project-members-control :deep(.ant-select-selection-overflow) { flex-wrap: nowrap; overflow: hidden; }
.project-people-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 28px; }
.project-people-item { display: flex; align-items: flex-start; gap: 12px; min-width: 0; }
.project-people-item .project-profile-field__label { flex: 0 0 auto; }
.project-people-control { min-width: 0; flex: 1; }
.section-title-row--compact { margin-bottom: 6px; }
.project-collaboration-tabs :deep(.ant-tabs-nav) { margin-bottom: 18px; border-bottom: 1px solid var(--pms-border); }
.project-collaboration-tabs :deep(.ant-tabs-tab) { margin: 0 24px 0 0; padding: 10px 0 11px; color: var(--pms-text-muted); font-size: var(--pms-font-size-body); transition: color var(--pms-motion-fast) ease; }
.project-collaboration-tabs :deep(.ant-tabs-tab:hover),
.project-collaboration-tabs :deep(.ant-tabs-tab:focus-visible) { color: var(--pms-primary); }
.project-collaboration-tabs :deep(.ant-tabs-tab-active .ant-tabs-tab-btn) { color: var(--pms-primary); font-weight: 700; }
.project-collaboration-tabs :deep(.ant-tabs-ink-bar) { height: 3px; border-radius: 3px 3px 0 0; }
.project-collaboration-tabs :deep(.ant-tabs-content-holder) { min-width: 0; }
.schedule-loading { display: grid; place-items: center; min-height: 220px; }
.reason-modal__description { margin: 0 0 16px; color: var(--pms-text-muted); font-size: var(--pms-font-size-body); line-height: var(--pms-line-height-normal); }
.reason-modal__field { display: grid; gap: 7px; }
.reason-modal__label { color: var(--pms-text); font-size: var(--pms-font-size-body); }
.reason-modal__label span { margin-right: 3px; color: var(--pms-danger); }
@media (min-width: 1100px) {
  .project-header { margin-inline: -7px; }
}
@media (max-width: 900px) {
  .project-header__top, .project-header__meta, .project-header__insights { align-items: flex-start; flex-wrap: wrap; }
  .project-header__meta-item--wide { flex: 1 1 100%; }
  .project-header__meta-item--divider { padding-right: 0; border-right: 0; }
}
@media (max-width: 640px) {
  .project-header, .flow-card, .node-detail-card, .management-card { padding: 18px 16px; }
  .node-tab-profile { padding: 14px; }
  .project-header__top, .project-header__meta, .project-header__insights { gap: 12px; }
  .project-header__actions { width: auto; margin-left: auto; }
  .project-header__actions .ant-btn { flex: 0 0 32px; }
  .project-header__meta { display: grid; grid-template-columns: 1fr; gap: 8px; }
  .project-header__meta-item, .project-header__meta-item--wide { min-width: 0; }
  .project-header__meta-item--wide strong { display: -webkit-box; overflow: hidden; white-space: normal; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .project-header__insights { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .node-detail-header, .section-title-row { align-items: flex-start; flex-direction: column; }
  .node-detail-actions { align-self: stretch; justify-content: flex-end; }
  .node-assignment-row { align-items: stretch; flex-direction: column; gap: 10px; }
  .node-owner-row { align-items: flex-start; flex-direction: column; gap: 8px; width: 100%; min-width: 0; }
  .node-owner-row__control, .node-owner-row__select { width: 100%; }
      .node-owner-row__control { flex-basis: auto; }
      .node-schedule-picker { width: 100%; }
      .project-profile-grid, .project-people-grid { grid-template-columns: 1fr; }
  .project-profile-field--wide { grid-column: auto; }
}
</style>
