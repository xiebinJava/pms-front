<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  MessageOutlined,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons-vue'
import { getWorkbench } from '/@/api/workbench'
import { priorityKey, projectStatusKey, projectStatusTagColor, taskStatusKey, taskStatusTagColor, priorityTagColor } from '/@/enums'
import type { Project } from '/@/types/domain'
import { formatDate, formatDateTime } from '/@/utils/format'
import { getProjectManagerDisplay } from '/@/views/project/detail/workflow'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
import {
  type WorkbenchActivity,
  type WorkbenchSummary,
  type WorkbenchTask,
} from './workbench'

const emptySummary = (): WorkbenchSummary => ({
  pendingTaskCount: 0,
  inProgressTaskCount: 0,
  dueSoonTaskCount: 0,
  participatingProjectCount: 0,
})

const router = useRouter()
const { t } = useI18n()
const projects = ref<Project[]>([])
const myTasks = ref<WorkbenchTask[]>([])
const recentActivities = ref<WorkbenchActivity[]>([])
const summary = ref<WorkbenchSummary>(emptySummary())
const loading = ref(false)
const errorMessage = ref('')
const myProjects = computed(() => projects.value)
const overviewCards = computed(() => [
  { key: 'pending', label: t('workbench.pendingTasks'), value: summary.value.pendingTaskCount, hint: t('workbench.pendingHint'), icon: CheckCircleOutlined, tone: 'blue' },
  { key: 'doing', label: t('workbench.inProgressTasks'), value: summary.value.inProgressTaskCount, hint: t('workbench.inProgressHint'), icon: ClockCircleOutlined, tone: 'orange' },
  { key: 'due', label: t('workbench.dueSoon'), value: summary.value.dueSoonTaskCount, hint: t('workbench.dueSoonHint'), icon: CalendarOutlined, tone: 'purple' },
  { key: 'projects', label: t('workbench.participating'), value: summary.value.participatingProjectCount, hint: t('workbench.participatingHint'), icon: TeamOutlined, tone: 'green' },
])

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function projectPath(project: Project) {
  return project.orgUnitPath || project.orgUnitName || t('workbench.noLine')
}

function openProject(projectId: number) {
  router.push(`/projects/${projectId}`)
}

function openTask(task: WorkbenchTask) {
  router.push({ path: `/projects/${task.projectId}`, query: { task: String(task.id) } })
}

async function loadData() {
  loading.value = true
  errorMessage.value = ''

  try {
    const payload = await getWorkbench()
    summary.value = payload.summary || emptySummary()
    myTasks.value = payload.tasks || []
    projects.value = payload.projects || []
    recentActivities.value = payload.activities || []
  } catch (error) {
    errorMessage.value = getErrorMessage(error, t('workbench.loadFailed'))
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="workbench-page pms-page-stack">
    <PmsPageHeader :title="$t('workbench.pageTitle')" :description="$t('workbench.pageDescription')">
      <template #actions>
        <a-button class="pms-secondary-button" :loading="loading" @click="loadData">
          <ReloadOutlined /> {{ $t('common.refresh') }}
        </a-button>
      </template>
    </PmsPageHeader>

    <a-alert
      v-if="errorMessage"
      type="error"
      show-icon
      :message="$t('workbench.loadUnavailable')"
      :description="errorMessage"
    >
      <template #action>
        <a-button size="small" @click="loadData">{{ $t('common.retry') }}</a-button>
      </template>
    </a-alert>
    <div v-if="loading && !projects.length && !myTasks.length" class="workbench-loading pms-panel">
      <a-spin :tip="$t('workbench.loading')" />
    </div>

    <template v-else>
      <section class="workbench-section" aria-labelledby="workbench-overview-title">
        <div class="workbench-section-heading">
          <div>
            <h2 id="workbench-overview-title">{{ $t('workbench.overview') }}</h2>
            <p>{{ $t('workbench.overviewHint') }}</p>
          </div>
        </div>
        <div class="workbench-overview-grid">
          <article v-for="card in overviewCards" :key="card.key" class="workbench-overview-card pms-panel">
            <div class="workbench-overview-card__icon" :class="`workbench-overview-card__icon--${card.tone}`">
              <component :is="card.icon" />
            </div>
            <div class="workbench-overview-card__content">
              <span>{{ card.label }}</span>
              <strong>{{ card.value }}</strong>
              <small>{{ card.hint }}</small>
            </div>
          </article>
        </div>
      </section>

      <div class="workbench-content-grid">
        <section class="workbench-panel pms-panel" aria-labelledby="workbench-tasks-title">
          <div class="workbench-panel__header">
            <div>
              <h2 id="workbench-tasks-title">{{ $t('workbench.myTasks') }}</h2>
              <p>{{ $t('workbench.myTasksHint') }}</p>
            </div>
            <span class="workbench-panel__count">{{ $t('workbench.taskCount', { count: myTasks.length }) }}</span>
          </div>
          <div v-if="myTasks.length" class="workbench-task-list">
            <button
              v-for="task in myTasks"
              :key="task.id"
              type="button"
              class="workbench-task-row"
              :aria-label="$t('workbench.viewTask', { title: task.title })"
              @click="openTask(task)"
            >
              <span class="workbench-task-row__main">
                <strong>{{ task.title }}</strong>
                <small>{{ task.projectName }}<template v-if="task.projectCode"> · {{ task.projectCode }}</template></small>
              </span>
              <span class="workbench-task-row__meta">
                <a-tag :color="taskStatusTagColor(task.status)">{{ $t(taskStatusKey(task.status)) }}</a-tag>
                <a-tag :color="priorityTagColor[task.priority]">{{ $t(priorityKey(task.priority)) }}</a-tag>
                <small>{{ formatDate(task.dueDate) }}</small>
              </span>
            </button>
          </div>
          <a-empty v-else :description="$t('workbench.emptyTasks')" />
        </section>

        <section class="workbench-panel pms-panel" aria-labelledby="workbench-projects-title">
          <div class="workbench-panel__header">
            <div>
              <h2 id="workbench-projects-title">{{ $t('workbench.projects') }}</h2>
              <p>{{ $t('workbench.projectsHint') }}</p>
            </div>
            <span class="workbench-panel__count">{{ $t('workbench.projectCount', { count: myProjects.length }) }}</span>
          </div>
          <div v-if="myProjects.length" class="workbench-project-list">
            <button
              v-for="project in myProjects"
              :key="project.id"
              type="button"
              class="workbench-project-row"
              :aria-label="$t('workbench.viewProject', { name: project.name })"
              @click="openProject(project.id)"
            >
              <span class="workbench-project-row__main">
                <strong>{{ project.name }}</strong>
                <small>{{ projectPath(project) }}</small>
              </span>
              <span class="workbench-project-row__progress">
                <a-tag :color="projectStatusTagColor(project.status)">{{ $t(projectStatusKey(project.status)) }}</a-tag>
                <a-progress :percent="project.progress || 0" size="small" :show-info="false" />
                <small>{{ project.progress || 0 }}%</small>
              </span>
              <span class="workbench-project-row__manager">{{ $t('workbench.manager', { name: getProjectManagerDisplay(project.projectManagerName) }) }}</span>
            </button>
          </div>
          <a-empty v-else :description="$t('workbench.emptyProjects')" />
        </section>

        <section class="workbench-panel pms-panel workbench-panel--activity" aria-labelledby="workbench-activity-title">
          <div class="workbench-panel__header">
            <div>
              <h2 id="workbench-activity-title">{{ $t('workbench.activity') }}</h2>
              <p>{{ $t('workbench.activityHint') }}</p>
            </div>
            <MessageOutlined class="workbench-panel__header-icon" />
          </div>
          <div v-if="recentActivities.length" class="workbench-activity-list">
            <div v-for="activity in recentActivities" :key="activity.id" class="workbench-activity-row">
              <div class="workbench-activity-row__dot" />
              <div class="workbench-activity-row__content">
                <i18n-t keypath="workbench.commentedIn" tag="p">
                  <template #actor><strong>{{ activity.actorName }}</strong></template>
                  <template #project>
                    <button type="button" @click="openProject(activity.projectId)">{{ activity.projectName }}</button>
                  </template>
                </i18n-t>
                <span>{{ activity.content }}</span>
                <small>{{ formatDateTime(activity.createdAt) }}</small>
              </div>
            </div>
          </div>
          <a-empty v-else :description="$t('workbench.emptyActivity')" />
        </section>
      </div>
    </template>
  </div>
</template>
