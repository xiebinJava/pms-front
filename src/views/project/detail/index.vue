<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeftOutlined,
  CheckOutlined,
  MoreOutlined,
  NodeIndexOutlined,
  RollbackOutlined,
} from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import { getFollowers } from '/@/api/follower'
import { getMembers } from '/@/api/member'
import { getProject, updateProject } from '/@/api/project'
import { completeNode, getNodes, rollbackNode } from '/@/api/node'
import { searchUsers } from '/@/api/user'
import { Priority, ProjectStatus, statusTagColor } from '/@/enums'
import { formatDate, formatDateTime } from '/@/utils/format'
import {
  canRollbackNode,
  getElapsedDays,
  getNodeDetailFields,
  getProjectProfileFields,
  getNodeProgress,
  isKickoffNode,
  shouldAutoSaveProfile,
} from './workflow'
import NodeNavigator from './components/NodeNavigator.vue'
import TaskKanban from './components/TaskKanban.vue'
import Milestones from './components/Milestones.vue'
import Members from './components/Members.vue'
import Comments from './components/Comments.vue'
import type { Project, ProjectMember, ProjectNode, User } from '/@/types/domain'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => Number(route.params.id))

const project = ref<Project | null>(null)
const nodes = ref<ProjectNode[]>([])
const loading = ref(false)
const submitting = ref(false)
const rollingBack = ref(false)
const profileDirty = ref(false)
const profileSaving = ref(false)
const profileContainer = ref<HTMLElement | null>(null)
const activeNodeId = ref<number | null>(null)
const activeSection = ref('tasks')
const projectProfileFields = getProjectProfileFields()
const members = ref<ProjectMember[]>([])
const followers = ref<User[]>([])
const profileUserOptions = ref<{ value: number; label: string }[]>([])
const profileForm = reactive({
  description: '',
  priority: 1,
  ownerId: undefined as number | undefined,
  schedule: [] as string[],
  memberIds: [] as number[],
  followerIds: [] as number[],
})

const activeNode = computed<ProjectNode | null>(
  () => nodes.value.find((node) => node.id === activeNodeId.value) || null,
)
const doneNodeCount = computed(() => nodes.value.filter((node) => node.status === 2).length)
const nodeProgress = computed(() => getNodeProgress(doneNodeCount.value, nodes.value.length))
const elapsedDays = computed(() => getElapsedDays(project.value?.startDate))
const nodeDetailFields = computed(() => (activeNode.value ? getNodeDetailFields(activeNode.value) : []))
const showKickoffProfile = computed(() => isKickoffNode(activeNode.value?.nodeKey))
const projectStatusTone = computed(() => {
  if (project.value?.status === 2) return 'completed'
  if (project.value?.status === 1) return 'active'
  return 'pending'
})

function getProjectProfileValue(field: (typeof projectProfileFields)[number]): string {
  if (!project.value) return '—'
  switch (field.key) {
    case 'priority':
      return Priority.label(project.value.priority)
    case 'owner':
      return project.value.ownerName || '未设置'
    case 'schedule':
      return `${formatDate(project.value.startDate)} ~ ${formatDate(project.value.endDate)}`
    case 'createdAt':
      return formatDateTime(project.value.createdAt)
    case 'description':
      return project.value.description || '暂无项目描述'
  }
}

async function loadData() {
  loading.value = true
  try {
    const [projectData, nodeData, memberData, followerData] = await Promise.all([
      getProject(projectId.value),
      getNodes(projectId.value),
      getMembers(projectId.value),
      getFollowers(projectId.value),
    ])
    project.value = projectData
    nodes.value = nodeData
    members.value = memberData
    followers.value = followerData
    resetProfileForm()
    profileUserOptions.value = []
    await onProfileUserSearch()
    const current = nodes.value.find((node) => node.status === 1)
    activeNodeId.value = (current || nodes.value[0])?.id ?? null
  } finally {
    loading.value = false
  }
}

function onSelectNode(node: ProjectNode) {
  if (profileDirty.value) void onSaveProfile()
  activeNodeId.value = node.id
}

function resetProfileForm() {
  if (!project.value) return
  Object.assign(profileForm, {
    description: project.value.description || '',
    priority: project.value.priority,
    ownerId: project.value.ownerId,
    schedule: [project.value.startDate, project.value.endDate].filter(Boolean) as string[],
    memberIds: members.value.map((member) => member.userId),
    followerIds: followers.value.map((user) => user.id),
  })
  profileDirty.value = false
}

function formatUserOption(user: User): { value: number; label: string } {
  return { value: user.id, label: `${user.nickname} (${user.username})` }
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
  })), ...followers.value, ...users])
}

function markProfileDirty() {
  profileDirty.value = true
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
  profileDirty.value = false
  profileSaving.value = true
  try {
    project.value = await updateProject(project.value.id, {
      name: project.value.name,
      description: profileForm.description,
      priority: profileForm.priority,
      ownerId: profileForm.ownerId,
      startDate: profileForm.schedule?.[0] || undefined,
      endDate: profileForm.schedule?.[1] || undefined,
      memberIds: profileForm.memberIds,
      followerIds: profileForm.followerIds,
    })
    members.value = await getMembers(project.value.id)
    followers.value = await getFollowers(project.value.id)
    resetProfileForm()
  } catch {
    profileDirty.value = true
    message.error('项目资料保存失败，请重试')
  } finally {
    profileSaving.value = false
  }
}

function onComplete() {
  if (!activeNode.value) return
  Modal.confirm({
    title: '完成当前节点',
    content: `确定完成「${activeNode.value.name}」节点吗？完成后将自动解锁下一节点。`,
    okText: '完成',
    cancelText: '取消',
    onOk: async () => {
      submitting.value = true
      try {
        const nextNodes = await completeNode(projectId.value, activeNode.value!.id)
        nodes.value = nextNodes
        project.value = await getProject(projectId.value)
        const current = nextNodes.find((node) => node.status === 1)
        activeNodeId.value = current?.id ?? activeNodeId.value
        message.success('节点已完成，下一节点已解锁')
      } finally {
        submitting.value = false
      }
    },
  })
}

function onRollback() {
  const targetNode = activeNode.value
  if (!targetNode) return
  Modal.confirm({
    title: '回滚节点',
    content: `确定将项目回滚至「${targetNode.name}」吗？该节点之后的节点会恢复为待开始。`,
    okText: '确认回滚',
    cancelText: '取消',
    onOk: async () => {
      rollingBack.value = true
      try {
        const nextNodes = await rollbackNode(projectId.value, targetNode.id)
        nodes.value = nextNodes
        project.value = await getProject(projectId.value)
        activeNodeId.value = targetNode.id
        message.success(`已回滚至「${targetNode.name}」`)
      } finally {
        rollingBack.value = false
      }
    },
  })
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
  <div v-else-if="project" class="project-detail-page">
    <div class="detail-breadcrumb">
      <span class="detail-breadcrumb__back" @click="router.push('/projects')">
        <ArrowLeftOutlined /> 项目管理
      </span>
      <span class="detail-breadcrumb__separator">/</span>
      <span>项目详情</span>
    </div>

    <section class="project-header card-surface">
      <div class="project-header__main">
        <div class="project-title-row">
          <span class="project-status-icon" :class="`project-status-icon--${projectStatusTone}`">
            <CheckOutlined v-if="project.status === 2" />
            <span v-else />
          </span>
          <h1>{{ project.name }}</h1>
          <a-tag :color="statusTagColor[project.status]">{{ ProjectStatus.label(project.status) }}</a-tag>
          <span v-if="elapsedDays !== null" class="project-elapsed">已进行 {{ elapsedDays }} 天</span>
        </div>
        <div class="project-meta-line">
          <span>{{ project.code }}</span>
          <span class="meta-separator">·</span>
          <span>负责人：{{ project.ownerName || '未设置' }}</span>
          <span class="meta-separator">·</span>
          <span>{{ formatDate(project.startDate) }} 至 {{ formatDate(project.endDate) }}</span>
        </div>
      </div>

      <div class="project-header__summary">
        <div class="summary-item">
          <span class="summary-item__label">节点进度</span>
          <strong>{{ doneNodeCount }}/{{ nodes.length || 0 }}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-item__label">任务完成</span>
          <strong>{{ project.doneTaskCount }}/{{ project.taskCount }}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-item__label">项目成员</span>
          <strong>{{ project.memberCount }} 人</strong>
        </div>
        <div class="summary-progress">
          <span class="summary-item__label">总体进度</span>
          <a-progress :percent="nodeProgress" :show-info="false" size="small" />
          <strong>{{ nodeProgress }}%</strong>
        </div>
      </div>
    </section>

    <section class="flow-card card-surface">
      <div class="section-title-row">
        <div>
          <h2>项目流程</h2>
          <p>按节点推进项目，每个节点完成后自动解锁下一阶段</p>
        </div>
        <span class="flow-count"><NodeIndexOutlined /> {{ nodes.length }} 个节点</span>
      </div>
      <NodeNavigator :nodes="nodes" :active-id="activeNodeId ?? 0" @select="onSelectNode" />
    </section>

    <section v-if="activeNode" class="node-detail-card card-surface">
      <div class="node-detail-header">
        <div class="node-detail-title">
          <span class="node-detail-title__dot" :class="`node-detail-title__dot--${activeNode.status}`" />
          <div>
            <h2>{{ activeNode.name }}</h2>
          </div>
          <a-tag :color="activeNode.status === 2 ? 'success' : activeNode.status === 1 ? 'processing' : 'default'">
            {{ activeNode.status === 2 ? '已完成' : activeNode.status === 1 ? '进行中' : '待开始' }}
          </a-tag>
        </div>
        <div class="node-detail-actions">
          <a-button
            v-if="canRollbackNode(activeNode.sort, activeNode.status)"
            :loading="rollingBack"
            @click="onRollback"
          >
            <RollbackOutlined /> 回滚至此节点
          </a-button>
          <a-button
            v-if="activeNode.status === 1"
            type="primary"
            :loading="submitting"
            @click="onComplete"
          >
            <CheckOutlined /> 完成节点
          </a-button>
          <a-button type="text" aria-label="更多操作"><MoreOutlined /></a-button>
        </div>
      </div>

      <a-divider />

      <div v-if="showKickoffProfile" ref="profileContainer" class="node-tab-profile">
        <div class="project-profile-section">
          <div class="profile-section-title-row">
            <div class="profile-section-title">项目基本信息</div>
            <span v-if="profileSaving" class="profile-save-state">正在保存…</span>
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
                <span class="project-profile-field__label">{{ field.label }}</span>
                <a-textarea
                  v-if="field.key === 'description'"
                  v-model:value="profileForm.description"
                  :auto-size="{ minRows: 3, maxRows: 5 }"
                  class="project-profile-control"
                  @input="markProfileDirty"
                />
                <a-select
                  v-else-if="field.key === 'priority'"
                  v-model:value="profileForm.priority"
                  class="project-profile-control"
                  :options="Priority.options()"
                  @change="markProfileDirty"
                />
                <a-select
                  v-else-if="field.key === 'owner'"
                  v-model:value="profileForm.ownerId"
                  class="project-profile-control"
                  show-search
                  :filter-option="false"
                  :options="profileUserOptions"
                  @search="onProfileUserSearch"
                  @change="markProfileDirty"
                />
                <a-range-picker
                  v-else-if="field.key === 'schedule'"
                  v-model:value="profileForm.schedule"
                  value-format="YYYY-MM-DD"
                  class="project-profile-control"
                  @change="markProfileDirty"
                />
                <span v-else class="project-profile-field__value">{{ getProjectProfileValue(field) }}</span>
              </div>
            </template>
          </div>
        </div>

        <a-divider />

        <div class="project-profile-section">
          <div class="profile-section-title">角色与人员</div>
          <div class="project-people-grid">
            <div class="project-people-item">
              <span class="project-profile-field__label">项目负责人</span>
              <a-select
                v-model:value="profileForm.ownerId"
                class="project-profile-control project-people-control"
                show-search
                :filter-option="false"
                :options="profileUserOptions"
                @search="onProfileUserSearch"
                @change="markProfileDirty"
              />
            </div>
            <div class="project-people-item">
              <span class="project-profile-field__label">项目成员</span>
              <a-select
                v-model:value="profileForm.memberIds"
                class="project-profile-control project-people-control"
                mode="multiple"
                show-search
                :filter-option="false"
                :options="profileUserOptions"
                placeholder="请选择项目成员"
                @search="onProfileUserSearch"
                @change="markProfileDirty"
              />
            </div>
            <div class="project-people-item">
              <span class="project-profile-field__label">关注人</span>
              <a-select
                v-model:value="profileForm.followerIds"
                class="project-profile-control project-people-control"
                mode="multiple"
                show-search
                :filter-option="false"
                :options="profileUserOptions"
                placeholder="请选择关注人"
                @search="onProfileUserSearch"
                @change="markProfileDirty"
              />
            </div>
          </div>
        </div>

        <a-divider />
      </div>

      <div class="node-info-section">
        <div class="profile-section-title">节点信息</div>
        <div v-if="nodeDetailFields.length" class="node-form-grid">
          <div
            v-for="field in nodeDetailFields"
            :key="field.key"
            class="node-form-row"
            :class="{ 'node-form-row--wide': field.wide }"
          >
            <span class="node-form-row__label">{{ field.label }}</span>
            <span v-if="field.items?.length" class="node-form-row__value node-chip-list">
              <a-tag v-for="item in field.items" :key="item" color="blue">{{ item }}</a-tag>
            </span>
            <span v-else class="node-form-row__value">{{ field.value }}</span>
          </div>
        </div>
        <div v-else class="node-detail-empty">该节点暂未配置详细信息</div>
      </div>
    </section>

    <section class="management-card card-surface">
      <div class="section-title-row section-title-row--compact">
        <div>
          <h2>项目协作</h2>
          <p>继续管理任务、里程碑、成员和项目动态</p>
        </div>
      </div>
      <a-tabs v-model:activeKey="activeSection" :destroy-inactive-tab-pane="true">
        <a-tab-pane key="tasks" tab="任务看板">
          <TaskKanban :project-id="projectId" :project="project" />
        </a-tab-pane>
        <a-tab-pane key="milestones" tab="里程碑">
          <Milestones :project-id="projectId" />
        </a-tab-pane>
        <a-tab-pane key="members" tab="成员">
          <Members :project-id="projectId" />
        </a-tab-pane>
        <a-tab-pane key="comments" tab="动态">
          <Comments :project-id="projectId" />
        </a-tab-pane>
      </a-tabs>
    </section>
  </div>
</template>

<style scoped>
.project-detail-page { max-width: 1440px; margin: 0 auto; }
.detail-loading { display: flex; align-items: center; justify-content: center; min-height: 420px; }
.card-surface { background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: var(--pms-radius); box-shadow: var(--pms-shadow-sm); }
.detail-breadcrumb { display: flex; align-items: center; gap: 9px; margin-bottom: 14px; color: var(--pms-text-faint); font-size: 13px; }
.detail-breadcrumb__back { color: var(--pms-text-muted); cursor: pointer; }
.detail-breadcrumb__back:hover { color: var(--pms-primary); }
.detail-breadcrumb__separator { color: var(--pms-text-faint); }
.project-header { display: flex; justify-content: space-between; gap: 32px; padding: 24px 28px; }
.project-header__main { min-width: 0; flex: 1; }
.project-title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.project-title-row h1, .section-title-row h2, .node-detail-title h2 { margin: 0; color: var(--pms-text); }
.project-title-row h1 { font-size: 22px; font-weight: 650; }
.project-status-icon, .node-detail-title__dot { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 20px; height: 20px; color: #fff; font-size: 12px; border-radius: 6px; }
.project-status-icon--active, .node-detail-title__dot--1 { background: var(--pms-primary); }
.project-status-icon--completed, .node-detail-title__dot--2 { background: var(--pms-success); }
.project-status-icon--pending, .node-detail-title__dot--0 { background: var(--pms-text-faint); }
.project-status-icon > span { width: 7px; height: 7px; background: #fff; border-radius: 50%; }
.project-elapsed { color: var(--pms-text-faint); font-size: 13px; }
.project-meta-line { display: flex; flex-wrap: wrap; gap: 7px; color: var(--pms-text-faint); font-size: 12px; }
.meta-separator { color: var(--pms-text-faint); }
.project-header__summary { display: grid; grid-template-columns: repeat(3, minmax(88px, 1fr)); align-items: center; gap: 20px; min-width: 420px; padding-left: 28px; border-left: 1px solid var(--pms-border); }
.summary-item, .summary-progress { display: flex; flex-direction: column; gap: 5px; }
.summary-item__label { color: var(--pms-text-faint); font-size: 12px; }
.summary-item strong, .summary-progress strong { color: var(--pms-text); font-size: 17px; font-weight: 600; }
.summary-progress { grid-column: span 3; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; }
.flow-card, .node-detail-card, .management-card { margin-top: 16px; padding: 22px 28px; }
.section-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.section-title-row h2 { font-size: 16px; font-weight: 600; }
.section-title-row p { margin: 5px 0 0; color: var(--pms-text-faint); font-size: 12px; }
.flow-count { display: inline-flex; align-items: center; gap: 5px; padding: 5px 9px; color: var(--pms-text-muted); font-size: 12px; background: var(--pms-surface-muted); border-radius: 6px; }
.node-detail-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.node-detail-title, .node-detail-actions { display: flex; align-items: center; gap: 12px; }
.node-detail-title__dot { width: 12px; height: 12px; border-radius: 50%; }
.node-detail-title h2 { font-size: 18px; font-weight: 600; }
.profile-section-title { margin-bottom: 14px; color: var(--pms-text-faint); font-size: 12px; }
.profile-section-title-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.profile-section-title-row .profile-section-title { margin-bottom: 0; }
.profile-save-state { color: var(--pms-primary); font-size: 12px; }
.project-profile-section { margin-top: 2px; }
.project-profile-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 48px; row-gap: 14px; }
.project-profile-field { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 12px; align-items: start; min-width: 0; }
.project-profile-field--wide { grid-column: span 2; }
.project-profile-field__label { padding-top: 8px; color: var(--pms-text-muted); font-size: 13px; white-space: nowrap; }
.project-profile-field__value { min-width: 0; min-height: 20px; padding: 7px 11px; overflow: hidden; color: var(--pms-text); font-size: 13px; line-height: 1.55; background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: 5px; }
.project-profile-control { width: 100%; }
.project-profile-control :deep(.ant-select-selector), .project-profile-control :deep(.ant-picker), .project-profile-control :deep(.ant-input) { min-height: 36px; }
.project-profile-field--multiline .project-profile-control { min-height: 70px; }
.project-profile-field--multiline .project-profile-field__value { min-height: 70px; white-space: pre-wrap; }
.project-profile-field__value--muted { color: var(--pms-text-faint); }
.project-people-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px 48px; }
.project-people-item { display: flex; align-items: flex-start; gap: 12px; min-width: 0; }
.project-people-item .project-profile-field__label { flex: 0 0 auto; }
.project-people-item .project-profile-field__value { flex: 1; }
.project-people-control { min-width: 0; flex: 1; }
.project-person-list { display: flex; flex: 1; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
.project-person-chip { display: inline-flex; align-items: center; min-height: 28px; padding: 3px 10px; color: var(--pms-text); font-size: 13px; background: var(--pms-surface-strong); border: 1px solid var(--pms-border); border-radius: 5px; }
.node-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 48px; row-gap: 16px; }
.node-form-row { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 12px; align-items: start; min-width: 0; }
.node-form-row--wide { grid-column: span 2; }
.node-form-row__label { color: var(--pms-text-muted); font-size: 13px; }
.node-form-row__value { min-width: 0; color: var(--pms-text); font-size: 13px; line-height: 1.65; }
.node-form-row__value--muted { color: var(--pms-text-faint); }
.node-chip-list { display: flex; flex-wrap: wrap; gap: 6px; }
.node-detail-empty { padding: 20px 0; color: var(--pms-text-faint); font-size: 13px; }
.section-title-row--compact { margin-bottom: 6px; }
@media (max-width: 900px) {
  .project-header { flex-direction: column; }
  .project-header__summary { min-width: 0; padding-top: 20px; padding-left: 0; border-top: 1px solid var(--pms-border); border-left: 0; }
}
@media (max-width: 640px) {
  .project-header, .flow-card, .node-detail-card, .management-card { padding: 18px 16px; }
  .project-header__summary { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .node-detail-header, .section-title-row { align-items: flex-start; flex-direction: column; }
  .node-detail-actions { align-self: stretch; justify-content: flex-end; }
  .project-profile-grid, .project-people-grid, .node-form-grid { grid-template-columns: 1fr; }
  .project-profile-field--wide, .node-form-row--wide { grid-column: auto; }
  .summary-progress { grid-column: span 3; }
}
</style>
