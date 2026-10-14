<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftOutlined, CalendarOutlined, FileTextOutlined, FolderOpenOutlined, UserOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
import {
  getSystemVersionDetail,
  getSystemVersionHistory,
  updateSystemVersionStatus,
  type SystemVersionDetail,
  type SystemVersionHistory,
  type SystemVersionRelatedIteration,
  type SystemVersionRelatedProject,
  type SystemVersionRelatedStory,
  type SystemVersionStatus,
} from '/@/api/system-version'
import { systemVersionNextStatuses, systemVersionStatusColor, systemVersionStatusLabelKey } from '/@/enums/system-version'
import { formatDate, formatDateTime } from '/@/utils/format'
import { useUserStore } from '/@/store/user'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const userStore = useUserStore()
const detail = ref<SystemVersionDetail | null>(null)
const loading = ref(false)
const loadError = ref('')
const historyError = ref('')
const statusOpen = ref(false)
const statusSaving = ref(false)
const statusTarget = ref<SystemVersionStatus | null>(null)
const statusForm = reactive({ reason: '' })
const relatedItemsView = ref<'topic' | 'iteration'>('topic')

const canManage = computed(() => userStore.can('system-version:manage'))
const nextStatusOptions = computed(() => {
  const status = detail.value?.status as SystemVersionStatus | undefined
  return status ? (systemVersionNextStatuses[status] || []).map((value) => ({ value, label: t(systemVersionStatusLabelKey(value)) })) : []
})
const historyColumns = computed(() => [
  { title: t('systemVersionView.detailView.history'), key: 'action', width: 220 },
  { title: t('systemVersionView.detailView.owner'), key: 'operator', width: 150 },
  { title: t('systemVersionView.detailView.changedAt'), key: 'createdAt', width: 170 },
  { title: t('systemVersionView.detailView.reason'), key: 'reason', width: 360 },
])

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function statusLabel(status?: string) {
  return t(systemVersionStatusLabelKey(status))
}

const relatedItemsCount = computed(() => {
  const related = detail.value?.relatedItems
  const projects = related?.projects || []
  return projects.length
    + projects.reduce((total, project) => total
      + (project.topics || []).reduce((topicTotal, topic) => topicTotal + 1 + (topic.stories?.length || 0), 0)
      + (project.stories?.length || 0), 0)
    + (related?.unboundTopics?.length || 0)
    + (related?.unboundStories?.length || 0)
    + (related?.unboundTopics || []).reduce((total, topic) => total + (topic.stories?.length || 0), 0)
})

function relatedStatusKey(status?: string | number) {
  if (typeof status === 'number') {
    return ({ 1: 'ACTIVE', 2: 'COMPLETED', 3: 'TERMINATED', 4: 'DELETED' } as Record<number, string>)[status] || String(status)
  }
  return status || ''
}

function relatedStatusLabel(status?: string | number) {
  const normalized = relatedStatusKey(status)
  if (!normalized) return t('common.unset')
  const key = `systemVersionView.detailView.relatedStatuses.${normalized}`
  const translated = t(key)
  return translated === key ? normalized : translated
}

function relatedStatusColor(status?: string | number) {
  const normalized = relatedStatusKey(status)
  if (normalized === 'DONE' || normalized === 'COMPLETED') return 'green'
  if (normalized === 'IN_PROGRESS' || normalized === 'ACTIVE' || normalized === 'TESTING') return 'blue'
  if (normalized === 'BLOCKED' || normalized === 'TERMINATED' || normalized === 'DELETED') return 'red'
  return 'default'
}

function openRelatedItem(type: 'project' | 'topic' | 'story', id?: number) {
  if (!id) return
  const paths = { project: '/projects', topic: '/development/topics', story: '/development/stories' }
  void router.push(`${paths[type]}/${id}`)
}

function iterationRange(startDate?: string | null, dueDate?: string | null) {
  const start = formatDate(startDate)
  const end = formatDate(dueDate)
  if (start === '—' && end === '—') return ''
  return `${start} → ${end}`
}

type StoryIterationGroup = {
  key: string
  iteration: SystemVersionRelatedIteration | null
  stories: SystemVersionRelatedStory[]
}

function groupStoriesByIteration(stories: SystemVersionRelatedStory[] = []): StoryIterationGroup[] {
  const groups = new Map<string, StoryIterationGroup>()
  stories.forEach((story) => {
    const iteration = story.sourceIterations?.[0] || null
    const key = iteration?.id != null ? `iteration-${iteration.id}` : 'iteration-unassigned'
    const group = groups.get(key) || { key, iteration, stories: [] }
    group.stories.push(story)
    groups.set(key, group)
  })
  return Array.from(groups.values())
}

function projectStories(project: SystemVersionRelatedProject): SystemVersionRelatedStory[] {
  const stories = [
    ...(project.stories || []),
    ...(project.topics || []).flatMap((topic) => topic.stories || []),
  ]
  return Array.from(new Map(stories.map((story) => [story.id, story])).values())
}

function unboundStories(): SystemVersionRelatedStory[] {
  const related = detail.value?.relatedItems
  const stories = [
    ...(related?.unboundStories || []),
    ...(related?.unboundTopics || []).flatMap((topic) => topic.stories || []),
  ]
  return Array.from(new Map(stories.map((story) => [story.id, story])).values())
}

function storyTopicLabel(story: SystemVersionRelatedStory, topics: { id: number; title: string }[] = []) {
  return topics.find((topic) => topic.id === story.topicId)?.title || t('systemVersionView.detailView.unboundTopic')
}

function historyAction(item: SystemVersionHistory) {
  if (item.action) {
    const key = `systemVersionView.detailView.historyActions.${item.action}`
    const translated = t(key)
    if (translated !== key) return translated
  }
  if (item.toStatus) return `${t('systemVersionView.detailView.statusChange')} · ${statusLabel(item.toStatus)}`
  return item.action || t('systemVersionView.detailView.history')
}

async function loadData() {
  const id = Number(route.params.id)
  if (!Number.isFinite(id)) {
    detail.value = null
    loadError.value = t('systemVersionView.detailView.detailLoadFailed')
    return
  }
  loading.value = true
  loadError.value = ''
  historyError.value = ''
  try {
    const loaded = await getSystemVersionDetail(id)
    detail.value = { ...loaded, history: loaded.history || [] }
    try {
      detail.value.history = await getSystemVersionHistory(id)
    } catch (error) {
      historyError.value = errorText(error, t('systemVersionView.detailView.historyLoadFailed'))
      if (!loaded.history?.length) message.error(historyError.value)
    }
  } catch (error) {
    detail.value = null
    loadError.value = errorText(error, t('systemVersionView.detailView.detailLoadFailed'))
    message.error(loadError.value)
  } finally {
    loading.value = false
  }
}

function openStatusChange(status: SystemVersionStatus) {
  if (!detail.value || !canManage.value) return
  statusTarget.value = status
  statusForm.reason = ''
  statusOpen.value = true
}

function closeStatusChange() {
  if (!statusSaving.value) statusOpen.value = false
}

async function saveStatus() {
  if (!detail.value || !statusTarget.value || statusSaving.value) return
  if (!statusForm.reason.trim()) {
    message.warning(t('systemVersionView.detailView.reasonRequired'))
    return
  }
  statusSaving.value = true
  try {
    await updateSystemVersionStatus(detail.value.id, {
      status: statusTarget.value,
      version: detail.value.version ?? 0,
      reason: statusForm.reason.trim(),
    })
    statusOpen.value = false
    message.success(t('systemVersionView.detailView.statusUpdated'))
    await loadData()
  } catch (error) {
    message.error(errorText(error, t('systemVersionView.detailView.statusUpdateFailed')))
  } finally {
    statusSaving.value = false
  }
}

onMounted(() => { void loadData() })
watch(() => route.params.id, () => { void loadData() })
</script>

<template>
  <div v-if="loading && !detail" class="system-version-detail-page__loading"><a-spin /></div>
  <div v-else-if="detail" class="system-version-detail-page pms-page-stack">
    <div class="detail-breadcrumb">
      <button type="button" class="detail-breadcrumb__back" @click="router.push('/development/system-versions')"><ArrowLeftOutlined /> {{ t('systemVersionView.detailView.backToList') }}</button>
      <span class="detail-breadcrumb__separator">/</span>
      <span>{{ t('systemVersionView.detailView.title') }}</span>
    </div>

    <PmsPageHeader :eyebrow="t('systemVersionView.eyebrow')" :title="detail.versionNo" :description="detail.versionName">
      <template #title>
        <span class="system-version-detail-page__title-row">
          <span>{{ detail.versionNo }}</span>
          <a-tag class="system-version-detail-page__header-status" :color="systemVersionStatusColor(detail.status)">{{ statusLabel(detail.status) }}</a-tag>
        </span>
      </template>
      <template #actions>
        <a-select
           v-if="canManage && nextStatusOptions.length"
          :value="undefined"
          class="system-version-detail-page__status-select"
          :loading="statusSaving"
          :disabled="statusSaving"
          :placeholder="t('systemVersionView.detailView.statusChange')"
          :aria-label="t('systemVersionView.detailView.statusChange')"
          @change="openStatusChange"
        >
          <a-select-option v-for="option in nextStatusOptions" :key="option.value" :value="option.value">{{ option.label }}</a-select-option>
        </a-select>
      </template>
    </PmsPageHeader>

    <section class="system-version-detail-page__hero pms-detail-panel pms-detail-hero card-surface">
      <div class="system-version-detail-page__meta-grid" :aria-label="t('systemVersionView.detailView.summary')">
        <div>
          <span>{{ t('systemVersionView.detailView.system') }}</span>
          <strong>{{ detail.systemName || t('common.unset') }}</strong>
        </div>
        <div>
          <span>{{ t('systemVersionView.detailView.version') }}</span>
          <strong>{{ detail.versionNo }}</strong>
        </div>
        <div>
          <span>{{ t('systemVersionView.detailView.owner') }}</span>
          <strong><UserOutlined /> {{ detail.ownerName || t('common.unset') }}</strong>
        </div>
      </div>
      <div class="system-version-detail-page__date-grid">
        <div><span>{{ t('systemVersionView.detailView.plannedReleaseDate') }}</span><strong><CalendarOutlined /> {{ formatDate(detail.plannedReleaseDate) }}</strong></div>
        <div><span>{{ t('systemVersionView.detailView.releasedAt') }}</span><strong><CalendarOutlined /> {{ formatDateTime(detail.releasedAt) }}</strong></div>
        <div><span>{{ t('systemVersionView.detailView.status') }}</span><a-tag class="system-version-detail-page__summary-status" :color="systemVersionStatusColor(detail.status)">{{ statusLabel(detail.status) }}</a-tag></div>
      </div>
    </section>

    <section class="system-version-detail-page__section pms-detail-panel pms-section-panel card-surface system-version-detail-page__related-items">
      <div class="pms-section-heading">
        <div>
          <h2>{{ t('systemVersionView.detailView.relatedItems') }}</h2>
          <p class="pms-section-heading__hint">{{ t('systemVersionView.detailView.relatedItemsHint') }}</p>
        </div>
        <div class="system-version-detail-page__related-heading-actions">
          <span class="system-version-detail-page__related-count">{{ relatedItemsCount }} {{ t('systemVersionView.detailView.relatedItemCount') }}</span>
          <div v-if="relatedItemsCount > 0" class="system-version-detail-page__related-view-switch" role="tablist" :aria-label="t('systemVersionView.detailView.relatedViewLabel')">
            <button type="button" role="tab" :aria-selected="relatedItemsView === 'topic'" :class="{ 'is-active': relatedItemsView === 'topic' }" @click="relatedItemsView = 'topic'">{{ t('systemVersionView.detailView.relatedViewByTopic') }}</button>
            <button type="button" role="tab" :aria-selected="relatedItemsView === 'iteration'" :class="{ 'is-active': relatedItemsView === 'iteration' }" @click="relatedItemsView = 'iteration'">{{ t('systemVersionView.detailView.relatedViewByIteration') }}</button>
          </div>
        </div>
      </div>
      <p v-if="relatedItemsCount === 0" class="system-version-detail-page__empty-copy">{{ t('systemVersionView.detailView.noRelatedItems') }}</p>
      <div v-if="relatedItemsView === 'topic'" class="system-version-detail-page__related-tree" role="tree" :aria-label="t('systemVersionView.detailView.relatedViewByTopic')">
        <ul class="system-version-detail-page__tree-list" role="group">
          <li v-for="project in detail.relatedItems?.projects || []" :key="`project-${project.id}`" class="system-version-detail-page__tree-item" role="treeitem" aria-level="2">
            <div class="system-version-detail-page__tree-node">
              <span class="system-version-detail-page__tree-icon"><FolderOpenOutlined /></span>
              <button type="button" class="system-version-detail-page__tree-link" @click="openRelatedItem('project', project.id)">{{ project.name }}</button>
              <a-tag :color="relatedStatusColor(project.status)">{{ relatedStatusLabel(project.status) }}</a-tag>
              <span class="system-version-detail-page__tree-meta">{{ project.ownerName || t('common.unset') }} · {{ project.progress ?? 0 }}%<template v-if="iterationRange(project.startDate, project.endDate)"> · {{ iterationRange(project.startDate, project.endDate) }}</template></span>
            </div>
            <ul v-if="(project.topics?.length || 0) + (project.stories?.length || 0)" class="system-version-detail-page__tree-list" role="group">
              <li v-for="topic in project.topics || []" :key="`topic-${topic.id}`" class="system-version-detail-page__tree-item" role="treeitem" aria-level="3">
                <div class="system-version-detail-page__tree-node">
                  <span class="system-version-detail-page__tree-icon"><FolderOpenOutlined /></span>
                  <button type="button" class="system-version-detail-page__tree-link" @click="openRelatedItem('topic', topic.id)">{{ topic.title }}</button>
                  <a-tag :color="relatedStatusColor(topic.status)">{{ relatedStatusLabel(topic.status) }}</a-tag>
                  <span class="system-version-detail-page__tree-meta">{{ topic.storyCount || 0 }} {{ t('systemVersionView.detailView.relatedStories') }} · {{ topic.progress ?? 0 }}%</span>
                </div>
                <ul v-if="topic.stories?.length" class="system-version-detail-page__tree-list" role="group">
                  <li v-for="story in topic.stories" :key="`story-${story.id}`" class="system-version-detail-page__tree-item" role="treeitem" aria-level="4">
                    <div class="system-version-detail-page__tree-node">
                      <span class="system-version-detail-page__tree-icon"><FileTextOutlined /></span>
                      <button type="button" class="system-version-detail-page__tree-link" @click="openRelatedItem('story', story.id)">{{ story.title }}</button>
                      <a-tag :color="relatedStatusColor(story.status)">{{ relatedStatusLabel(story.status) }}</a-tag>
                      <span class="system-version-detail-page__tree-meta">{{ story.ownerName || t('common.unset') }} · {{ story.progress ?? 0 }}%<template v-if="iterationRange(story.startDate, story.dueDate)"> · {{ iterationRange(story.startDate, story.dueDate) }}</template></span>
                    </div>
                    <div v-if="story.sourceIterations?.length" class="system-version-detail-page__iteration-tags">
                      <span>{{ t('systemVersionView.detailView.sourceIteration') }}：</span>
                      <span v-for="iteration in story.sourceIterations" :key="iteration.id" class="system-version-detail-page__iteration-tag">
                        {{ iteration.name }}<small v-if="iterationRange(iteration.startDate, iteration.dueDate)"> · {{ iterationRange(iteration.startDate, iteration.dueDate) }}</small>
                      </span>
                    </div>
                  </li>
                </ul>
              </li>
              <li v-if="project.stories?.length" class="system-version-detail-page__tree-item system-version-detail-page__tree-item--group" role="treeitem" aria-level="3">
                <div class="system-version-detail-page__tree-node"><span class="system-version-detail-page__tree-icon"><FileTextOutlined /></span><strong>{{ t('systemVersionView.detailView.unboundStories') }}</strong></div>
                <ul class="system-version-detail-page__tree-list" role="group">
                  <li v-for="story in project.stories" :key="`project-story-${story.id}`" class="system-version-detail-page__tree-item" role="treeitem" aria-level="4">
                    <div class="system-version-detail-page__tree-node">
                      <span class="system-version-detail-page__tree-icon"><FileTextOutlined /></span>
                      <button type="button" class="system-version-detail-page__tree-link" @click="openRelatedItem('story', story.id)">{{ story.title }}</button>
                      <a-tag :color="relatedStatusColor(story.status)">{{ relatedStatusLabel(story.status) }}</a-tag>
                      <span class="system-version-detail-page__tree-meta">{{ story.ownerName || t('common.unset') }} · {{ story.progress ?? 0 }}%<template v-if="iterationRange(story.startDate, story.dueDate)"> · {{ iterationRange(story.startDate, story.dueDate) }}</template></span>
                    </div>
                    <div v-if="story.sourceIterations?.length" class="system-version-detail-page__iteration-tags">
                      <span>{{ t('systemVersionView.detailView.sourceIteration') }}：</span>
                      <span v-for="iteration in story.sourceIterations" :key="iteration.id" class="system-version-detail-page__iteration-tag">
                        {{ iteration.name }}<small v-if="iterationRange(iteration.startDate, iteration.dueDate)"> · {{ iterationRange(iteration.startDate, iteration.dueDate) }}</small>
                      </span>
                    </div>
                  </li>
                </ul>
              </li>
            </ul>
          </li>
          <li v-if="detail.relatedItems?.unboundTopics?.length" class="system-version-detail-page__tree-item system-version-detail-page__tree-item--group" role="treeitem" aria-level="2">
            <div class="system-version-detail-page__tree-node"><span class="system-version-detail-page__tree-icon"><FolderOpenOutlined /></span><strong>{{ t('systemVersionView.detailView.unboundTopics') }}</strong></div>
            <ul class="system-version-detail-page__tree-list" role="group">
              <li v-for="topic in detail.relatedItems.unboundTopics" :key="`unbound-topic-${topic.id}`" class="system-version-detail-page__tree-item" role="treeitem" aria-level="3">
                <div class="system-version-detail-page__tree-node">
                  <span class="system-version-detail-page__tree-icon"><FolderOpenOutlined /></span>
                  <button type="button" class="system-version-detail-page__tree-link" @click="openRelatedItem('topic', topic.id)">{{ topic.title }}</button>
                  <a-tag :color="relatedStatusColor(topic.status)">{{ relatedStatusLabel(topic.status) }}</a-tag>
                  <span class="system-version-detail-page__tree-meta">{{ topic.storyCount || 0 }} {{ t('systemVersionView.detailView.relatedStories') }} · {{ topic.progress ?? 0 }}%</span>
                </div>
                <ul v-if="topic.stories?.length" class="system-version-detail-page__tree-list" role="group">
                  <li v-for="story in topic.stories" :key="`unbound-topic-story-${story.id}`" class="system-version-detail-page__tree-item" role="treeitem" aria-level="4">
                    <div class="system-version-detail-page__tree-node"><span class="system-version-detail-page__tree-icon"><FileTextOutlined /></span><button type="button" class="system-version-detail-page__tree-link" @click="openRelatedItem('story', story.id)">{{ story.title }}</button><a-tag :color="relatedStatusColor(story.status)">{{ relatedStatusLabel(story.status) }}</a-tag><span class="system-version-detail-page__tree-meta">{{ story.ownerName || t('common.unset') }} · {{ story.progress ?? 0 }}%<template v-if="iterationRange(story.startDate, story.dueDate)"> · {{ iterationRange(story.startDate, story.dueDate) }}</template></span></div>
                    <div v-if="story.sourceIterations?.length" class="system-version-detail-page__iteration-tags">
                      <span>{{ t('systemVersionView.detailView.sourceIteration') }}：</span>
                      <span v-for="iteration in story.sourceIterations" :key="iteration.id" class="system-version-detail-page__iteration-tag">
                        {{ iteration.name }}<small v-if="iterationRange(iteration.startDate, iteration.dueDate)"> · {{ iterationRange(iteration.startDate, iteration.dueDate) }}</small>
                      </span>
                    </div>
                  </li>
                </ul>
              </li>
            </ul>
          </li>
          <li v-if="detail.relatedItems?.unboundStories?.length" class="system-version-detail-page__tree-item system-version-detail-page__tree-item--group" role="treeitem" aria-level="2">
            <div class="system-version-detail-page__tree-node"><span class="system-version-detail-page__tree-icon"><FileTextOutlined /></span><strong>{{ t('systemVersionView.detailView.unboundStories') }}</strong></div>
            <ul class="system-version-detail-page__tree-list" role="group">
              <li v-for="story in detail.relatedItems.unboundStories" :key="`unbound-story-${story.id}`" class="system-version-detail-page__tree-item" role="treeitem" aria-level="3">
                <div class="system-version-detail-page__tree-node"><span class="system-version-detail-page__tree-icon"><FileTextOutlined /></span><button type="button" class="system-version-detail-page__tree-link" @click="openRelatedItem('story', story.id)">{{ story.title }}</button><a-tag :color="relatedStatusColor(story.status)">{{ relatedStatusLabel(story.status) }}</a-tag><span class="system-version-detail-page__tree-meta">{{ story.ownerName || t('common.unset') }} · {{ story.progress ?? 0 }}%<template v-if="iterationRange(story.startDate, story.dueDate)"> · {{ iterationRange(story.startDate, story.dueDate) }}</template></span></div>
                <div v-if="story.sourceIterations?.length" class="system-version-detail-page__iteration-tags">
                  <span>{{ t('systemVersionView.detailView.sourceIteration') }}：</span>
                  <span v-for="iteration in story.sourceIterations" :key="iteration.id" class="system-version-detail-page__iteration-tag">
                    {{ iteration.name }}<small v-if="iterationRange(iteration.startDate, iteration.dueDate)"> · {{ iterationRange(iteration.startDate, iteration.dueDate) }}</small>
                  </span>
                </div>
              </li>
            </ul>
          </li>
        </ul>
      </div>
      <div v-else-if="relatedItemsView === 'iteration'" class="system-version-detail-page__related-tree system-version-detail-page__iteration-view" role="tree" :aria-label="t('systemVersionView.detailView.relatedViewByIteration')">
        <ul class="system-version-detail-page__tree-list" role="group">
          <li v-for="project in detail.relatedItems?.projects || []" :key="`iteration-project-${project.id}`" class="system-version-detail-page__tree-item" role="treeitem" aria-level="2">
            <div class="system-version-detail-page__tree-node">
              <span class="system-version-detail-page__tree-icon"><FolderOpenOutlined /></span>
              <button type="button" class="system-version-detail-page__tree-link" @click="openRelatedItem('project', project.id)">{{ project.name }}</button>
              <a-tag :color="relatedStatusColor(project.status)">{{ relatedStatusLabel(project.status) }}</a-tag>
              <span class="system-version-detail-page__tree-meta">{{ project.ownerName || t('common.unset') }} · {{ project.progress ?? 0 }}%<template v-if="iterationRange(project.startDate, project.endDate)"> · {{ iterationRange(project.startDate, project.endDate) }}</template></span>
            </div>
            <ul v-if="projectStories(project).length" class="system-version-detail-page__tree-list" role="group">
              <li v-for="iterationGroup in groupStoriesByIteration(projectStories(project))" :key="`iteration-project-${project.id}-${iterationGroup.key}`" class="system-version-detail-page__tree-item system-version-detail-page__iteration-group" role="treeitem" aria-level="3">
                <div class="system-version-detail-page__tree-node system-version-detail-page__iteration-group-header">
                  <span class="system-version-detail-page__tree-icon"><CalendarOutlined /></span>
                  <strong>{{ iterationGroup.iteration?.name || t('systemVersionView.detailView.unassignedIteration') }}</strong>
                  <span class="system-version-detail-page__tree-meta">{{ t('systemVersionView.detailView.sourceIteration') }}<template v-if="iterationGroup.iteration && iterationRange(iterationGroup.iteration.startDate, iterationGroup.iteration.dueDate)"> · {{ iterationRange(iterationGroup.iteration.startDate, iterationGroup.iteration.dueDate) }}</template></span>
                </div>
                <ul class="system-version-detail-page__tree-list system-version-detail-page__iteration-group-list" role="group">
                  <li v-for="story in iterationGroup.stories" :key="`iteration-story-${story.id}`" class="system-version-detail-page__tree-item" role="treeitem" aria-level="4">
                    <div class="system-version-detail-page__tree-node">
                      <span class="system-version-detail-page__tree-icon"><FileTextOutlined /></span>
                      <button type="button" class="system-version-detail-page__tree-link" @click="openRelatedItem('story', story.id)">{{ story.title }}</button>
                      <a-tag :color="relatedStatusColor(story.status)">{{ relatedStatusLabel(story.status) }}</a-tag>
                      <span class="system-version-detail-page__tree-meta">{{ story.ownerName || t('common.unset') }} · {{ story.progress ?? 0 }}%<template v-if="iterationRange(story.startDate, story.dueDate)"> · {{ iterationRange(story.startDate, story.dueDate) }}</template></span>
                    </div>
                    <span class="system-version-detail-page__story-context">{{ t('systemVersionView.detailView.sourceTopic') }}：{{ storyTopicLabel(story, project.topics || []) }}</span>
                  </li>
                </ul>
              </li>
            </ul>
          </li>
          <li v-if="unboundStories().length" class="system-version-detail-page__tree-item system-version-detail-page__tree-item--group" role="treeitem" aria-level="2">
            <div class="system-version-detail-page__tree-node"><span class="system-version-detail-page__tree-icon"><FileTextOutlined /></span><strong>{{ t('systemVersionView.detailView.unboundProject') }}</strong></div>
            <ul class="system-version-detail-page__tree-list" role="group">
              <li v-for="iterationGroup in groupStoriesByIteration(unboundStories())" :key="`iteration-unbound-${iterationGroup.key}`" class="system-version-detail-page__tree-item system-version-detail-page__iteration-group" role="treeitem" aria-level="3">
                <div class="system-version-detail-page__tree-node system-version-detail-page__iteration-group-header">
                  <span class="system-version-detail-page__tree-icon"><CalendarOutlined /></span>
                  <strong>{{ iterationGroup.iteration?.name || t('systemVersionView.detailView.unassignedIteration') }}</strong>
                  <span class="system-version-detail-page__tree-meta">{{ t('systemVersionView.detailView.sourceIteration') }}<template v-if="iterationGroup.iteration && iterationRange(iterationGroup.iteration.startDate, iterationGroup.iteration.dueDate)"> · {{ iterationRange(iterationGroup.iteration.startDate, iterationGroup.iteration.dueDate) }}</template></span>
                </div>
                <ul class="system-version-detail-page__tree-list system-version-detail-page__iteration-group-list" role="group">
                  <li v-for="story in iterationGroup.stories" :key="`iteration-unbound-story-${story.id}`" class="system-version-detail-page__tree-item" role="treeitem" aria-level="4">
                    <div class="system-version-detail-page__tree-node">
                      <span class="system-version-detail-page__tree-icon"><FileTextOutlined /></span>
                      <button type="button" class="system-version-detail-page__tree-link" @click="openRelatedItem('story', story.id)">{{ story.title }}</button>
                      <a-tag :color="relatedStatusColor(story.status)">{{ relatedStatusLabel(story.status) }}</a-tag>
                      <span class="system-version-detail-page__tree-meta">{{ story.ownerName || t('common.unset') }} · {{ story.progress ?? 0 }}%<template v-if="iterationRange(story.startDate, story.dueDate)"> · {{ iterationRange(story.startDate, story.dueDate) }}</template></span>
                    </div>
                    <span class="system-version-detail-page__story-context">{{ t('systemVersionView.detailView.sourceTopic') }}：{{ storyTopicLabel(story, detail.relatedItems?.unboundTopics || []) }}</span>
                  </li>
                </ul>
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </section>

    <section class="system-version-detail-page__section pms-detail-panel pms-section-panel card-surface">
      <div class="pms-section-heading"><div><h2>{{ t('systemVersionView.detailView.releaseNotes') }}</h2></div></div>
      <p v-if="detail.releaseNotes" class="system-version-detail-page__notes">{{ detail.releaseNotes }}</p>
      <p v-else class="system-version-detail-page__empty-copy">{{ t('systemVersionView.detailView.noReleaseNotes') }}</p>
    </section>

    <section class="system-version-detail-page__section pms-detail-panel pms-section-panel card-surface">
      <div class="pms-section-heading"><div><h2>{{ t('systemVersionView.detailView.history') }}</h2></div><span class="pms-table-subtext">{{ detail.history?.length || 0 }}</span></div>
      <a-alert v-if="historyError" type="warning" show-icon :message="historyError" class="system-version-detail-page__alert">
        <template #action><a-button size="small" @click="loadData">{{ t('common.retry') }}</a-button></template>
      </a-alert>
      <div class="pms-table-scroll system-version-detail-page__history-scroll">
        <a-table :data-source="detail.history || []" :columns="historyColumns" :pagination="false" row-key="id">
          <template #emptyText><div class="system-version-detail-page__empty-copy">{{ t('systemVersionView.detailView.noHistory') }}</div></template>
          <template #bodyCell="{ column, record }">
             <template v-if="column.key === 'action'">
                <div class="system-version-detail-page__history-action">
                  <strong>{{ historyAction(record) }}</strong>
                  <span v-if="record.fromStatus && record.toStatus" class="system-version-detail-page__history-status">{{ statusLabel(record.fromStatus) }} → {{ statusLabel(record.toStatus) }}</span>
                </div>
              </template>
            <template v-else-if="column.key === 'operator'">{{ record.operatorName || t('common.system') }}</template>
            <template v-else-if="column.key === 'createdAt'">{{ formatDateTime(record.createdAt) }}</template>
            <template v-else-if="column.key === 'reason'"><span class="system-version-detail-page__reason">{{ record.reason || t('common.unset') }}</span></template>
          </template>
        </a-table>
      </div>
    </section>
  </div>
  <div v-else class="system-version-detail-page__error card-surface" role="alert">
    <strong>{{ t('systemVersionView.detailView.detailLoadFailed') }}</strong>
    <a-button class="pms-secondary-button" @click="loadData">{{ t('systemVersionView.detailView.retry') }}</a-button>
  </div>

  <a-modal
    v-model:open="statusOpen"
    class="pms-modal system-version-status-modal"
    :title="t('systemVersionView.detailView.statusChangeTitle')"
    :width="520"
    :confirm-loading="statusSaving"
    :ok-text="t('systemVersionView.save')"
    :cancel-text="t('common.cancel')"
    @ok="saveStatus"
    @cancel="closeStatusChange"
  >
    <p class="system-version-status-modal__hint">{{ t('systemVersionView.detailView.statusChangeHint') }}</p>
    <a-form layout="vertical">
      <a-form-item :label="t('systemVersionView.detailView.status')"><a-tag v-if="statusTarget" :color="systemVersionStatusColor(statusTarget)">{{ statusLabel(statusTarget) }}</a-tag></a-form-item>
      <a-form-item :label="t('systemVersionView.detailView.reason')" required>
        <a-textarea v-model:value="statusForm.reason" :placeholder="t('systemVersionView.detailView.reasonPlaceholder')" :rows="4" maxlength="1000" show-count />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped>
.system-version-detail-page { min-width: 0; }
.detail-breadcrumb { display: flex; align-items: center; gap: 9px; margin-bottom: 14px; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.detail-breadcrumb__back { padding: 0; color: var(--pms-text-muted); font: inherit; background: none; border: 0; cursor: pointer; }
.detail-breadcrumb__back:hover { color: var(--pms-primary); }
.detail-breadcrumb__separator { color: var(--pms-text-faint); }
.system-version-detail-page__loading, .system-version-detail-page__error { display: grid; min-height: 280px; place-items: center; gap: 14px; color: var(--pms-text-muted); }
.system-version-detail-page__error { padding: 40px; }
.system-version-detail-page__hero { display: grid; gap: 24px; }
.system-version-detail-page__meta-grid, .system-version-detail-page__date-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.system-version-detail-page__meta-grid > div, .system-version-detail-page__date-grid > div { display: grid; gap: 8px; min-width: 0; }
.system-version-detail-page__meta-grid span, .system-version-detail-page__date-grid span { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.system-version-detail-page__meta-grid strong, .system-version-detail-page__date-grid strong { display: inline-flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; color: var(--pms-text); font-size: 13px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.system-version-detail-page__date-grid { padding-top: 20px; border-top: 1px solid var(--pms-border); }
.system-version-detail-page__section { min-width: 0; }
.system-version-detail-page__related-items { overflow: hidden; }
.system-version-detail-page__related-items :deep(.pms-section-heading__hint) { margin: 6px 0 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); line-height: 1.5; }
.system-version-detail-page__related-heading-actions { display: flex; align-items: center; gap: 12px; }
.system-version-detail-page__related-count { padding: 5px 9px; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); border: 1px solid var(--pms-border); border-radius: 999px; background: var(--pms-surface-muted); white-space: nowrap; }
.system-version-detail-page__related-view-switch { display: inline-flex; gap: 3px; padding: 3px; border: 1px solid var(--pms-border); border-radius: 8px; background: var(--pms-surface-muted); }
.system-version-detail-page__related-view-switch button { padding: 6px 12px; color: var(--pms-text-muted); font: inherit; font-size: var(--pms-font-size-compact); border: 0; border-radius: 6px; background: transparent; cursor: pointer; }
.system-version-detail-page__related-view-switch button:hover { color: var(--pms-primary); }
.system-version-detail-page__related-view-switch button.is-active { color: var(--pms-primary); font-weight: 700; background: var(--pms-surface, #fff); box-shadow: 0 1px 3px rgb(16 34 63 / 8%); }
.system-version-detail-page__related-tree { margin-top: 16px; padding: 0; overflow-x: auto; }
.system-version-detail-page__tree-node { display: flex; align-items: center; gap: 9px; min-width: 0; min-height: 34px; }
.system-version-detail-page__tree-copy { display: grid; gap: 2px; min-width: 0; }
.system-version-detail-page__tree-copy strong { color: var(--pms-text); }
.system-version-detail-page__tree-copy span, .system-version-detail-page__tree-meta { color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); white-space: nowrap; }
.system-version-detail-page__tree-list { position: relative; display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
.system-version-detail-page__tree-list .system-version-detail-page__tree-list { margin-top: 7px; padding: 0 0 0 22px; border-left: 1px solid var(--pms-border); }
.system-version-detail-page__tree-list > .system-version-detail-page__tree-item { position: relative; }
.system-version-detail-page__tree-icon { display: inline-grid; flex: 0 0 auto; width: 24px; height: 24px; place-items: center; color: var(--pms-primary); border-radius: 6px; background: var(--pms-primary-soft, #eaf2ff); }
.system-version-detail-page__tree-link { max-width: min(360px, 45vw); padding: 0; overflow: hidden; color: var(--pms-text); font: inherit; font-weight: 650; text-align: left; text-overflow: ellipsis; white-space: nowrap; background: transparent; border: 0; cursor: pointer; }
.system-version-detail-page__tree-link:hover { color: var(--pms-primary); }
.system-version-detail-page__tree-meta { overflow: hidden; text-overflow: ellipsis; }
.system-version-detail-page__tree-list > .system-version-detail-page__tree-item[aria-level="2"] { padding: 14px; border: 1px solid var(--pms-border); border-radius: 9px; background: var(--pms-surface); box-shadow: var(--pms-shadow-sm); }
.system-version-detail-page__tree-list > .system-version-detail-page__tree-item[aria-level="2"] > .system-version-detail-page__tree-node { min-height: 38px; }
.system-version-detail-page__tree-list > .system-version-detail-page__tree-item[aria-level="3"] > .system-version-detail-page__tree-node { padding: 5px 2px; }
.system-version-detail-page__tree-item[aria-level="4"] > .system-version-detail-page__tree-node { padding: 7px 8px; border-radius: 6px; background: var(--pms-surface-muted); }
.system-version-detail-page__tree-item--group > .system-version-detail-page__tree-node { padding: 5px 2px; color: var(--pms-text-muted); }
.system-version-detail-page__iteration-group-header { padding: 8px 10px; border: 1px solid var(--pms-border); border-radius: 7px; background: var(--pms-surface-muted); }
.system-version-detail-page__iteration-group-header strong { color: var(--pms-text); font-size: var(--pms-font-size-compact); }
.system-version-detail-page__iteration-group-header .system-version-detail-page__tree-meta { margin-left: auto; }
.system-version-detail-page__iteration-group-list { padding-left: 14px !important; border-left-color: var(--pms-border-strong) !important; }
.system-version-detail-page__iteration-tags { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 1px 0 2px 33px; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.system-version-detail-page__iteration-tag, .system-version-detail-page__story-context { display: inline-flex; align-items: center; padding: 3px 7px; color: var(--pms-text-muted); border: 1px solid var(--pms-border); border-radius: 999px; background: var(--pms-surface-muted); }
.system-version-detail-page__iteration-tag small { color: var(--pms-text-faint); }
.system-version-detail-page__story-context { margin: 1px 0 2px 33px; font-size: var(--pms-font-size-compact); }
.system-version-detail-page__notes { margin: 16px 0 0; color: var(--pms-text); line-height: 1.7; white-space: pre-wrap; }
.system-version-detail-page__empty-copy { margin: 16px 0 0; color: var(--pms-text-faint); }
.system-version-detail-page__alert { margin: 14px 0; }
.system-version-detail-page__history-scroll { min-height: 150px; }
.system-version-detail-page__history-scroll :deep(.ant-table-wrapper) { min-width: 780px; }
.system-version-detail-page__history-scroll :deep(.ant-table-tbody > tr > td) { white-space: normal; }
.system-version-detail-page__reason { white-space: pre-wrap; }
.system-version-detail-page__title-row { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 10px; min-width: 0; }
.system-version-detail-page__header-status { flex: 0 0 auto; margin: 0; padding-inline: 8px; vertical-align: middle; }
.system-version-detail-page__summary-status { justify-self: start; width: fit-content; max-width: 100%; margin: 0; }
.system-version-detail-page__history-action { display: grid; gap: 3px; min-width: 0; line-height: 1.35; }
.system-version-detail-page__history-action strong { display: block; color: var(--pms-text); font-weight: 700; }
.system-version-detail-page__history-status { display: block; color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); line-height: 1.45; white-space: nowrap; }
.system-version-detail-page__status-select { width: 150px; }
.system-version-status-modal__hint { margin: 0 0 16px; color: var(--pms-text-muted); line-height: 1.6; }
@media (max-width: 760px) {
  .system-version-detail-page__meta-grid, .system-version-detail-page__date-grid { grid-template-columns: 1fr; }
  .system-version-detail-page__status-select { width: 100%; }
  .system-version-detail-page__related-heading-actions { align-items: stretch; flex-direction: column; gap: 8px; }
  .system-version-detail-page__related-count { align-self: flex-start; }
  .system-version-detail-page__related-view-switch { display: flex; width: 100%; }
  .system-version-detail-page__related-view-switch button { flex: 1; }
  .system-version-detail-page__related-tree { padding: 14px; }
  .system-version-detail-page__tree-node { align-items: flex-start; flex-wrap: wrap; }
  .system-version-detail-page__tree-link { max-width: calc(100vw - 150px); }
  .system-version-detail-page__tree-meta { width: 100%; margin-left: 33px; }
}
</style>
