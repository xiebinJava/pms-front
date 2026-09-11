<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import { MessageOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
import { createFeedback, getFeedback, listFeedback, reopenFeedback, updateFeedback } from '/@/api/feedback'
import PersonSelect from '/@/views/project/detail/components/PersonSelect.vue'
import { getProjectPage } from '/@/api/project'
import { getNodes } from '/@/api/node'
import { getTasks } from '/@/api/task'
import { useUserStore } from '/@/store/user'
import { formatDateTime } from '/@/utils/format'
import type { FeedbackPriorityCode, FeedbackStatusCode, FeedbackTicket, FeedbackTypeCode, Project, ProjectNode, Task } from '/@/types/domain'
import type { PersonOption } from '/@/views/project/detail/workflow'

const { t } = useI18n()
const userStore = useUserStore()
const isManager = computed(() => userStore.can('feedback:manage'))

const typeOptions: FeedbackTypeCode[] = ['QUESTION', 'BUG', 'FEATURE', 'UX', 'DATA', 'PERMISSION', 'OTHER']
const priorityOptions: FeedbackPriorityCode[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT']
const statusOptions: FeedbackStatusCode[] = ['PENDING_TRIAGE', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_CONFIRMATION', 'RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE', 'UNREPRODUCIBLE']

const filters = reactive({ keyword: '', feedbackType: undefined as FeedbackTypeCode | undefined, priority: undefined as FeedbackPriorityCode | undefined, status: undefined as FeedbackStatusCode | undefined })
const tickets = ref<FeedbackTicket[]>([])
const loading = ref(false)
const pagination = reactive({ current: 1, pageSize: 10, total: 0 })
const projectOptions = ref<Project[]>([])
const nodeOptions = ref<ProjectNode[]>([])
const taskOptions = ref<Task[]>([])
const contextLoading = ref(false)
const assigneeOptions = computed<PersonOption[]>(() => {
  if (managerForm.assigneeId == null || !detail.value?.assigneeName) return []
  return [{ value: managerForm.assigneeId, label: detail.value.assigneeName }]
})

const submitOpen = ref(false)
const submitLoading = ref(false)
const form = reactive({ title: '', content: '', feedbackType: 'QUESTION' as FeedbackTypeCode, priority: 'NORMAL' as FeedbackPriorityCode, projectId: undefined as number | undefined, taskId: undefined as number | undefined, nodeId: undefined as number | undefined, contextModule: '', sourceUrl: '' })

const detailOpen = ref(false)
const detailLoading = ref(false)
const detail = ref<FeedbackTicket | null>(null)
const updateLoading = ref(false)
const managerForm = reactive({ status: undefined as FeedbackStatusCode | undefined, priority: undefined as FeedbackPriorityCode | undefined, assigneeId: undefined as number | undefined, resolutionNote: '' })
const visibleTaskOptions = computed(() => form.nodeId == null
  ? taskOptions.value
  : taskOptions.value.filter((task) => task.nodeId === form.nodeId))

const columns = computed(() => [
  { title: t('feedback.title'), key: 'title', dataIndex: 'title', width: 260 },
  { title: t('feedback.type'), key: 'feedbackType', width: 106 },
  { title: t('feedback.priority'), key: 'priority', width: 88 },
  { title: t('feedback.status'), key: 'status', width: 126 },
  { title: t('feedback.reporter'), key: 'reporterName', width: 150 },
  { title: t('feedback.assignee'), key: 'assigneeName', width: 150 },
  { title: t('feedback.createdAt'), key: 'createdAt', width: 150 },
  { title: t('common.actions'), key: 'actions', width: 90 },
])

function typeLabel(value: string) { return t(`feedback.typeOptions.${value}`) }
function priorityLabel(value: string) { return t(`feedback.priorityOptions.${value}`) }
function statusLabel(value: string) { return t(`feedback.statusOptions.${value}`) }
function priorityColor(value: string) { return value === 'URGENT' || value === 'HIGH' ? 'orange' : value === 'LOW' ? 'blue' : 'default' }
function statusColor(value: string) {
  if (value === 'RESOLVED' || value === 'CLOSED') return 'green'
  if (value === 'REJECTED' || value === 'DUPLICATE' || value === 'UNREPRODUCIBLE') return 'red'
  if (value === 'IN_PROGRESS') return 'blue'
  return 'orange'
}
function errorText(error: unknown, fallback: string) { return error instanceof Error && error.message ? error.message : fallback }

async function load() {
  loading.value = true
  try {
    const result = await listFeedback({
      keyword: filters.keyword.trim() || undefined,
      feedbackType: filters.feedbackType,
      priority: filters.priority,
      status: filters.status,
      currPage: pagination.current,
      pageSize: pagination.pageSize,
    })
    tickets.value = result.list
    pagination.total = result.total
  } catch (error) {
    message.error(errorText(error, t('feedback.loadFailed')))
  } finally {
    loading.value = false
  }
}

function search() { pagination.current = 1; void load() }
function onTableChange(page: { current?: number; pageSize?: number }) {
  pagination.current = page.current || 1
  pagination.pageSize = page.pageSize || 10
  void load()
}

function openSubmit() {
  Object.assign(form, { title: '', content: '', feedbackType: 'QUESTION', priority: 'NORMAL', projectId: undefined, taskId: undefined, nodeId: undefined, contextModule: '', sourceUrl: '' })
  nodeOptions.value = []
  taskOptions.value = []
  submitOpen.value = true
}

async function loadProjectContext(projectId?: number) {
  nodeOptions.value = []
  taskOptions.value = []
  if (!projectId) return
  contextLoading.value = true
  try {
    const [nodes, tasks] = await Promise.all([getNodes(projectId), getTasks(projectId)])
    nodeOptions.value = nodes
    taskOptions.value = tasks
  } catch {
    // Context is optional. Keep the feedback form usable when a project has
    // no readable workflow data or a single auxiliary request fails.
    nodeOptions.value = []
    taskOptions.value = []
  } finally {
    contextLoading.value = false
  }
}

function onProjectChange(value: number | undefined) {
  form.projectId = value
  form.nodeId = undefined
  form.taskId = undefined
  void loadProjectContext(value)
}

function onNodeChange(value: number | undefined) {
  form.nodeId = value
  if (form.taskId != null && !visibleTaskOptions.value.some((task) => task.id === form.taskId)) {
    form.taskId = undefined
  }
}

function onTaskChange(value: number | undefined) {
  form.taskId = value
  const task = taskOptions.value.find((item) => item.id === value)
  if (task?.nodeId != null) form.nodeId = task.nodeId
}

async function submit() {
  if (!form.title.trim()) { message.error(t('feedback.requiredTitle')); return }
  if (!form.content.trim()) { message.error(t('feedback.requiredContent')); return }
  submitLoading.value = true
  try {
    const clientRequestId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `feedback-${Date.now()}-${Math.random().toString(16).slice(2)}`
    await createFeedback({ ...form, title: form.title.trim(), content: form.content.trim(), clientRequestId, projectId: form.projectId || undefined, taskId: form.taskId || undefined, nodeId: form.nodeId || undefined, contextModule: form.contextModule.trim() || undefined, sourceUrl: form.sourceUrl.trim() || undefined })
    submitOpen.value = false
    message.success(t('feedback.submitSuccess'))
    pagination.current = 1
    await load()
  } catch (error) {
    message.error(errorText(error, t('feedback.submitFailed')))
  } finally {
    submitLoading.value = false
  }
}

async function openDetail(record: FeedbackTicket) {
  detailOpen.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await getFeedback(record.id)
    Object.assign(managerForm, { status: detail.value.status, priority: detail.value.priority, assigneeId: detail.value.assigneeId, resolutionNote: detail.value.resolutionNote || '' })
  } catch (error) {
    message.error(errorText(error, t('feedback.detailFailed')))
    detailOpen.value = false
  } finally {
    detailLoading.value = false
  }
}

async function saveHandling() {
  if (!detail.value || !managerForm.status || !managerForm.priority) return
  updateLoading.value = true
  try {
    const updated = await updateFeedback(detail.value.id, { status: managerForm.status, priority: managerForm.priority, assigneeId: managerForm.assigneeId, resolutionNote: managerForm.resolutionNote.trim() || undefined, version: detail.value.version })
    detail.value = updated
    Object.assign(managerForm, { status: updated.status, priority: updated.priority, assigneeId: updated.assigneeId, resolutionNote: updated.resolutionNote || '' })
    message.success(t('feedback.updateSuccess'))
    await load()
  } catch (error) {
    message.error(errorText(error, t('feedback.updateFailed')))
  } finally {
    updateLoading.value = false
  }
}

async function reopen() {
  if (!detail.value) return
  updateLoading.value = true
  try {
    const updated = await reopenFeedback(detail.value.id, { version: detail.value.version, note: managerForm.resolutionNote.trim() || undefined })
    detail.value = updated
    Object.assign(managerForm, { status: updated.status, priority: updated.priority, assigneeId: updated.assigneeId, resolutionNote: updated.resolutionNote || '' })
    message.success(t('feedback.reopenSuccess'))
    await load()
  } catch (error) {
    message.error(errorText(error, t('feedback.updateFailed')))
  } finally {
    updateLoading.value = false
  }
}

async function loadAuxiliaryData() {
  try {
    const result = await getProjectPage({ currPage: 1, pageSize: 100 })
    projectOptions.value = result.list
  } catch { projectOptions.value = [] }
}

function canReopen(status?: FeedbackStatusCode) {
  return status === 'RESOLVED' || status === 'CLOSED' || status === 'REJECTED' || status === 'DUPLICATE' || status === 'UNREPRODUCIBLE'
}

onMounted(() => { void load(); void loadAuxiliaryData() })
</script>

<template>
  <section class="feedback-page pms-page-stack">
    <PmsPageHeader :title="$t('feedback.pageTitle')" :description="$t('feedback.pageDescription')">
      <template #actions>
        <a-button class="pms-secondary-button" @click="load"><ReloadOutlined /> {{ $t('feedback.refresh') }}</a-button>
        <a-button v-if="userStore.can('feedback:write')" type="primary" class="pms-primary-button" @click="openSubmit"><PlusOutlined /> {{ $t('feedback.create') }}</a-button>
      </template>
    </PmsPageHeader>

    <a-card :bordered="false" class="pms-table-panel feedback-panel">
      <div class="pms-table-toolbar feedback-toolbar" role="group" :aria-label="$t('feedback.filters')">
        <div class="pms-table-toolbar__filters">
          <a-input v-model:value="filters.keyword" class="pms-filter-control feedback-search" allow-clear :placeholder="$t('feedback.searchPlaceholder')" :aria-label="$t('feedback.searchPlaceholder')" @press-enter="search">
            <template #prefix><SearchOutlined /></template>
          </a-input>
          <a-select v-model:value="filters.feedbackType" class="pms-filter-control" allow-clear :placeholder="$t('feedback.typePlaceholder')" :aria-label="$t('feedback.type')" @change="search">
            <a-select-option v-for="value in typeOptions" :key="value" :value="value">{{ typeLabel(value) }}</a-select-option>
          </a-select>
          <a-select v-model:value="filters.priority" class="pms-filter-control" allow-clear :placeholder="$t('feedback.priorityPlaceholder')" :aria-label="$t('feedback.priority')" @change="search">
            <a-select-option v-for="value in priorityOptions" :key="value" :value="value">{{ priorityLabel(value) }}</a-select-option>
          </a-select>
          <a-select v-model:value="filters.status" class="pms-filter-control" allow-clear :placeholder="$t('feedback.statusPlaceholder')" :aria-label="$t('feedback.status')" @change="search">
            <a-select-option v-for="value in statusOptions" :key="value" :value="value">{{ statusLabel(value) }}</a-select-option>
          </a-select>
          <a-button class="pms-secondary-button pms-filter-button" :aria-label="$t('common.query')" @click="search"><ReloadOutlined /> {{ $t('common.query') }}</a-button>
        </div>
      </div>

      <div class="pms-table-scroll feedback-table-scroll">
        <a-table :data-source="tickets" :columns="columns" :loading="loading" row-key="id" :pagination="pagination" @change="onTableChange">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'title'">
              <button type="button" class="feedback-title" @click="openDetail(record)">{{ record.title }}</button>
              <div class="pms-table-subtext">{{ record.ticketNo }}<span v-if="record.contextModule"> · {{ record.contextModule }}</span></div>
            </template>
            <template v-else-if="column.key === 'feedbackType'">{{ typeLabel(record.feedbackType) }}</template>
            <template v-else-if="column.key === 'priority'"><a-tag :color="priorityColor(record.priority)">{{ priorityLabel(record.priority) }}</a-tag></template>
            <template v-else-if="column.key === 'status'"><a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag></template>
            <template v-else-if="column.key === 'reporterName'">{{ record.reporterName || $t('common.unset') }}</template>
            <template v-else-if="column.key === 'assigneeName'">{{ record.assigneeName || $t('common.unset') }}</template>
            <template v-else-if="column.key === 'createdAt'">{{ formatDateTime(record.createdAt) }}</template>
            <template v-else-if="column.key === 'actions'"><a-button type="link" class="pms-table-link" @click="openDetail(record)">{{ $t('common.detail') }}</a-button></template>
          </template>
        </a-table>
      </div>
    </a-card>

    <a-modal v-model:open="submitOpen" :title="$t('feedback.create')" :confirm-loading="submitLoading" :ok-text="$t('common.save')" :cancel-text="$t('common.cancel')" width="640px" @ok="submit">
      <a-form layout="vertical" class="feedback-form">
        <a-form-item :label="$t('feedback.title')" required><a-input v-model:value="form.title" :placeholder="$t('feedback.titlePlaceholder')" maxlength="160" show-count /></a-form-item>
        <div class="feedback-form-grid">
          <a-form-item :label="$t('feedback.type')" required><a-select v-model:value="form.feedbackType"><a-select-option v-for="value in typeOptions" :key="value" :value="value">{{ typeLabel(value) }}</a-select-option></a-select></a-form-item>
          <a-form-item :label="$t('feedback.priority')"><a-select v-model:value="form.priority"><a-select-option v-for="value in priorityOptions" :key="value" :value="value">{{ priorityLabel(value) }}</a-select-option></a-select></a-form-item>
        </div>
        <a-form-item :label="$t('feedback.content')" required><a-textarea v-model:value="form.content" :placeholder="$t('feedback.contentPlaceholder')" :rows="6" maxlength="5000" show-count /></a-form-item>
        <div class="feedback-form-grid">
          <a-form-item :label="$t('feedback.project')"><a-select v-model:value="form.projectId" allow-clear show-search option-filter-prop="label" :loading="contextLoading" :placeholder="$t('feedback.all')" @change="onProjectChange"><a-select-option v-for="project in projectOptions" :key="project.id" :value="project.id" :label="project.name">{{ project.name }}<span class="feedback-option-code">{{ project.code }}</span></a-select-option></a-select></a-form-item>
          <a-form-item :label="$t('feedback.module')"><a-input v-model:value="form.contextModule" maxlength="80" /></a-form-item>
        </div>
        <div class="feedback-form-grid">
          <a-form-item :label="$t('feedback.node')"><a-select v-model:value="form.nodeId" allow-clear :disabled="!form.projectId" :loading="contextLoading" :placeholder="$t('feedback.nodePlaceholder')" @change="onNodeChange"><a-select-option v-for="node in nodeOptions" :key="node.id" :value="node.id">{{ node.name }}<span class="feedback-option-code">{{ node.nodeKey }}</span></a-select-option></a-select></a-form-item>
          <a-form-item :label="$t('feedback.task')"><a-select v-model:value="form.taskId" allow-clear :disabled="!form.projectId" :loading="contextLoading" :placeholder="$t('feedback.taskPlaceholder')" @change="onTaskChange"><a-select-option v-for="task in visibleTaskOptions" :key="task.id" :value="task.id">{{ task.title }}<span class="feedback-option-code">#{{ task.id }}</span></a-select-option></a-select></a-form-item>
        </div>
        <a-form-item :label="$t('feedback.sourceUrl')"><a-input v-model:value="form.sourceUrl" maxlength="1000" /></a-form-item>
      </a-form>
    </a-modal>

    <a-drawer v-model:open="detailOpen" :title="$t('feedback.detail')" :width="520" class="feedback-drawer">
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <div class="feedback-detail-head">
            <div><span class="feedback-ticket-no">{{ detail.ticketNo }}</span><h2>{{ detail.title }}</h2></div>
            <a-tag :color="statusColor(detail.status)">{{ statusLabel(detail.status) }}</a-tag>
          </div>
          <div class="feedback-detail-meta"><a-tag>{{ typeLabel(detail.feedbackType) }}</a-tag><a-tag :color="priorityColor(detail.priority)">{{ priorityLabel(detail.priority) }}</a-tag><span>{{ formatDateTime(detail.createdAt) }}</span></div>
          <a-typography-paragraph class="feedback-content">{{ detail.content }}</a-typography-paragraph>
          <a-descriptions :column="1" size="small" bordered>
            <a-descriptions-item :label="$t('feedback.reporter')">{{ detail.reporterName || $t('common.unset') }}</a-descriptions-item>
            <a-descriptions-item :label="$t('feedback.assignee')">{{ detail.assigneeName || $t('common.unset') }}</a-descriptions-item>
            <a-descriptions-item :label="$t('feedback.project')">{{ detail.projectName || $t('common.unset') }}</a-descriptions-item>
            <a-descriptions-item :label="$t('feedback.module')">{{ detail.contextModule || $t('common.unset') }}</a-descriptions-item>
          </a-descriptions>

          <section v-if="isManager" class="feedback-manager-panel">
            <div class="feedback-section-title"><strong>{{ $t('feedback.managerHint') }}</strong></div>
            <a-form layout="vertical">
              <div class="feedback-form-grid">
                <a-form-item :label="$t('feedback.status')"><a-select v-model:value="managerForm.status"><a-select-option v-for="value in statusOptions" :key="value" :value="value">{{ statusLabel(value) }}</a-select-option></a-select></a-form-item>
                <a-form-item :label="$t('feedback.priority')"><a-select v-model:value="managerForm.priority"><a-select-option v-for="value in priorityOptions" :key="value" :value="value">{{ priorityLabel(value) }}</a-select-option></a-select></a-form-item>
              </div>
              <a-form-item :label="$t('feedback.assignee')"><PersonSelect v-model="managerForm.assigneeId" :options="assigneeOptions" :placeholder="$t('detail.selectPerson')" /></a-form-item>
              <a-form-item :label="$t('feedback.resolutionNote')"><a-textarea v-model:value="managerForm.resolutionNote" :placeholder="$t('feedback.resolutionNotePlaceholder')" :rows="3" maxlength="2000" show-count /></a-form-item>
              <a-button type="primary" class="pms-primary-button" :loading="updateLoading" @click="saveHandling">{{ $t('feedback.save') }}</a-button>
            </a-form>
          </section>

          <section class="feedback-history-section">
            <div class="feedback-section-title"><strong>{{ $t('feedback.history') }}</strong></div>
            <a-timeline v-if="detail.history?.length">
              <a-timeline-item v-for="item in detail.history" :key="item.id">
                <div class="feedback-history-title">{{ $t(`feedback.historyActions.${item.action}`, item.action) }}</div>
                <div class="feedback-history-meta">{{ item.operatorName || $t('common.system') }} · {{ formatDateTime(item.createdAt) }}</div>
                <div v-if="item.note" class="feedback-history-note">{{ item.note }}</div>
              </a-timeline-item>
            </a-timeline>
            <a-empty v-else :description="$t('feedback.noHistory')" />
          </section>
          <a-button v-if="userStore.can('feedback:write') && canReopen(detail.status)" class="feedback-reopen" :loading="updateLoading" @click="reopen">{{ $t('feedback.reopen') }}</a-button>
        </template>
      </a-spin>
    </a-drawer>
  </section>
</template>

<style scoped>
.feedback-page { min-width: 0; }
.feedback-panel { overflow: hidden; }
.feedback-toolbar { padding: 16px; }
.feedback-toolbar .pms-table-toolbar__filters { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.feedback-toolbar .ant-select { width: 150px; }
.feedback-search { width: min(340px, 100%); }
.feedback-table-scroll :deep(.ant-table) { min-width: 1080px; }
.feedback-title { max-width: 250px; padding: 0; overflow: hidden; color: var(--pms-text); font-weight: 700; text-align: left; text-overflow: ellipsis; white-space: nowrap; background: none; border: 0; cursor: pointer; }
.feedback-title:hover { color: var(--pms-primary); }
.feedback-option-code { display: inline-block; margin-left: 8px; color: var(--pms-text-faint); font-size: 11px; }
.feedback-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.feedback-detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.feedback-detail-head h2 { margin: 4px 0 0; color: var(--pms-text); font-size: 20px; line-height: 1.35; }
.feedback-ticket-no { color: var(--pms-text-faint); font-size: 12px; letter-spacing: .04em; }
.feedback-detail-meta { display: flex; align-items: center; gap: 8px; margin: 14px 0; color: var(--pms-text-muted); font-size: 12px; }
.feedback-content { margin: 18px 0; padding: 14px; color: var(--pms-text); white-space: pre-wrap; background: var(--pms-surface-muted); border-radius: 6px; }
.feedback-manager-panel, .feedback-history-section { margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--pms-border); }
.feedback-section-title { margin-bottom: 14px; color: var(--pms-text); font-size: 13px; }
.feedback-history-title { color: var(--pms-text); font-weight: 650; }
.feedback-history-meta { margin-top: 3px; color: var(--pms-text-faint); font-size: 11px; }
.feedback-history-note { margin-top: 6px; color: var(--pms-text-muted); white-space: pre-wrap; }
.feedback-reopen { margin-top: 20px; }
.pms-table-link { padding-inline: 0; }
@media (max-width: 760px) {
  .feedback-toolbar .pms-table-toolbar__filters > * { width: 100%; min-width: 0; }
  .feedback-form-grid { grid-template-columns: 1fr; gap: 0; }
}
</style>
