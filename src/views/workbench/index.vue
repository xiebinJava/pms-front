<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  MessageOutlined,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons-vue'
import { getComments } from '/@/api/comment'
import { getProjectPage } from '/@/api/project'
import { getTasks } from '/@/api/task'
import { Priority, ProjectStatus, TaskStatus, priorityTagColor, statusTagColor } from '/@/enums'
import { useUserStore } from '/@/store/user'
import type { Comment, Project, Task } from '/@/types/domain'
import { formatDate, formatDateTime } from '/@/utils/format'
import { getProjectManagerDisplay } from '/@/views/project/detail/workflow'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
import {
  buildWorkbenchSummary,
  selectMyProjects,
  selectMyTasks,
  selectRecentActivities,
  sortWorkbenchTasks,
  type WorkbenchActivity,
} from './workbench'

const MAX_PROJECT_CONTEXTS = 20

const router = useRouter()
const userStore = useUserStore()
const projects = ref<Project[]>([])
const tasks = ref<Task[]>([])
const activities = ref<WorkbenchActivity[]>([])
const loading = ref(false)
const errorMessage = ref('')
const partialFailure = ref(false)

const currentUserId = computed(() => userStore.user?.id)
const summary = computed(() => buildWorkbenchSummary(projects.value, tasks.value, currentUserId.value))
const myTasks = computed(() => sortWorkbenchTasks(selectMyTasks(tasks.value, projects.value, currentUserId.value)).slice(0, 8))
const myProjects = computed(() => selectMyProjects(projects.value, tasks.value, currentUserId.value).slice(0, 6))
const recentActivities = computed(() => selectRecentActivities(activities.value, 5))
const overviewCards = computed(() => [
  { label: '待处理任务', value: summary.value.pendingTaskCount, hint: '需要我推进', icon: CheckCircleOutlined, tone: 'blue' },
  { label: '进行中任务', value: summary.value.inProgressTaskCount, hint: '正在执行', icon: ClockCircleOutlined, tone: 'orange' },
  { label: '近 7 天到期', value: summary.value.dueSoonTaskCount, hint: '请关注截止时间', icon: CalendarOutlined, tone: 'purple' },
  { label: '参与项目', value: summary.value.participatingProjectCount, hint: '我负责或参与', icon: TeamOutlined, tone: 'green' },
])

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function projectPath(project: Project) {
  return project.orgUnitPath || project.orgUnitName || '未设置业务线'
}

function openProject(projectId: number) {
  router.push(`/projects/${projectId}`)
}

async function loadData() {
  loading.value = true
  errorMessage.value = ''
  partialFailure.value = false

  try {
    const page = await getProjectPage({ currPage: 1, pageSize: 50 })
    const contexts = page.list.slice(0, MAX_PROJECT_CONTEXTS)
    const [taskResults, commentResults] = await Promise.all([
      Promise.allSettled(contexts.map((project) => getTasks(project.id))),
      Promise.allSettled(contexts.map((project) => getComments(project.id))),
    ])
    const loadedTasks: Task[] = []
    const loadedActivities: WorkbenchActivity[] = []

    taskResults.forEach((result) => {
      if (result.status === 'fulfilled') loadedTasks.push(...result.value)
      else partialFailure.value = true
    })
    commentResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const project = contexts[index]
        if (!project) return
        loadedActivities.push(...result.value.map((comment: Comment) => ({
          ...comment,
          projectName: project.name,
          actorName: comment.userNickname || `用户 ${comment.userId}`,
        })))
      } else partialFailure.value = true
    })

    projects.value = page.list
    tasks.value = loadedTasks
    activities.value = loadedActivities
  } catch (error) {
    projects.value = []
    tasks.value = []
    activities.value = []
    errorMessage.value = getErrorMessage(error, '工作台加载失败，请重试')
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="workbench-page pms-page-stack">
    <PmsPageHeader title="我的工作" description="集中查看我负责和参与的项目、任务与近期动态。">
      <template #actions>
        <a-button class="pms-secondary-button" :loading="loading" @click="loadData">
          <ReloadOutlined /> 刷新
        </a-button>
      </template>
    </PmsPageHeader>

    <a-alert
      v-if="errorMessage"
      type="error"
      show-icon
      message="工作台暂时无法加载"
      :description="errorMessage"
    >
      <template #action>
        <a-button size="small" @click="loadData">重试</a-button>
      </template>
    </a-alert>
    <a-alert
      v-else-if="partialFailure"
      type="warning"
      show-icon
      message="部分项目数据暂时无法加载"
      description="已展示其余可用内容，请稍后刷新。"
    />

    <div v-if="loading && !projects.length" class="workbench-loading pms-panel">
      <a-spin tip="正在加载我的工作..." />
    </div>

    <template v-else>
      <section class="workbench-section" aria-labelledby="workbench-overview-title">
        <div class="workbench-section-heading">
          <div>
            <h2 id="workbench-overview-title">工作概览</h2>
            <p>用一眼可读的摘要掌握今天的工作重点。</p>
          </div>
        </div>
        <div class="workbench-overview-grid">
          <article v-for="card in overviewCards" :key="card.label" class="workbench-overview-card pms-panel">
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
              <h2 id="workbench-tasks-title">我的任务</h2>
              <p>按任务状态和截止时间排列，优先处理紧急事项。</p>
            </div>
            <span class="workbench-panel__count">{{ myTasks.length }} 条</span>
          </div>
          <div v-if="myTasks.length" class="workbench-task-list">
            <button
              v-for="task in myTasks"
              :key="task.id"
              type="button"
              class="workbench-task-row"
              :aria-label="`查看任务：${task.title}`"
              @click="openProject(task.projectId)"
            >
              <span class="workbench-task-row__main">
                <strong>{{ task.title }}</strong>
                <small>{{ task.projectName }}<template v-if="task.projectCode"> · {{ task.projectCode }}</template></small>
              </span>
              <span class="workbench-task-row__meta">
                <a-tag :color="statusTagColor[task.status]">{{ TaskStatus.label(task.status) }}</a-tag>
                <a-tag :color="priorityTagColor[task.priority]">{{ Priority.label(task.priority) }}</a-tag>
                <small>{{ formatDate(task.dueDate) }}</small>
              </span>
            </button>
          </div>
          <a-empty v-else description="暂无待处理工作" />
        </section>

        <section class="workbench-panel pms-panel" aria-labelledby="workbench-projects-title">
          <div class="workbench-panel__header">
            <div>
              <h2 id="workbench-projects-title">项目进展</h2>
              <p>我负责或参与的项目当前进度。</p>
            </div>
            <span class="workbench-panel__count">{{ myProjects.length }} 个</span>
          </div>
          <div v-if="myProjects.length" class="workbench-project-list">
            <button
              v-for="project in myProjects"
              :key="project.id"
              type="button"
              class="workbench-project-row"
              :aria-label="`查看项目：${project.name}`"
              @click="openProject(project.id)"
            >
              <span class="workbench-project-row__main">
                <strong>{{ project.name }}</strong>
                <small>{{ projectPath(project) }}</small>
              </span>
              <span class="workbench-project-row__progress">
                <a-tag :color="statusTagColor[project.status]">{{ ProjectStatus.label(project.status || 1) }}</a-tag>
                <a-progress :percent="project.progress || 0" size="small" :show-info="false" />
                <small>{{ project.progress || 0 }}%</small>
              </span>
              <span class="workbench-project-row__manager">项目经理：{{ getProjectManagerDisplay(project.projectManagerName) }}</span>
            </button>
          </div>
          <a-empty v-else description="暂无参与项目" />
        </section>

        <section class="workbench-panel pms-panel workbench-panel--activity" aria-labelledby="workbench-activity-title">
          <div class="workbench-panel__header">
            <div>
              <h2 id="workbench-activity-title">最近动态</h2>
              <p>来自项目协作区的最新留言。</p>
            </div>
            <MessageOutlined class="workbench-panel__header-icon" />
          </div>
          <div v-if="recentActivities.length" class="workbench-activity-list">
            <div v-for="activity in recentActivities" :key="activity.id" class="workbench-activity-row">
              <div class="workbench-activity-row__dot" />
              <div class="workbench-activity-row__content">
                <p><strong>{{ activity.actorName }}</strong> 在 <button type="button" @click="openProject(activity.projectId)">{{ activity.projectName }}</button> 中留言</p>
                <span>{{ activity.content }}</span>
                <small>{{ formatDateTime(activity.createdAt) }}</small>
              </div>
            </div>
          </div>
          <a-empty v-else description="暂无最近动态" />
        </section>
      </div>
    </template>
  </div>
</template>
