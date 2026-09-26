<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { message, Modal } from 'ant-design-vue'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
import {
  deleteDevelopmentRequirement,
  deleteDevelopmentTopic,
  getDevelopmentRequirementPage,
  getDevelopmentStoryPage,
  getDevelopmentTopicPage,
  restoreDevelopmentRequirement,
  restoreDevelopmentTopic,
  type DevelopmentRequirementPageParams,
  type DevelopmentRequirementRow,
  type DevelopmentStoryRow,
  type DevelopmentTopicRow,
} from '/@/api/development-item'
import { formatDate } from '/@/utils/format'
import SourceRequirementList from '/@/components/development/SourceRequirementList.vue'
import DevelopmentTopicEditModal from './DevelopmentTopicEditModal.vue'
import DevelopmentStoryEditModal from './DevelopmentStoryEditModal.vue'
import DevelopmentRequirementEditModal from './DevelopmentRequirementEditModal.vue'

type DevelopmentListMode = 'topics' | 'stories' | 'requirements'
type DevelopmentRow = DevelopmentTopicRow | DevelopmentStoryRow | DevelopmentRequirementRow

const props = defineProps<{ mode: DevelopmentListMode }>()
const router = useRouter()
const { t } = useI18n()
const query = reactive({ keyword: '', status: undefined as string | undefined, targetType: undefined as DevelopmentRequirementPageParams['targetType'] })
const topicScope = ref<'active' | 'deleted'>('active')
const requirementScope = ref<'active' | 'deleted'>('active')
const dataSource = ref<DevelopmentRow[]>([])
const loading = ref(false)
const topicEditOpen = ref(false)
const editingTopic = ref<DevelopmentTopicRow | null>(null)
const storyEditOpen = ref(false)
const editingStory = ref<DevelopmentStoryRow | null>(null)
const requirementEditOpen = ref(false)
const editingRequirement = ref<DevelopmentRequirementRow | null>(null)
const topicMutationId = ref<number | null>(null)
const requirementMutationId = ref<number | null>(null)
const pagination = reactive({ current: 1, pageSize: 10, total: 0 })
const isTopics = computed(() => props.mode === 'topics')
const isRequirements = computed(() => props.mode === 'requirements')
const deletedScope = computed(() => isTopics.value && topicScope.value === 'deleted')
const requirementDeletedScope = computed(() => isRequirements.value && requirementScope.value === 'deleted')
const titleKey = computed(() => isTopics.value
  ? 'developmentList.topicsTitle'
  : isRequirements.value ? 'developmentList.requirementsTitle' : 'developmentList.storiesTitle')
const descriptionKey = computed(() => isTopics.value
  ? 'developmentList.topicsDescription'
  : isRequirements.value ? 'developmentList.requirementsDescription' : 'developmentList.storiesDescription')
const searchKey = computed(() => isTopics.value
  ? 'developmentList.searchTopics'
  : isRequirements.value ? 'developmentList.searchRequirements' : 'developmentList.searchStories')
const statusOptions = computed(() => isRequirements.value
  ? [{ value: 'ACTIVE', label: t('developmentList.requirementStatusActive') }]
  : isTopics.value
    ? [
      { value: 'NOT_STARTED', label: t('developmentList.statusNotStarted') },
      { value: 'IN_PROGRESS', label: t('developmentList.statusInProgress') },
      { value: 'DONE', label: t('developmentList.statusDone') },
    ]
    : [
      { value: 'NOT_STARTED', label: t('developmentList.statusNotStarted') },
      { value: 'IN_PROGRESS', label: t('developmentList.statusInProgress') },
      { value: 'TESTING', label: t('developmentList.statusTesting') },
      { value: 'BLOCKED', label: t('developmentList.statusBlocked') },
      { value: 'DONE', label: t('developmentList.statusDone') },
    ])
const targetOptions = computed(() => [
  { value: 'PROJECT', label: t('developmentList.targetProject') },
  { value: 'TOPIC', label: t('developmentList.targetTopic') },
  { value: 'STORY', label: t('developmentList.targetStory') },
])
const columns = computed(() => {
  if (isRequirements.value) {
    return [
      { title: t('developmentList.item'), key: 'item', width: 230 },
      { title: t('developmentList.requirementTarget'), key: 'context', width: 250 },
      { title: t('developmentList.owner'), key: 'owner', width: 150 },
      { title: t('common.status'), key: 'status', width: 110 },
      { title: t('developmentList.progress'), key: 'progress', width: 150 },
      { title: t('common.actions'), key: 'action', width: 175 },
    ]
  }
  const common = [
    { title: t('developmentList.item'), key: 'item', width: 180 },
    { title: t('developmentList.projectContext'), key: 'context', width: 170 },
    { title: t('developmentList.owner'), key: 'owner', width: 130 },
    { title: t('common.status'), key: 'status', width: 90 },
    { title: t('developmentList.progress'), key: 'progress', width: 130 },
  ]
  return isTopics.value
    ? [...common, { title: t('developmentList.storyCount'), key: 'storyCount', width: 100 }, { title: t('common.actions'), key: 'action', width: 175 }]
    : [...common, { title: t('developmentList.topic'), key: 'topic', width: 180 }, { title: t('developmentList.iteration'), key: 'iteration', width: 150 }, { title: t('developmentList.dueDate'), key: 'dueDate', width: 130 }, { title: t('common.actions'), key: 'action', width: 90 }]
})

function statusLabel(status?: string) {
  if (status && ['NOT_CONFIGURED', 'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
    return t(`developmentList.workflow.${status}`)
  }
  return statusOptions.value.find((option) => option.value === status)?.label || (status ? t('developmentList.statusUnknown') : t('common.unset'))
}

function statusColor(status?: string) {
  if (status === 'DONE') return 'green'
  if (status === 'BLOCKED') return 'red'
  if (status === 'TESTING') return 'blue'
  if (status === 'IN_PROGRESS') return 'orange'
  if (status === 'ACTIVE') return 'green'
  return 'default'
}

function isRequirement(record: DevelopmentRow): record is DevelopmentRequirementRow {
  return 'version' in record
}

function isStory(record: DevelopmentRow): record is DevelopmentStoryRow {
  return 'topicTitle' in record
}

function isTopic(record: DevelopmentRow): record is DevelopmentTopicRow {
  return 'storyCount' in record
}

function loadParams() {
  const params = {
    currPage: pagination.current,
    pageSize: pagination.pageSize,
    keyword: query.keyword || undefined,
    status: query.status,
  }
  return isRequirements.value ? { ...params, targetType: query.targetType, deleted: requirementDeletedScope.value } : params
}

async function loadData() {
  loading.value = true
  try {
    const result = isTopics.value
      ? await getDevelopmentTopicPage({ ...loadParams(), deleted: deletedScope.value })
      : isRequirements.value
        ? await getDevelopmentRequirementPage(loadParams())
        : await getDevelopmentStoryPage(loadParams())
    dataSource.value = result.list
    pagination.total = result.total
  } catch (error) {
    message.error((error as Error).message || t('developmentList.loadFailed'))
  } finally {
    loading.value = false
  }
}

function onSearch() {
  pagination.current = 1
  void loadData()
}

function onReset() {
  query.keyword = ''
  query.status = undefined
  query.targetType = undefined
  onSearch()
}

function onTableChange(page: { current?: number; pageSize?: number }) {
  pagination.current = page.current ?? 1
  pagination.pageSize = page.pageSize ?? 10
  void loadData()
}

function onTopicScopeChange() {
  pagination.current = 1
  void loadData()
}

function onRequirementScopeChange() {
  pagination.current = 1
  query.status = undefined
  void loadData()
}

function openSource(record: DevelopmentRow) {
  if (isRequirement(record)) return
  if (record.projectId == null || record.nodeId == null) return
  void router.push({ path: `/projects/${record.projectId}`, query: { node: String(record.nodeId) } })
}

function openItem(record: DevelopmentRow) {
  const collection = isTopics.value ? 'topics' : isRequirements.value ? 'requirements' : 'stories'
  void router.push(`/development/${collection}/${record.id}`)
}

function openTopic(record: DevelopmentStoryRow) {
  if (record.topicId) void router.push(`/development/topics/${record.topicId}`)
}

function openRequirement(requirementId: number) {
  void router.push(`/development/requirements/${requirementId}`)
}

function sourceRequirements(record: DevelopmentRow) {
  if (isRequirement(record)) return []
  if (record.sourceRequirements?.length) return record.sourceRequirements
  return record.sourceRequirement ? [record.sourceRequirement] : []
}

function editTopic(record: DevelopmentTopicRow) {
  editingTopic.value = record
  topicEditOpen.value = true
}

function createTopic() {
  editingTopic.value = null
  topicEditOpen.value = true
}

function createStory() {
  if (isRequirements.value) {
    createRequirement()
    return
  }
  editingStory.value = null
  storyEditOpen.value = true
}

function createRequirement() {
  editingRequirement.value = null
  requirementEditOpen.value = true
}

function editStory(record: DevelopmentStoryRow) {
  editingStory.value = record
  storyEditOpen.value = true
}

function editRequirement(record: DevelopmentRequirementRow) {
  editingRequirement.value = record
  requirementEditOpen.value = true
}

async function refreshAfterMutation() {
  await loadData()
  if (pagination.current > 1 && dataSource.value.length === 0) {
    pagination.current -= 1
    await loadData()
  }
}

function deleteTopic(record: DevelopmentTopicRow) {
  if (topicMutationId.value != null) return
  Modal.confirm({
    title: t('developmentList.deleteTopicTitle'),
    content: t('developmentList.deleteTopicContent', { title: record.title, count: record.storyCount }),
    okText: t('common.delete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: async () => {
      topicMutationId.value = record.id
      try {
        await deleteDevelopmentTopic(record.id)
        message.success(t('developmentList.topicDeleted'))
        await refreshAfterMutation()
      } catch (error) {
        message.error((error as Error).message || t('developmentList.topicDeleteFailed'))
        throw error
      } finally {
        topicMutationId.value = null
      }
    },
  })
}

async function restoreTopic(record: DevelopmentTopicRow) {
  if (topicMutationId.value != null) return
  topicMutationId.value = record.id
  try {
    await restoreDevelopmentTopic(record.id)
    message.success(t('developmentList.topicRestored'))
    await refreshAfterMutation()
  } catch (error) {
    message.error((error as Error).message || t('developmentList.topicRestoreFailed'))
  } finally {
    topicMutationId.value = null
  }
}

function deleteRequirement(record: DevelopmentRequirementRow) {
  if (requirementMutationId.value != null) return
  Modal.confirm({
    title: t('developmentList.deleteRequirementTitle'),
    content: t('developmentList.deleteRequirementContent', { title: record.title }),
    okText: t('common.delete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: async () => {
      requirementMutationId.value = record.id
      try {
        await deleteDevelopmentRequirement(record.id)
        message.success(t('developmentList.requirementDeleted'))
        await refreshAfterMutation()
      } catch (error) {
        message.error((error as Error).message || t('developmentList.requirementDeleteFailed'))
        throw error
      } finally {
        requirementMutationId.value = null
      }
    },
  })
}

async function restoreRequirement(record: DevelopmentRequirementRow) {
  if (requirementMutationId.value != null) return
  requirementMutationId.value = record.id
  try {
    await restoreDevelopmentRequirement(record.id)
    message.success(t('developmentList.requirementRestored'))
    await refreshAfterMutation()
  } catch (error) {
    message.error((error as Error).message || t('developmentList.requirementRestoreFailed'))
  } finally {
    requirementMutationId.value = null
  }
}

onMounted(() => { void loadData() })
</script>

<template>
  <div class="development-list-page">
    <PmsPageHeader :eyebrow="t('developmentList.eyebrow')" :title="t(titleKey)" :description="t(descriptionKey)">
      <template #actions>
        <a-radio-group v-if="isTopics" v-model:value="topicScope" button-style="solid" class="pms-project-view-switch" :aria-label="t('developmentList.topicScope')" @change="onTopicScopeChange">
          <a-radio-button value="active">{{ t('developmentList.activeTopics') }}</a-radio-button>
          <a-radio-button value="deleted">{{ t('developmentList.deletedTopics') }}</a-radio-button>
        </a-radio-group>
        <a-radio-group v-if="isRequirements" v-model:value="requirementScope" button-style="solid" class="pms-project-view-switch" :aria-label="t('developmentList.requirementScope')" @change="onRequirementScopeChange">
          <a-radio-button value="active">{{ t('developmentList.activeRequirements') }}</a-radio-button>
          <a-radio-button value="deleted">{{ t('developmentList.deletedRequirements') }}</a-radio-button>
        </a-radio-group>
        <a-button type="primary" class="pms-primary-button pms-project-button pms-project-button--primary" @click="isTopics ? createTopic() : createStory()"><PlusOutlined /> {{ t(isTopics ? 'developmentList.createTopic' : isRequirements ? 'developmentList.createRequirement' : 'developmentList.createStory') }}</a-button>
        <a-button class="pms-secondary-button pms-filter-button pms-project-button pms-project-button--secondary" @click="loadData"><ReloadOutlined /> {{ t('common.refresh') }}</a-button>
      </template>
    </PmsPageHeader>

    <a-card :bordered="false" class="pms-table-panel pms-table-card">
      <div class="pms-table-toolbar" role="group" :aria-label="t('developmentList.filters')">
        <div class="pms-table-toolbar__filters">
          <a-input v-model:value="query.keyword" :placeholder="t(searchKey)" :aria-label="t(searchKey)" allow-clear class="pms-search-input development-list-page__search pms-filter-control" @press-enter="onSearch">
            <template #prefix><SearchOutlined class="pms-muted-icon" /></template>
          </a-input>
          <a-select v-model:value="query.status" :placeholder="t('common.status')" :aria-label="t('developmentList.statusFilter')" allow-clear class="pms-status-select development-list-page__status-select pms-filter-control" @change="onSearch">
            <a-select-option v-for="option in statusOptions" :key="option.value" :value="option.value">{{ option.label }}</a-select-option>
          </a-select>
          <a-select v-if="isRequirements" v-model:value="query.targetType" :placeholder="t('developmentList.requirementTargetType')" :aria-label="t('developmentList.requirementTargetType')" allow-clear class="pms-target-select development-list-page__target-select pms-filter-control" @change="onSearch">
            <a-select-option v-for="option in targetOptions" :key="option.value" :value="option.value">{{ option.label }}</a-select-option>
          </a-select>
          <a-button class="pms-secondary-button pms-filter-button pms-project-button pms-project-button--secondary" @click="onSearch"><ReloadOutlined /> {{ t('common.query') }}</a-button>
          <a-button class="pms-secondary-button pms-filter-button pms-project-button pms-project-button--secondary" @click="onReset">{{ t('common.reset') }}</a-button>
        </div>
      </div>

      <div class="pms-table-scroll pms-project-table-scroll development-list-page__table-scroll">
        <a-table :data-source="dataSource" :columns="columns" :loading="loading" row-key="id" :pagination="pagination" @change="onTableChange">
          <template #emptyText>
            <div class="development-list-page__empty">
              <strong>{{ t('developmentList.emptyTitle') }}</strong>
              <span>{{ t('developmentList.emptyHint') }}</span>
            </div>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'item'">
              <div class="development-list-page__item-cell">
                <a class="pms-project-link development-list-page__item-link" @click="openItem(record)">{{ record.title }}</a>
              </div>
            </template>
            <template v-else-if="column.key === 'context'">
              <div class="development-list-page__context-cell">
                <template v-if="isRequirement(record)">
                  <template v-if="record.executionTarget">
                    <strong>{{ record.executionTarget.title || record.executionTarget.code || t('common.unset') }}</strong>
                    <span class="pms-table-subtext">{{ record.executionTarget.targetType === 'PROJECT' ? t('developmentList.targetProject') : record.executionTarget.targetType === 'TOPIC' ? t('developmentList.targetTopic') : t('developmentList.targetStory') }}</span>
                  </template>
                  <span v-else class="pms-table-subtext">{{ t('developmentList.unassociatedRequirement') }}</span>
                </template>
                <template v-else>
                  <a v-if="record.projectId != null && record.nodeId != null" class="pms-project-link development-list-page__project-link" @click="openSource(record)">{{ record.projectName || t('common.unset') }}</a>
                  <span v-else class="pms-table-subtext">{{ t('developmentList.unboundProject') }}</span>
                  <SourceRequirementList
                    :items="sourceRequirements(record)"
                    :label="t('developmentList.sourceRequirement')"
                    compact
                    @open="openRequirement"
                  />
                </template>
              </div>
            </template>
            <template v-else-if="column.key === 'owner'"><span>{{ record.ownerName || t('common.unset') }}</span></template>
            <template v-else-if="column.key === 'status'"><a-tag :color="statusColor(isRequirement(record) ? (record.workflowStatus === 'NOT_CONFIGURED' ? record.status : record.workflowStatus) : record.status)">{{ statusLabel(isRequirement(record) ? (record.workflowStatus === 'NOT_CONFIGURED' ? record.status : record.workflowStatus) : record.status) }}</a-tag></template>
            <template v-else-if="column.key === 'progress'"><a-progress :percent="isRequirement(record) ? (record.workflowProgress ?? 0) : record.progress" size="small" :status="(isRequirement(record) ? (record.workflowProgress ?? 0) : record.progress) === 100 ? 'success' : undefined" style="width: 120px" /></template>
            <template v-else-if="column.key === 'storyCount'"><div class="development-list-page__metric"><strong>{{ t('developmentList.storyCountValue', { count: record.storyCount }) }}</strong><span class="pms-table-subtext">{{ t('developmentList.completedStoryCount', { count: record.completedStoryCount }) }}</span></div></template>
            <template v-else-if="column.key === 'topic'"><button v-if="isStory(record) && record.topicId" type="button" class="pms-project-link development-list-page__topic-link" :title="record.topicTitle || t('common.unset')" @click="openTopic(record)">{{ record.topicTitle || t('common.unset') }}</button><span v-else class="pms-table-subtext">{{ isStory(record) ? (record.topicTitle || t('common.unset')) : t('common.unset') }}</span></template>
            <template v-else-if="column.key === 'iteration'">{{ isStory(record) ? (record.iterationPlanName || t('common.unset')) : '' }}</template>
            <template v-else-if="column.key === 'dueDate'">{{ isStory(record) ? formatDate(record.dueDate) : '' }}</template>
            <template v-else-if="column.key === 'action'">
              <div v-if="isRequirement(record)" class="pms-project-row-actions" role="group" :aria-label="t('common.actions')">
                <template v-if="!requirementDeletedScope">
                  <button type="button" class="pms-action-link pms-project-button pms-project-button--text" @click="openItem(record)">{{ t('common.detail') }}</button>
                  <button type="button" class="pms-action-link pms-project-button pms-project-button--text" @click="editRequirement(record)">{{ t('common.edit') }}</button>
                  <button type="button" class="pms-action-link pms-action-link--danger pms-project-button pms-project-button--text pms-project-button--danger" :disabled="requirementMutationId != null" @click="deleteRequirement(record)">{{ t('common.delete') }}</button>
                </template>
                <button v-else type="button" class="pms-action-link pms-project-button pms-project-button--text" :disabled="requirementMutationId != null" @click="restoreRequirement(record)">{{ t('developmentList.restoreRequirement') }}</button>
              </div>
              <template v-else>
                <div v-if="isTopic(record)" class="pms-project-row-actions" role="group" :aria-label="t('common.actions')">
                  <button v-if="!deletedScope" type="button" class="pms-action-link pms-project-button pms-project-button--text" @click="openItem(record)">{{ t('common.detail') }}</button>
                  <button v-if="!deletedScope" type="button" class="pms-action-link pms-project-button pms-project-button--text" @click="editTopic(record)">{{ t('common.edit') }}</button>
                  <button v-if="!deletedScope" type="button" class="pms-action-link pms-action-link--danger pms-project-button pms-project-button--text pms-project-button--danger" :disabled="topicMutationId != null" @click="deleteTopic(record)">{{ t('common.delete') }}</button>
                  <button v-else type="button" class="pms-action-link pms-project-button pms-project-button--text" :disabled="topicMutationId != null" @click="restoreTopic(record)">{{ t('developmentList.restoreTopic') }}</button>
                </div>
                <div v-else class="pms-project-row-actions" role="group" :aria-label="t('common.actions')">
                  <button type="button" class="pms-action-link pms-project-button pms-project-button--text" @click="openItem(record)">{{ t('common.detail') }}</button>
                  <button type="button" class="pms-action-link pms-project-button pms-project-button--text" @click="editStory(record)">{{ t('common.edit') }}</button>
                </div>
              </template>
            </template>
          </template>
        </a-table>
      </div>
    </a-card>
    <DevelopmentTopicEditModal v-model:open="topicEditOpen" :topic="editingTopic" @saved="refreshAfterMutation" />
    <DevelopmentStoryEditModal v-if="!isTopics && !isRequirements" v-model:open="storyEditOpen" :story="editingStory" @saved="refreshAfterMutation" />
    <DevelopmentRequirementEditModal v-if="isRequirements" v-model:open="requirementEditOpen" :requirement="editingRequirement" @saved="refreshAfterMutation" />
  </div>
</template>

<style scoped>
.development-list-page { min-width: 0; }
.pms-table-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.pms-table-toolbar__filters { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.development-list-page__search { width: 220px; }
.development-list-page__status-select { width: 130px; }
.development-list-page__target-select { width: 130px; }
.development-list-page__table-scroll { min-height: 220px; }
.development-list-page__project-link { display: inline-block; max-width: 220px; }
.development-list-page__item-cell, .development-list-page__context-cell { min-width: 0; }
.development-list-page__source-requirement { display: block; max-width: 220px; margin-top: 5px; padding: 0; overflow: hidden; border: 0; background: none; color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); text-align: left; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.development-list-page__source-requirement:hover { color: var(--pms-primary); text-decoration: underline; }
.development-list-page__topic-link { display: inline-block; max-width: 170px; padding: 0; overflow: hidden; border: 0; background: none; color: var(--pms-primary); text-align: left; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.development-list-page__item-link { display: inline-flex; align-items: center; max-width: 220px; overflow: hidden; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.development-list-page__metric { display: grid; gap: 3px; }
.development-list-page__metric strong { color: var(--pms-text); font-weight: 700; }
.development-list-page__empty { display: grid; justify-items: center; gap: 6px; min-height: 180px; padding: 48px 16px; color: var(--pms-text-muted); }
.development-list-page__empty strong { color: var(--pms-text); font-size: var(--pms-font-size-section); }
.development-list-page__empty span { color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
:deep(.ant-card-body) { padding: 20px; }
:deep(.ant-input), :deep(.ant-select-selector) { border-color: var(--pms-border) !important; border-radius: 6px !important; }
:deep(.ant-input:hover), :deep(.ant-select:hover .ant-select-selector) { border-color: var(--pms-border-strong) !important; }
:deep(.ant-table-thead > tr > th) { color: var(--pms-text-faint); background: var(--pms-surface-muted); border-bottom-color: var(--pms-border); font-size: var(--pms-font-size-caption); font-weight: 750; }
:deep(.ant-table-tbody > tr > td) { height: 95px; color: var(--pms-text-muted); border-bottom-color: var(--pms-border); font-size: 12.5px; }
:deep(.ant-table-tbody > tr:hover > td) { background: var(--pms-surface-muted) !important; }
:deep(.ant-table-cell) { vertical-align: middle; }

@media (max-width: 768px) {
  .pms-table-toolbar { align-items: stretch; flex-direction: column; }
  .pms-table-toolbar__filters { display: grid; grid-template-columns: minmax(0, 1fr) 96px; width: 100%; }
  .development-list-page__search { width: 100%; grid-column: 1 / -1; }
  .development-list-page__status-select, .pms-filter-button { width: 100%; }
}

@media (max-width: 480px) {
  .pms-table-toolbar__filters { grid-template-columns: 1fr; }
}
</style>
