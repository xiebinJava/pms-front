<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeftOutlined,
  CheckOutlined,
  NodeIndexOutlined,
  PictureOutlined,
  RollbackOutlined,
} from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import { getFollowers } from '/@/api/follower'
import { addMember, getMembers } from '/@/api/member'
import { getTask, getTasks } from '/@/api/task'
import { getMilestones } from '/@/api/milestone'
import { getProject, restoreProject, terminateProject, updateProject, uploadProjectImage } from '/@/api/project'
import { completeNode, getNodes, rollbackNode, updateNodeOwner, updateNodeSchedule } from '/@/api/node'
import { getProjectOrgTree } from '/@/api/admin-org'
import { searchUsers } from '/@/api/user'
import { priorityKey, projectStatusKey, Priority, statusTagColor } from '/@/enums'
import { formatDate, formatDateTime } from '/@/utils/format'
import {
  canRollbackNode,
  buildBusinessLineOptions,
  findOrgUnitById,
  getElapsedDays,
  getMissingKickoffProfileFields,
  formatPersonLabel,
  getNodeOwnerDisplay,
  getPersonDisplay,
  getProjectProfileFields,
  getProjectManagerDisplay,
  getProjectOverallProgress,
  getNodeStatusMeta,
  getOrgUnitPath,
  getProjectStatusTone,
  isNodeReadOnly,
  isKickoffNode,
  normalizeRequiredReason,
  shouldAutoSaveProfile,
} from './workflow'
import NodeNavigator from './components/NodeNavigator.vue'
import TaskKanban from './components/TaskKanban.vue'
import ProjectScheduleChart from './components/ProjectScheduleChart.vue'
import ProjectScheduleCalendar from './components/ProjectScheduleCalendar.vue'
import Milestones from './components/Milestones.vue'
import Members from './components/Members.vue'
import Comments from './components/Comments.vue'
import PersonSelect from './components/PersonSelect.vue'
import type { PersonOption } from './workflow'
import type { Milestone, OrgUnit, Project, ProjectMember, ProjectNode, Task, User } from '/@/types/domain'

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
const focusMilestoneId = computed(() => {
  const raw = route.query.milestone
  const value = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isFinite(value) && value > 0 ? value : null
})

const project = ref<Project | null>(null)
const nodes = ref<ProjectNode[]>([])
const loading = ref(false)
const submitting = ref(false)
const rollingBack = ref(false)
const lifecycleSaving = ref(false)
const nodeOwnerSaving = ref(false)
const profileDirty = ref(false)
const profileSaving = ref(false)
let profileSavePromise: Promise<void> | null = null
const descriptionImageInput = ref<HTMLInputElement | null>(null)
const descriptionImageUploading = ref(false)
const profileContainer = ref<HTMLElement | null>(null)
const activeNodeId = ref<number | null>(null)
const activeSection = ref('milestones')
const projectProfileFields = getProjectProfileFields()
const priorityOptions = computed(() => Priority.options().map((opt) => ({
  ...opt,
  label: t(priorityKey(opt.value)),
})))
const members = ref<ProjectMember[]>([])
const followers = ref<User[]>([])
const profileUserOptions = ref<PersonOption[]>([])
const orgTree = ref<OrgUnit[]>([])
const nodeSchedule = ref<string[]>([])
const nodeScheduleSaving = ref(false)
const scheduleTasks = ref<Task[]>([])
const scheduleMilestones = ref<Milestone[]>([])
const scheduleLoading = ref(false)
const scheduleLoaded = ref(false)
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
const nodeProgress = computed(() => getProjectOverallProgress(
  project.value?.progress,
  doneNodeCount.value,
  nodes.value.length,
))
const elapsedDays = computed(() => getElapsedDays(project.value?.startDate))
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
    markProfileDirty()
  },
})
const projectCreatorOption = computed(() => {
  const creatorId = project.value?.createdBy
  return creatorId == null ? undefined : profileUserOptions.value.find((option) => option.value === creatorId)
})
const projectManagerOption = computed(() => {
  const managerId = profileForm.projectManagerId
  return managerId == null ? undefined : profileUserOptions.value.find((option) => option.value === managerId)
})
const projectCreatorDisplay = computed(() => getPersonDisplay(
  projectCreatorOption.value,
  project.value?.createdByName || t('detail.unrecorded'),
))
const projectManagerDisplay = computed(() => {
  const managerName = projectManagerOption.value?.label || project.value?.projectManagerName
  const display = getPersonDisplay(projectManagerOption.value, managerName)
  const assigned = getProjectManagerDisplay(managerName)
  return { ...display, label: assigned || t('detail.unassigned'), pending: !assigned }
})
const projectStatusTone = computed(() => {
  return getProjectStatusTone(project.value?.status)
})
const canManageProject = computed(() => project.value?.permissions?.canManageProject ?? project.value?.status === 1)
const canAssignNodeOwner = computed(() => project.value?.permissions?.canAssignNodeOwner ?? project.value?.status === 1)
const canEditActiveNode = computed(() => activeNode.value?.permissions?.canEdit ?? canManageProject.value)
const canTerminateProject = computed(() => project.value?.permissions?.canTerminateProject ?? false)
const canRestoreProject = computed(() => project.value?.permissions?.canRestoreProject ?? false)
const activeNodeReadOnly = computed(() => Boolean(
  activeNode.value && ((activeNode.value.permissions?.readOnly ?? isNodeReadOnly(activeNode.value.status))
    || project.value?.status !== 1),
))
const canCompleteActiveNode = computed(() => Boolean(
  activeNode.value && (activeNode.value.permissions?.canComplete ?? activeNode.value.status === 1),
))
const canRollbackActiveNode = computed(() => Boolean(
  activeNode.value && (activeNode.value.permissions?.canRollback
    ?? canRollbackNode(activeNode.value.sort, activeNode.value.status)),
))

function getNodeStatusLabel(status: number): string {
  return t(getNodeStatusMeta(status).label)
}

function joinLocalizedFields(keys: string[]): string {
  return keys.map((key) => t(key)).join(locale.value.startsWith('zh') ? '、' : ', ')
}

async function loadData() {
  loading.value = true
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
    members.value = memberData
    followers.value = followerData
    orgTree.value = orgData
    resetProfileForm()
    profileUserOptions.value = []
    await onProfileUserSearch()
    const current = nodes.value.find((node) => node.status === 1)
    activeNodeId.value = (current || nodes.value[0])?.id ?? null
    await applyFocusTask()
    applyFocusNode()
    if (isScheduleSection(activeSection.value)) {
      scheduleLoaded.value = false
      void loadSchedule()
    }
  } catch (error) {
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
    const [taskData, milestoneData] = await Promise.all([
      getTasks(projectId.value),
      getMilestones(projectId.value),
    ])
    scheduleTasks.value = taskData
    scheduleMilestones.value = milestoneData
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
  scheduleMilestones.value = []
})

watch(focusTaskId, (taskId) => {
  if (taskId) void applyFocusTask()
})

watch(focusNodeId, () => {
  applyFocusNode()
})

watch(focusMilestoneId, (milestoneId) => {
  if (milestoneId) activeSection.value = 'milestones'
}, { immediate: true })

function onScheduleSelectNode(nodeId: number) {
  const node = nodes.value.find((item) => item.id === nodeId)
  if (node) onSelectNode(node)
}

function onScheduleOpenTask(taskId: number, nodeId?: number) {
  if (nodeId) activeNodeId.value = nodeId
  void router.replace({ query: { ...route.query, task: String(taskId) } })
  document.querySelector('.node-task-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function onScheduleOpenMilestone() {
  activeSection.value = 'milestones'
}

function resetProfileForm() {
  if (!project.value) return
  Object.assign(profileForm, {
    description: project.value.description || '',
    priority: project.value.priority,
    projectManagerId: project.value.projectManagerId,
    schedule: [project.value.startDate, project.value.endDate].filter(Boolean) as string[],
    orgUnitId: project.value.orgUnitId,
    memberIds: members.value.map((member) => member.userId),
    followerIds: followers.value.map((user) => user.id),
  })
  profileDirty.value = false
}

watch(activeNode, (node) => {
  nodeSchedule.value = [node?.startDate, node?.endDate].filter(Boolean) as string[]
}, { immediate: true })

function formatUserOption(user: User): PersonOption {
  return { value: user.id, label: formatPersonLabel(user), avatar: user.avatar }
}

function mergeProfileUsers(users: User[]) {
  const optionMap = new Map(profileUserOptions.value.map((option) => [option.value, option]))
  users.forEach((user) => optionMap.set(user.id, formatUserOption(user)))
  profileUserOptions.value = Array.from(optionMap.values())
}

async function onProfileUserSearch(keyword = '') {
  const users = await searchUsers(keyword)
  mergeProfileUsers([...members.value.map((member) => ({
    id: member.userId,
    username: member.username || '',
    nickname: member.nickname || '',
    email: member.email,
    avatar: member.avatar,
  })), ...followers.value, ...users])
}

function markProfileDirty() {
  profileDirty.value = true
}

function getPersonInitials(name?: string): string {
  const value = name?.trim()
  return value ? value.slice(0, 2) : '?'
}

async function onNodeOwnerChange(ownerId: number | undefined) {
  if (!activeNode.value || !canAssignNodeOwner.value) {
    message.info(t('detail.noAssignOwner'))
    return
  }
  nodeOwnerSaving.value = true
  try {
    const updatedNode = await updateNodeOwner(projectId.value, activeNode.value.id, ownerId)
    const index = nodes.value.findIndex((node) => node.id === updatedNode.id)
    if (index >= 0) nodes.value[index] = updatedNode
    message.success(t('detail.ownerUpdated'))
  } catch {
    message.error(t('detail.ownerSaveFailed'))
  } finally {
    nodeOwnerSaving.value = false
  }
}

function onNodeOwnerSelection(value: number | number[] | undefined) {
  const ownerId = Array.isArray(value) ? value[0] : value
  void onNodeOwnerChange(ownerId)
}

async function onBusinessLineChange(value: Array<number | string> | undefined) {
  const path = Array.isArray(value) ? value : []
  const orgUnitId = path.length ? Number(path[path.length - 1]) : undefined
  const businessLine = findOrgUnitById(orgTree.value, orgUnitId)
  const leaderId = businessLine?.leaderUserId
  if (leaderId == null || !activeNode.value || !canAssignNodeOwner.value || activeNodeReadOnly.value) return

  try {
    if (!members.value.some((member) => member.userId === leaderId)) {
      await addMember(projectId.value, { userId: leaderId })
      members.value = await getMembers(projectId.value)
      profileForm.memberIds = members.value.map((member) => member.userId)
    }
    await onNodeOwnerChange(leaderId)
  } catch {
    message.error(t('detail.autoAssignFailed'))
  }
}

async function onNodeScheduleChange(value: unknown, dateStrings?: string[] | string) {
  if (!activeNode.value) return
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
  nodeScheduleSaving.value = true
  try {
    const updated = await updateNodeSchedule(projectId.value, activeNode.value.id, {
      startDate: next[0],
      endDate: next[1],
    })
    const index = nodes.value.findIndex((node) => node.id === updated.id)
    if (index >= 0) nodes.value[index] = updated
    nodeSchedule.value = next
    message.success(t('detail.scheduleUpdated'))
  } catch {
    nodeSchedule.value = [activeNode.value.startDate, activeNode.value.endDate].filter(Boolean) as string[]
    message.error(t('detail.scheduleSaveFailed'))
  } finally {
    nodeScheduleSaving.value = false
  }
}

function openDescriptionImagePicker() {
  descriptionImageInput.value?.click()
}

async function onDescriptionImageSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    message.warning(t('detail.imageRequired'))
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    message.warning(t('detail.imageTooLarge'))
    return
  }

  descriptionImageUploading.value = true
  try {
    const uploaded = await uploadProjectImage(file)
    profileForm.description = `${profileForm.description.trimEnd()}${profileForm.description.trim() ? '\n' : ''}![${uploaded.name}](${uploaded.url})`
    markProfileDirty()
    message.success(t('detail.imageInserted'))
  } finally {
    descriptionImageUploading.value = false
  }
}

function isProfileOverlayTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && Boolean(target.closest('.ant-select-dropdown, .ant-picker-dropdown, .ant-dropdown, .ant-popover'))
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
      project.value = await updateProject(project.value!.id, {
        name: project.value!.name,
        description: profileForm.description,
        priority: profileForm.priority,
        projectManagerId: profileForm.projectManagerId,
        startDate: profileForm.schedule?.[0] || undefined,
        endDate: profileForm.schedule?.[1] || undefined,
        memberIds: profileForm.memberIds,
        followerIds: profileForm.followerIds,
        orgUnitId: profileForm.orgUnitId,
      })
      members.value = await getMembers(project.value.id)
      followers.value = await getFollowers(project.value.id)
      resetProfileForm()
    } catch {
      profileDirty.value = true
      message.error(t('detail.profileSaveFailed'))
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

function onComplete() {
  if (!activeNode.value || !canCompleteActiveNode.value) {
    message.info(t('detail.cannotComplete'))
    return
  }
  if (showKickoffProfile.value) {
    const missingFields = getMissingKickoffProfileFields(profileForm)
    if (missingFields.length) {
      message.warning(t('detail.completeMissing', { fields: joinLocalizedFields(missingFields) }))
      return
    }
  }
  Modal.confirm({
    title: t('detail.completeTitle'),
    content: t('detail.completeContent', { name: activeNode.value.name }),
    okText: t('detail.completeOk'),
    cancelText: t('common.cancel'),
    onOk: async () => {
      if (profileSavePromise) await profileSavePromise
      submitting.value = true
      try {
        const nextNodes = await completeNode(projectId.value, activeNode.value!.id)
        nodes.value = nextNodes
        project.value = await getProject(projectId.value)
        const current = nextNodes.find((node) => node.status === 1)
        activeNodeId.value = current?.id ?? activeNodeId.value
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
})
</script>

<template>
  <div v-if="loading && !project" class="detail-loading"><a-spin size="large" /></div>
  <div v-else-if="project" class="project-detail-page pms-page-stack">
    <div class="detail-breadcrumb">
      <span class="detail-breadcrumb__back" @click="router.push('/projects')">
        <ArrowLeftOutlined /> {{ $t('detail.breadcrumbList') }}
      </span>
      <span class="detail-breadcrumb__separator">/</span>
      <span>{{ $t('detail.breadcrumbCurrent') }}</span>
    </div>

    <section class="project-header pms-detail-panel pms-detail-hero card-surface">
      <div class="project-header__main">
        <div class="project-title-row">
          <span class="project-status-icon" :class="`project-status-icon--${projectStatusTone}`">
            <CheckOutlined v-if="project.status === 2" />
            <span v-else />
          </span>
          <h1>{{ project.name }}</h1>
          <a-tag :color="statusTagColor[project.status]">{{ $t(projectStatusKey(project.status)) }}</a-tag>
          <span v-if="elapsedDays !== null" class="project-elapsed">{{ $t('detail.elapsed', { days: elapsedDays }) }}</span>
          <a-button
            v-if="canTerminateProject"
            type="default"
            danger
            size="small"
            class="project-lifecycle-action project-terminate-button"
            :loading="lifecycleSaving"
            @click="onTerminate"
          >
            {{ $t('detail.terminate') }}
          </a-button>
          <a-button
            v-if="canRestoreProject"
            type="primary"
            size="small"
            class="pms-primary-button project-lifecycle-action"
            :loading="lifecycleSaving"
            @click="onRestore"
          >
            {{ $t('detail.restore') }}
          </a-button>
        </div>
        <div class="project-meta-stack">
          <div class="project-meta-line">
            <span>{{ project.code }}</span>
            <span class="meta-separator">·</span>
            <span>{{ $t('detail.rangeTo', { start: formatDate(project.startDate), end: formatDate(project.endDate) }) }}</span>
          </div>
          <div class="project-created-line">
            <span class="project-meta-person">
              <span class="project-meta-person__label">{{ $t('detail.createdBy') }}</span>
              <a-avatar :src="projectCreatorDisplay.avatar || project.createdByAvatar" :size="20" class="project-meta-person__avatar">
                {{ getPersonInitials(projectCreatorDisplay.label) }}
              </a-avatar>
              <strong>{{ projectCreatorDisplay.label }}</strong>
            </span>
            <span class="meta-separator">·</span>
            <span>{{ $t('detail.createdAt', { time: formatDateTime(project.createdAt) }) }}</span>
          </div>
        </div>
        <div class="project-people-line">
          <div class="project-person project-person--manager">
            <a-avatar
              :src="projectManagerDisplay.avatar || project.projectManagerAvatar"
              :size="32"
              class="project-person__avatar"
              :class="{ 'project-person__avatar--pending': projectManagerDisplay.pending }"
            >
              {{ getPersonInitials(projectManagerDisplay.label) }}
            </a-avatar>
            <div class="project-person__copy">
              <span>{{ $t('detail.manager') }}</span>
              <strong>{{ projectManagerDisplay.label }}</strong>
            </div>
          </div>
          <div v-if="project.orgUnitPath || project.orgUnitName" class="project-person project-person--business-line">
            <div class="project-person__copy">
              <span>{{ $t('detail.businessLine') }}</span>
              <strong :title="project.orgUnitPath || project.orgUnitName">{{ project.orgUnitPath || project.orgUnitName }}</strong>
              <small v-if="project.orgUnitLeaderName">{{ $t('detail.leader', { name: project.orgUnitLeaderName }) }}</small>
            </div>
          </div>
        </div>
      </div>

      <div class="project-header__summary">
        <div class="summary-item">
          <span class="summary-item__label">{{ $t('detail.nodeProgress') }}</span>
          <strong>{{ doneNodeCount }}/{{ nodes.length || 0 }}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-item__label">{{ $t('detail.taskDone') }}</span>
          <strong>{{ project.doneTaskCount }}/{{ project.taskCount }}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-item__label">{{ $t('detail.members') }}</span>
          <strong>{{ $t('detail.memberCount', { count: project.memberCount }) }}</strong>
        </div>
        <div class="summary-progress">
          <span class="summary-item__label">{{ $t('detail.overall') }}</span>
          <a-progress :percent="nodeProgress" :show-info="false" size="small" />
          <strong>{{ nodeProgress }}%</strong>
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
              <a-tag :color="statusTagColor[activeNode.status]">{{ getNodeStatusLabel(activeNode.status) }}</a-tag>
            </div>
            <p v-if="activeNode.description" class="node-detail-title__description">{{ activeNode.description }}</p>
          </div>
        </div>
        <div class="node-detail-actions">
          <a-button
            v-if="canRollbackActiveNode"
            :loading="rollingBack"
            @click="onRollback"
          >
            <RollbackOutlined /> {{ $t('detail.rollback') }}
          </a-button>
          <a-button
            v-if="canCompleteActiveNode"
            type="primary"
            class="pms-primary-button"
            :loading="submitting"
            @click="onComplete"
          >
            {{ $t('detail.completeNode') }}
          </a-button>
        </div>
      </div>

      <div class="node-assignment-row pms-assignment-grid">
        <div class="node-owner-row">
          <span class="node-owner-row__label">{{ $t('detail.nodeOwner') }}</span>
          <div class="node-owner-row__control">
            <PersonSelect
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

        <div class="node-owner-row node-schedule-row">
          <span class="node-owner-row__label">{{ $t('detail.nodeSchedule') }}</span>
          <div class="node-owner-row__control">
            <a-range-picker
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

      <a-divider />

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
                  <div class="project-description-toolbar">
                    <input
                      ref="descriptionImageInput"
                      class="project-description-file-input"
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      @change="onDescriptionImageSelected"
                    />
                    <a-button
                      type="default"
                      size="small"
                      class="project-description-toolbar__action"
                      :loading="descriptionImageUploading"
                      :disabled="!canManageProject || activeNodeReadOnly"
                      @click="openDescriptionImagePicker"
                    >
                      <PictureOutlined /> {{ $t('detail.insertImage') }}
                    </a-button>
                    <span class="project-description-toolbar__hint">{{ $t('detail.insertImageHint') }}</span>
                  </div>
                </div>
                <a-select
                  v-else-if="field.key === 'priority'"
                  v-model:value="profileForm.priority"
                  class="project-profile-control"
                  :options="priorityOptions"
                  :disabled="!canManageProject || activeNodeReadOnly"
                  @change="markProfileDirty"
                />
                <a-cascader
                  v-else-if="field.key === 'businessLine'"
                  v-model:value="businessLinePath"
                  class="project-profile-control"
                  :options="businessLineOptions"
                  :change-on-select="true"
                  allow-clear
                  :placeholder="$t('detail.selectBusinessLine')"
                  :disabled="!canManageProject || activeNodeReadOnly"
                  @change="onBusinessLineChange"
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
                :disabled="!canManageProject || activeNodeReadOnly"
                @change="markProfileDirty"
              />
            </div>
            <div class="project-people-item">
              <span class="project-profile-field__label project-profile-field__label--required">{{ $t('detail.members') }}</span>
              <PersonSelect
                v-model="profileForm.memberIds"
                class="project-profile-control project-people-control project-members-control"
                multiple
                :max-tag-count="2"
                :options="profileUserOptions"
                :placeholder="$t('detail.selectMembers')"
                remote-search
                :disabled="!canManageProject || activeNodeReadOnly"
                @search="onProfileUserSearch"
                @change="markProfileDirty"
              />
            </div>
            <div class="project-people-item">
              <span class="project-profile-field__label">{{ $t('detail.followers') }}</span>
              <PersonSelect
                v-model="profileForm.followerIds"
                class="project-profile-control project-people-control project-members-control"
                multiple
                :max-tag-count="2"
                :options="profileUserOptions"
                :placeholder="$t('detail.selectFollowers')"
                remote-search
                :disabled="!canManageProject || activeNodeReadOnly"
                @search="onProfileUserSearch"
                @change="markProfileDirty"
              />
            </div>
          </div>
        </div>

        <a-divider />
      </div>

      <a-divider />

      <section class="node-task-section">
        <div class="section-title-row section-title-row--compact pms-section-heading">
          <div>
            <h2>{{ $t('task.board') }}</h2>
          </div>
        </div>
        <TaskKanban
          :project-id="projectId"
          :node-id="activeNode.id"
          :project="project"
          :node="activeNode"
          :focus-task-id="focusTaskId"
          @focused="onTaskFocusConsumed"
        />
      </section>
    </section>

    <section class="management-card pms-detail-panel pms-section-panel card-surface">
      <div class="section-title-row section-title-row--compact pms-section-heading">
        <div>
          <h2>{{ $t('detail.collaboration') }}</h2>
        </div>
      </div>
      <a-tabs v-model:activeKey="activeSection" :destroy-inactive-tab-pane="true">
        <a-tab-pane key="milestones" :tab="$t('detail.milestones')">
          <Milestones :project-id="projectId" :can-manage="canManageProject" />
        </a-tab-pane>
        <a-tab-pane key="gantt" :tab="$t('detail.viewGantt')">
          <div v-if="scheduleLoading" class="schedule-loading"><a-spin /></div>
          <ProjectScheduleChart
            v-else
            :project="project"
            :nodes="nodes"
            :tasks="scheduleTasks"
            :milestones="scheduleMilestones"
            :selected-node-id="activeNodeId"
            @select-node="onScheduleSelectNode"
            @open-task="onScheduleOpenTask"
            @open-milestone="onScheduleOpenMilestone"
          />
        </a-tab-pane>
        <a-tab-pane key="calendar" :tab="$t('detail.viewCalendar')">
          <div v-if="scheduleLoading" class="schedule-loading"><a-spin /></div>
          <ProjectScheduleCalendar
            v-else
            :project="project"
            :nodes="nodes"
            :tasks="scheduleTasks"
            :milestones="scheduleMilestones"
            :selected-node-id="activeNodeId"
            @select-node="onScheduleSelectNode"
            @open-task="onScheduleOpenTask"
            @open-milestone="onScheduleOpenMilestone"
          />
        </a-tab-pane>
        <a-tab-pane key="members" :tab="$t('detail.memberTab')">
          <Members :project-id="projectId" :can-manage="canManageProject" />
        </a-tab-pane>
        <a-tab-pane key="comments" :tab="$t('detail.comments')">
          <Comments :project-id="projectId" />
        </a-tab-pane>
      </a-tabs>
    </section>

    <a-modal
      v-model:open="reasonModal.open"
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
</template>

<style scoped>
.project-detail-page { max-width: 1440px; margin: 0 auto; }
.detail-loading { display: flex; align-items: center; justify-content: center; min-height: 420px; }
.card-surface { background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: var(--pms-radius); box-shadow: var(--pms-shadow-sm); }
.detail-breadcrumb { display: flex; align-items: center; gap: 9px; margin-bottom: 14px; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.detail-breadcrumb__back { color: var(--pms-text-muted); cursor: pointer; }
.detail-breadcrumb__back:hover { color: var(--pms-primary); }
.detail-breadcrumb__separator { color: var(--pms-text-faint); }
.project-header { display: flex; justify-content: space-between; gap: 32px; padding: 20px 28px; }
.project-header__main { min-width: 0; flex: 1; }
.project-title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.project-title-row h1, .section-title-row h2, .node-detail-title h2 { margin: 0; color: var(--pms-text); }
.project-title-row h1 { font-size: var(--pms-font-size-title); font-weight: 650; line-height: var(--pms-line-height-tight); }
.project-lifecycle-action { margin-left: 2px; }
.project-terminate-button { font-weight: 600; }
.project-status-icon, .node-detail-title__dot { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 20px; height: 20px; color: #fff; font-size: var(--pms-font-size-compact); border-radius: 6px; }
.project-status-icon--active, .node-detail-title__dot--1 { background: var(--pms-warning); }
.project-status-icon--completed, .node-detail-title__dot--2 { background: var(--pms-success); }
.project-status-icon--terminated, .project-status-icon--deleted, .node-detail-title__dot--3 { background: var(--pms-danger); }
.project-status-icon--pending, .node-detail-title__dot--0 { background: var(--pms-status-neutral); }
.project-status-icon > span { width: 7px; height: 7px; background: #fff; border-radius: 50%; }
.project-elapsed { color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.project-meta-stack { display: grid; gap: 2px; margin-top: 6px; }
.project-meta-line { display: flex; flex-wrap: wrap; gap: 7px; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-normal); }
.project-created-line { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-normal); }
.project-meta-person { display: inline-flex; align-items: center; gap: 5px; }
.project-meta-person__label { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.project-meta-person__avatar { color: var(--pms-primary); background: var(--pms-primary-soft); }
.project-meta-person strong { color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); font-weight: 600; }
.project-people-line { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
.project-person { display: flex; align-items: center; gap: 9px; min-width: 190px; padding: 8px 12px; border: 1px solid var(--pms-border); border-radius: 9px; box-shadow: 0 2px 8px rgb(15 23 42 / 4%); }
.project-person--manager { background: #fff7e8; border-color: rgb(250 140 22 / 35%); }
.project-person--business-line { max-width: min(430px, 100%); background: var(--pms-primary-soft); border-color: rgb(22 119 255 / 20%); }
.project-person__avatar { color: #fff; background: var(--pms-primary); }
.project-person__avatar--pending { color: var(--pms-text-muted); background: var(--pms-surface-strong); }
.project-person__copy { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.project-person__copy span { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.project-person__copy strong { overflow: hidden; color: var(--pms-text); font-size: var(--pms-font-size-body); font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.project-person__copy small { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.meta-separator { color: var(--pms-text-faint); }
.project-header__summary { display: grid; grid-template-columns: repeat(3, minmax(88px, 1fr)); align-items: center; gap: 20px; min-width: 420px; padding-left: 28px; border-left: 1px solid var(--pms-border); }
.summary-item, .summary-progress { display: flex; flex-direction: column; gap: 5px; }
.summary-item__label { color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.summary-item strong, .summary-progress strong { color: var(--pms-text); font-size: 16px; font-weight: 600; }
.summary-progress { grid-column: span 3; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; }
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
.node-assignment-row { display: flex; align-items: flex-end; gap: 24px; margin-top: 16px; }
.node-owner-row { display: flex; align-items: center; flex: 1 1 0; gap: 10px; width: auto; min-width: 0; }
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
.project-profile-control :deep(.ant-select-selector), .project-profile-control :deep(.ant-picker), .project-profile-control :deep(.ant-input) { min-height: 36px; }
.project-description-control { min-height: 96px; max-height: 320px; resize: vertical; }
.project-description-editor { min-width: 0; }
.project-description-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; margin-top: 10px; padding-top: 8px; color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); line-height: var(--pms-line-height-normal); border-top: 1px solid var(--pms-border); }
.project-description-toolbar__action { display: inline-flex; align-items: center; gap: 5px; min-height: 30px; padding-inline: 10px; color: var(--pms-primary) !important; background: var(--pms-surface) !important; border-color: var(--pms-border-strong) !important; border-radius: var(--pms-radius-sm); box-shadow: none; font-weight: 600; }
.project-description-toolbar__action:hover:not(:disabled) { color: var(--pms-primary-dark) !important; background: var(--pms-primary-soft) !important; border-color: var(--pms-primary) !important; }
.project-description-toolbar__action:disabled { color: var(--pms-text-faint) !important; background: var(--pms-surface-muted) !important; border-color: var(--pms-border) !important; }
.project-description-toolbar__hint { display: inline-flex; align-items: center; min-height: 30px; color: var(--pms-text-faint); }
.project-description-file-input { display: none; }
.project-members-control :deep(.ant-select-selector) { max-height: 36px; min-height: 36px; overflow: hidden; align-items: center; }
.project-members-control :deep(.ant-select-selection-overflow) { flex-wrap: nowrap; overflow: hidden; }
.project-people-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 28px; }
.project-people-item { display: flex; align-items: flex-start; gap: 12px; min-width: 0; }
.project-people-item .project-profile-field__label { flex: 0 0 auto; }
.project-people-control { min-width: 0; flex: 1; }
.section-title-row--compact { margin-bottom: 6px; }
.schedule-loading { display: grid; place-items: center; min-height: 220px; }
.reason-modal__description { margin: 0 0 16px; color: var(--pms-text-muted); font-size: var(--pms-font-size-body); line-height: var(--pms-line-height-normal); }
.reason-modal__field { display: grid; gap: 7px; }
.reason-modal__label { color: var(--pms-text); font-size: var(--pms-font-size-body); }
.reason-modal__label span { margin-right: 3px; color: var(--pms-danger); }
@media (max-width: 900px) {
  .project-header { flex-direction: column; }
  .project-header__summary { min-width: 0; padding-top: 20px; padding-left: 0; border-top: 1px solid var(--pms-border); border-left: 0; }
}
@media (max-width: 640px) {
  .project-header, .flow-card, .node-detail-card, .management-card { padding: 18px 16px; }
  .node-tab-profile { padding: 14px; }
  .project-header__summary { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .node-detail-header, .section-title-row { align-items: flex-start; flex-direction: column; }
  .node-detail-actions { align-self: stretch; justify-content: flex-end; }
  .node-assignment-row { align-items: stretch; flex-direction: column; gap: 10px; }
  .node-owner-row { align-items: flex-start; flex-direction: column; gap: 8px; width: 100%; min-width: 0; }
  .node-owner-row__control, .node-owner-row__select { width: 100%; }
  .node-owner-row__control { flex-basis: auto; }
  .node-schedule-picker { width: 100%; }
  .project-description-toolbar { align-items: flex-start; }
  .project-description-toolbar__hint { flex: 1 1 220px; }
  .project-profile-grid, .project-people-grid { grid-template-columns: 1fr; }
  .project-profile-field--wide { grid-column: auto; }
  .summary-progress { grid-column: span 3; }
}
</style>
