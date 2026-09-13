<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ProjectOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons-vue'
import { getProjectPage } from '/@/api/project'
import { getNodes } from '/@/api/node'
import { getNodePlanResourceRisk } from '/@/api/node-plan-resource-risk'
import type { Project, ProjectNode } from '/@/types/domain'
import { formatDate, formatDateTime } from '/@/utils/format'
import { nodeHasComponent } from '/@/views/project/detail/workflow-config.mjs'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
import {
  assessProjectHealth,
  buildPortfolioSummary,
  filterDashboardProjects,
  type DashboardDataState,
  type DashboardHealth,
  type ProjectHealthAssessment,
} from './project-dashboard.mjs'

type ProjectStatusFilter = 'ACTIVE' | 'ALL' | 'COMPLETED' | 'TERMINATED'
type HealthFilter = DashboardHealth | 'ATTENTION' | 'ALL'

interface DashboardProject extends ProjectHealthAssessment {
  nodes: ProjectNode[]
}

const router = useRouter()
const { t } = useI18n()
const projects = ref<DashboardProject[]>([])
const loading = ref(true)
const analyticsReady = ref(false)
const loadingProgress = ref({ completed: 0, total: 0 })
const loadError = ref('')
const lastUpdatedAt = ref('')
const filters = reactive<{
  status: ProjectStatusFilter
  orgUnitId: number | 'ALL'
  health: HealthFilter
  query: string
}>({
  status: 'ACTIVE',
  orgUnitId: 'ALL',
  health: 'ALL',
  query: '',
})

let loadGeneration = 0

function isActiveProject(project: Project) {
  return project.status == null || project.status === 0 || project.status === 1
}

async function loadAllProjects() {
  const pageSize = 100
  const firstPage = await getProjectPage({ currPage: 1, pageSize, view: 'ALL' })
  const all = [...firstPage.list]
  const pageCount = Math.max(1, firstPage.totalPage || Math.ceil(firstPage.total / pageSize))

  for (let currPage = 2; currPage <= pageCount; currPage += 1) {
    const page = await getProjectPage({ currPage, pageSize, view: 'ALL' })
    all.push(...page.list)
    if (!page.list.length) break
  }
  return all
}

function lifecycleItem(project: Project): DashboardProject {
  const health = project.status === 2 ? 'COMPLETED' : 'TERMINATED'
  return {
    project,
    health,
    expectedProgress: project.status === 2 ? 100 : null,
    actualProgress: Math.max(0, Math.min(100, Number(project.progress) || 0)),
    progressVariance: null,
    overdueNodeCount: 0,
    openRiskCounts: { high: 0, medium: 0, low: 0 },
    openRiskCount: 0,
    riskDataState: 'NOT_CONFIGURED',
    nodeDataState: 'NOT_CONFIGURED',
    dataIssues: [],
    nextNode: null,
    nodes: [],
  }
}

async function assessProject(project: Project): Promise<DashboardProject> {
  let nodes: ProjectNode[] = []
  let nodeDataState: DashboardDataState = 'AVAILABLE'
  let riskDataState: DashboardDataState = 'NOT_CONFIGURED'
  let risks: Awaited<ReturnType<typeof getNodePlanResourceRisk>>['risks'] = []

  try {
    nodes = await getNodes(project.id)
  } catch {
    nodeDataState = 'UNAVAILABLE'
    riskDataState = 'UNAVAILABLE'
  }

  if (nodeDataState === 'AVAILABLE') {
    const riskNodes = nodes.filter((node) => nodeHasComponent(node, 'plan-resource-risk'))
    if (riskNodes.length) {
      riskDataState = 'AVAILABLE'
      const riskResults = await Promise.all(riskNodes.map(async (node) => {
        try {
          return { available: true, risks: (await getNodePlanResourceRisk(project.id, node.id)).risks || [] }
        } catch {
          return { available: false, risks: [] as typeof risks }
        }
      }))
      if (riskResults.some((result) => !result.available)) riskDataState = 'UNAVAILABLE'
      risks = riskResults.flatMap((result) => result.risks)
    }
  }

  return {
    ...assessProjectHealth(project, nodes, risks, {
      nodeDataState,
      riskDataState,
    }),
    nodes,
  }
}

async function loadData() {
  const generation = ++loadGeneration
  loading.value = true
  analyticsReady.value = false
  loadError.value = ''

  try {
    const allProjects = await loadAllProjects()
    if (generation !== loadGeneration) return

    const activeProjects = allProjects.filter(isActiveProject)
    const archivedItems = allProjects
      .filter((project) => !isActiveProject(project) && project.status !== 4)
      .map(lifecycleItem)
    const analyzed: DashboardProject[] = [...archivedItems]
    loadingProgress.value = { completed: 0, total: activeProjects.length }
    projects.value = [...analyzed]

    const batchSize = 6
    for (let start = 0; start < activeProjects.length; start += batchSize) {
      const batch = activeProjects.slice(start, start + batchSize)
      const results = await Promise.all(batch.map(assessProject))
      if (generation !== loadGeneration) return
      analyzed.push(...results)
      loadingProgress.value = {
        completed: Math.min(start + batch.length, activeProjects.length),
        total: activeProjects.length,
      }
      projects.value = [...analyzed]
    }

    analyticsReady.value = true
    lastUpdatedAt.value = new Date().toISOString()
  } catch (error) {
    loadError.value = error instanceof Error && error.message ? error.message : t('projectDashboard.loadFailed')
  } finally {
    if (generation === loadGeneration) loading.value = false
  }
}

const businessLineOptions = computed(() => {
  const lines = new Map<number, string>()
  for (const item of projects.value) {
    if (item.project.orgUnitId != null && item.project.orgUnitName) {
      lines.set(item.project.orgUnitId, item.project.orgUnitName)
    }
  }
  return [...lines.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
})

const scopedProjects = computed(() => filterDashboardProjects(projects.value, {
  status: filters.status,
  orgUnitId: filters.orgUnitId,
  query: filters.query,
  health: 'ALL',
}))
const visibleProjects = computed(() => filterDashboardProjects(scopedProjects.value, { health: filters.health }))
const summary = computed(() => buildPortfolioSummary(scopedProjects.value))
const attentionCount = computed(() => summary.value.watchProjectCount + summary.value.criticalProjectCount)

const healthRows = computed(() => {
  const total = summary.value.activeProjectCount
  return [
    { key: 'HEALTHY' as const, count: summary.value.healthyProjectCount, percent: total ? Math.round(summary.value.healthyProjectCount / total * 100) : 0 },
    { key: 'WATCH' as const, count: summary.value.watchProjectCount, percent: total ? Math.round(summary.value.watchProjectCount / total * 100) : 0 },
    { key: 'CRITICAL' as const, count: summary.value.criticalProjectCount, percent: total ? Math.round(summary.value.criticalProjectCount / total * 100) : 0 },
  ]
})

const upcomingNodes = computed(() => {
  const today = dayjs().format('YYYY-MM-DD')
  const limit = dayjs().add(30, 'day').format('YYYY-MM-DD')
  return scopedProjects.value
    .filter((item) => isActiveProject(item.project) && item.nextNode?.endDate && item.nextNode.endDate <= limit)
    .map((item) => ({
      projectId: item.project.id,
      projectName: item.project.name,
      nodeName: item.nextNode!.name,
      endDate: item.nextNode!.endDate!,
      daysUntil: Math.max(0, dayjs(item.nextNode!.endDate).startOf('day').diff(dayjs(today).startOf('day'), 'day')),
    }))
    .sort((left, right) => left.endDate.localeCompare(right.endDate))
    .slice(0, 6)
})

const columns = computed(() => [
  { title: t('projectDashboard.columns.project'), key: 'project', width: 250 },
  { title: t('projectDashboard.columns.health'), key: 'health', width: 210 },
  { title: t('projectDashboard.columns.currentNode'), key: 'node', width: 190 },
  { title: t('projectDashboard.columns.progress'), key: 'progress', width: 180 },
  { title: t('projectDashboard.columns.manager'), key: 'manager', width: 150 },
  { title: t('projectDashboard.columns.endDate'), key: 'endDate', width: 120 },
])

const tableRowKey = (item: DashboardProject) => item.project.id
const progressLabel = computed(() => loading.value && loadingProgress.value.total
  ? t('projectDashboard.analyzing', loadingProgress.value)
  : '')

function openProject(projectId: number) {
  void router.push(`/projects/${projectId}`)
}

function selectHealth(health: HealthFilter) {
  filters.health = filters.health === health ? 'ALL' : health
}

function healthTagColor(health: DashboardHealth) {
  if (health === 'CRITICAL') return 'red'
  if (health === 'WATCH') return 'orange'
  if (health === 'HEALTHY') return 'green'
  return 'default'
}

function dataIssueLabel(issue: string) {
  return t(`projectDashboard.dataIssues.${issue}`)
}

onMounted(loadData)
</script>

<template>
  <div class="project-dashboard pms-page-stack">
    <PmsPageHeader :title="$t('projectDashboard.pageTitle')" :description="$t('projectDashboard.pageDescription')">
      <template #actions>
        <span class="dashboard-updated" :aria-live="loading ? 'polite' : 'off'">
          <span>{{ progressLabel || $t('projectDashboard.scopeHint') }}</span>
          <small v-if="lastUpdatedAt">{{ $t('projectDashboard.updatedAt', { time: formatDateTime(lastUpdatedAt) }) }}</small>
        </span>
        <a-button class="pms-secondary-button" :loading="loading" @click="loadData">
          <ReloadOutlined /> {{ $t('common.refresh') }}
        </a-button>
      </template>
    </PmsPageHeader>

    <a-alert
      v-if="loadError"
      class="dashboard-alert"
      type="error"
      show-icon
      :message="$t('projectDashboard.loadUnavailable')"
      :description="loadError"
    >
      <template #action><a-button size="small" @click="loadData">{{ $t('common.retry') }}</a-button></template>
    </a-alert>
    <a-alert
      v-if="projects.some((item) => item.nodeDataState === 'UNAVAILABLE' || item.riskDataState === 'UNAVAILABLE')"
      class="dashboard-alert"
      type="warning"
      show-icon
      :message="$t('projectDashboard.partialData')"
      :description="$t('projectDashboard.partialDataHint')"
    />

    <section class="dashboard-filters pms-panel" :aria-label="$t('projectDashboard.filters.label')">
      <div class="dashboard-filter-group">
        <label for="dashboard-status">{{ $t('projectDashboard.filters.status') }}</label>
        <a-select id="dashboard-status" v-model:value="filters.status" class="dashboard-filter-control">
          <a-select-option value="ACTIVE">{{ $t('projectDashboard.filters.active') }}</a-select-option>
          <a-select-option value="ALL">{{ $t('projectDashboard.filters.all') }}</a-select-option>
          <a-select-option value="COMPLETED">{{ $t('projectDashboard.filters.completed') }}</a-select-option>
          <a-select-option value="TERMINATED">{{ $t('projectDashboard.filters.terminated') }}</a-select-option>
        </a-select>
      </div>
      <div class="dashboard-filter-group">
        <label for="dashboard-line">{{ $t('projectDashboard.filters.businessLine') }}</label>
        <a-select id="dashboard-line" v-model:value="filters.orgUnitId" class="dashboard-filter-control">
          <a-select-option value="ALL">{{ $t('projectDashboard.filters.allBusinessLines') }}</a-select-option>
          <a-select-option v-for="line in businessLineOptions" :key="line.id" :value="line.id">{{ line.name }}</a-select-option>
        </a-select>
      </div>
      <div class="dashboard-filter-group dashboard-filter-group--search">
        <label for="dashboard-search">{{ $t('projectDashboard.filters.searchLabel') }}</label>
        <a-input id="dashboard-search" v-model:value="filters.query" allow-clear :placeholder="$t('projectDashboard.filters.searchPlaceholder')">
          <template #prefix><ProjectOutlined /></template>
        </a-input>
      </div>
      <div v-if="filters.health !== 'ALL'" class="dashboard-filter-active">
        <span>{{ $t('projectDashboard.filters.healthFilter', { health: filters.health === 'ATTENTION' ? $t('projectDashboard.health.ATTENTION') : $t(`projectDashboard.health.${filters.health}`) }) }}</span>
        <a-button type="link" size="small" @click="filters.health = 'ALL'">{{ $t('projectDashboard.filters.clearHealth') }}</a-button>
      </div>
    </section>

    <a-spin :spinning="loading && projects.length === 0" :tip="$t('projectDashboard.loading')">
      <template v-if="projects.length || !loading">
        <section class="dashboard-kpi-grid" :aria-label="$t('projectDashboard.overview')">
          <button class="dashboard-kpi pms-panel" type="button" @click="selectHealth('ALL')">
            <span class="dashboard-kpi__icon dashboard-kpi__icon--blue"><ProjectOutlined /></span>
            <span class="dashboard-kpi__body">
              <span class="dashboard-kpi__label">{{ $t('projectDashboard.activeProjects') }}</span>
              <strong>{{ analyticsReady ? summary.activeProjectCount : '—' }}</strong>
              <small>{{ $t('projectDashboard.activeProjectsHint') }}</small>
            </span>
          </button>
          <button class="dashboard-kpi pms-panel" :class="{ 'is-selected': filters.health === 'ATTENTION' }" type="button" :aria-pressed="filters.health === 'ATTENTION'" @click="selectHealth('ATTENTION')">
            <span class="dashboard-kpi__icon dashboard-kpi__icon--warning"><WarningOutlined /></span>
            <span class="dashboard-kpi__body">
              <span class="dashboard-kpi__label">{{ $t('projectDashboard.attentionProjects') }}</span>
              <strong>{{ analyticsReady ? attentionCount : '—' }}</strong>
              <small>{{ $t('projectDashboard.attentionProjectsHint') }}</small>
            </span>
          </button>
          <button class="dashboard-kpi pms-panel" type="button" @click="selectHealth('CRITICAL')">
            <span class="dashboard-kpi__icon dashboard-kpi__icon--danger"><CalendarOutlined /></span>
            <span class="dashboard-kpi__body">
              <span class="dashboard-kpi__label">{{ $t('projectDashboard.overdueNodes') }}</span>
              <strong>{{ analyticsReady ? summary.overdueNodeCount : '—' }}</strong>
              <small>{{ $t('projectDashboard.overdueNodesHint') }}</small>
            </span>
          </button>
          <div class="dashboard-kpi pms-panel">
            <span class="dashboard-kpi__icon dashboard-kpi__icon--green"><CheckCircleOutlined /></span>
            <span class="dashboard-kpi__body">
              <span class="dashboard-kpi__label">{{ $t('projectDashboard.averageProgress') }}</span>
              <strong>{{ analyticsReady ? `${summary.averageProgress}%` : '—' }}</strong>
              <small>{{ $t('projectDashboard.averageProgressHint') }}</small>
            </span>
          </div>
        </section>

        <div class="dashboard-analysis-grid">
          <section class="dashboard-panel pms-panel" aria-labelledby="dashboard-health-title">
            <div class="dashboard-panel__header">
              <div>
                <h2 id="dashboard-health-title">{{ $t('projectDashboard.healthDistribution') }}</h2>
                <p>{{ $t('projectDashboard.healthDistributionHint') }}</p>
              </div>
              <a-tooltip :title="$t('projectDashboard.healthRule')"><span class="dashboard-health-rule">{{ $t('projectDashboard.healthRuleLabel') }}</span></a-tooltip>
            </div>
            <div class="dashboard-health-list">
              <button
                v-for="row in healthRows"
                :key="row.key"
                class="dashboard-health-row"
                :class="[`dashboard-health-row--${row.key.toLowerCase()}`, { 'is-selected': filters.health === row.key }]"
                type="button"
                :aria-pressed="filters.health === row.key"
                @click="selectHealth(row.key)"
              >
                <span class="dashboard-health-row__top">
                  <span class="dashboard-health-row__name"><i />{{ $t(`projectDashboard.health.${row.key}`) }}</span>
                  <strong>{{ analyticsReady ? row.count : '—' }}<small>{{ $t('projectDashboard.projectUnit') }}</small></strong>
                </span>
                <span class="dashboard-health-meter"><i :style="{ width: `${row.percent}%` }" /></span>
              </button>
            </div>
            <div class="dashboard-health-footnote">
              <span>{{ $t('projectDashboard.healthDataHint') }}</span>
              <span>{{ $t('projectDashboard.criticalRuleShort') }}</span>
            </div>
          </section>

          <section class="dashboard-panel pms-panel" aria-labelledby="dashboard-upcoming-title">
            <div class="dashboard-panel__header">
              <div>
                <h2 id="dashboard-upcoming-title">{{ $t('projectDashboard.upcomingNodes') }}</h2>
                <p>{{ $t('projectDashboard.upcomingNodesHint') }}</p>
              </div>
              <ClockCircleOutlined class="dashboard-panel__icon" />
            </div>
            <div v-if="upcomingNodes.length" class="dashboard-upcoming-list">
              <button v-for="node in upcomingNodes" :key="`${node.projectId}-${node.nodeName}`" class="dashboard-upcoming-row" type="button" @click="openProject(node.projectId)">
                <span class="dashboard-upcoming-row__date">
                  <strong>{{ formatDate(node.endDate) }}</strong>
                  <small>{{ node.daysUntil === 0 ? $t('projectDashboard.today') : node.daysUntil === 1 ? $t('projectDashboard.tomorrow') : $t('projectDashboard.daysUntil', { days: node.daysUntil }) }}</small>
                </span>
                <span class="dashboard-upcoming-row__content"><strong>{{ node.nodeName }}</strong><small>{{ node.projectName }}</small></span>
                <span class="dashboard-upcoming-row__arrow">›</span>
              </button>
            </div>
            <a-empty v-else :description="$t('projectDashboard.noUpcomingNodes')" />
          </section>
        </div>

        <section class="dashboard-panel dashboard-projects pms-panel" aria-labelledby="dashboard-projects-title">
          <div class="dashboard-panel__header dashboard-projects__header">
            <div>
              <h2 id="dashboard-projects-title">{{ $t('projectDashboard.projectPortfolio') }}</h2>
              <p>{{ $t('projectDashboard.projectPortfolioHint') }}</p>
            </div>
            <span class="dashboard-project-count">{{ $t('projectDashboard.projectCount', { count: visibleProjects.length }) }}</span>
          </div>
          <div v-if="loading && loadingProgress.total" class="dashboard-load-progress" role="status">
            <a-progress :percent="Math.round(loadingProgress.completed / loadingProgress.total * 100)" size="small" :show-info="false" />
            <span>{{ progressLabel }}</span>
          </div>
          <a-table
            v-if="visibleProjects.length"
            class="dashboard-project-table"
            :columns="columns"
            :data-source="visibleProjects"
            :row-key="tableRowKey"
            :pagination="{ pageSize: 8, showSizeChanger: false, hideOnSinglePage: true }"
            :scroll="{ x: 1100 }"
            size="middle"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'project'">
                <button class="dashboard-project-link" type="button" @click="openProject(record.project.id)">
                  <strong>{{ record.project.name }}</strong>
                  <small>{{ record.project.code }}<template v-if="record.project.orgUnitName"> · {{ record.project.orgUnitName }}</template></small>
                </button>
              </template>
              <template v-else-if="column.key === 'health'">
                <div class="dashboard-project-health">
                  <a-tag :color="healthTagColor(record.health)">{{ $t(`projectDashboard.health.${record.health}`) }}</a-tag>
                  <small v-if="record.overdueNodeCount">{{ $t('projectDashboard.reasons.overdueNodes', { count: record.overdueNodeCount }) }}</small>
                  <small v-if="record.openRiskCounts.high">{{ $t('projectDashboard.reasons.highRisks', { count: record.openRiskCounts.high }) }}</small>
                  <small v-if="record.openRiskCounts.medium">{{ $t('projectDashboard.reasons.mediumRisks', { count: record.openRiskCounts.medium }) }}</small>
                  <small v-if="record.progressVariance != null && record.progressVariance <= -8">{{ $t('projectDashboard.reasons.progressBehind', { points: Math.abs(record.progressVariance) }) }}</small>
                  <small v-if="!record.overdueNodeCount && !record.openRiskCount && !(record.progressVariance != null && record.progressVariance <= -8) && record.health === 'HEALTHY'">{{ $t('projectDashboard.reasons.noMajorIssue') }}</small>
                  <small v-for="issue in record.dataIssues" :key="issue" class="dashboard-project-health__data-issue">{{ dataIssueLabel(issue) }}</small>
                </div>
              </template>
              <template v-else-if="column.key === 'node'">
                <span class="dashboard-project-node">
                  <strong>{{ record.project.currentNodeName || '—' }}</strong>
                  <small v-if="record.nextNode">{{ $t('projectDashboard.nextNodeDue', { name: record.nextNode.name, date: formatDate(record.nextNode.endDate) }) }}</small>
                </span>
              </template>
              <template v-else-if="column.key === 'progress'">
                <span class="dashboard-project-progress">
                  <span class="dashboard-project-progress__line"><i :style="{ width: `${record.actualProgress}%` }" /></span>
                  <strong>{{ record.actualProgress }}%</strong>
                  <small>{{ record.expectedProgress == null ? $t('projectDashboard.scheduleMissing') : $t('projectDashboard.plannedProgress', { progress: record.expectedProgress }) }}</small>
                </span>
              </template>
              <template v-else-if="column.key === 'manager'">
                <span class="dashboard-manager">{{ record.project.projectManagerName || '—' }}</span>
              </template>
              <template v-else-if="column.key === 'endDate'">
                <span class="dashboard-end-date">{{ formatDate(record.project.endDate) }}</span>
              </template>
            </template>
            <template #emptyText><a-empty :description="$t('projectDashboard.noProjects')" /></template>
          </a-table>
          <a-empty v-else-if="!loading" :description="$t('projectDashboard.noProjects')" />
        </section>
      </template>
    </a-spin>
  </div>
</template>

<style scoped>
.project-dashboard { min-width: 0; }
.dashboard-updated { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.dashboard-updated small { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.dashboard-alert { margin-bottom: 0; }
.dashboard-filters { display: grid; grid-template-columns: minmax(150px, 190px) minmax(180px, 240px) minmax(240px, 1fr) auto; align-items: end; gap: 12px; padding: 14px 16px; }
.dashboard-filter-group { display: flex; min-width: 0; flex-direction: column; gap: 6px; }
.dashboard-filter-group label { color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.dashboard-filter-control, .dashboard-filter-group :deep(.ant-input-affix-wrapper) { width: 100%; }
.dashboard-filter-active { grid-column: 1 / -1; display: flex; align-items: center; justify-content: flex-end; gap: 6px; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.dashboard-kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.dashboard-kpi { display: flex; min-width: 0; align-items: flex-start; gap: 12px; padding: 16px; color: inherit; text-align: left; cursor: pointer; transition: border-color var(--pms-motion-fast), background var(--pms-motion-fast), box-shadow var(--pms-motion-fast); }
.dashboard-kpi:hover, .dashboard-kpi.is-selected { border-color: var(--pms-primary); background: var(--pms-primary-soft); }
.dashboard-kpi:focus-visible, .dashboard-health-row:focus-visible, .dashboard-upcoming-row:focus-visible, .dashboard-project-link:focus-visible { outline: 0; box-shadow: var(--pms-focus-ring); }
.dashboard-kpi__icon { display: grid; width: 36px; height: 36px; flex: 0 0 36px; place-items: center; border-radius: 8px; background: var(--pms-primary-soft); color: var(--pms-primary); font-size: 16px; }
.dashboard-kpi__icon--warning { background: color-mix(in srgb, var(--pms-warning) 10%, white); color: var(--pms-warning); }
.dashboard-kpi__icon--danger { background: color-mix(in srgb, var(--pms-danger) 9%, white); color: var(--pms-danger); }
.dashboard-kpi__icon--green { background: color-mix(in srgb, var(--pms-success) 9%, white); color: var(--pms-success); }
.dashboard-kpi__body { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.dashboard-kpi__label { color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.dashboard-kpi__body strong { color: var(--pms-text); font-size: 25px; font-weight: 700; line-height: 1.2; }
.dashboard-kpi__body small { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.dashboard-analysis-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(340px, .9fr); gap: 14px; }
.dashboard-panel { min-width: 0; padding: 18px; }
.dashboard-panel__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.dashboard-panel__header h2 { margin: 0; color: var(--pms-text); font-size: var(--pms-font-size-section); font-weight: 650; }
.dashboard-panel__header p { margin: 4px 0 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.dashboard-health-rule { color: var(--pms-primary); font-size: var(--pms-font-size-compact); cursor: help; white-space: nowrap; }
.dashboard-panel__icon { color: var(--pms-text-faint); font-size: 17px; }
.dashboard-health-list { display: flex; flex-direction: column; gap: 13px; }
.dashboard-health-row { display: flex; width: 100%; flex-direction: column; gap: 7px; padding: 3px 2px; color: inherit; text-align: left; background: transparent; border: 0; cursor: pointer; }
.dashboard-health-row__top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.dashboard-health-row__name { display: inline-flex; align-items: center; gap: 8px; color: var(--pms-text); font-size: var(--pms-font-size-body); }
.dashboard-health-row__name i { width: 8px; height: 8px; border-radius: 50%; background: var(--pms-success); }
.dashboard-health-row--watch .dashboard-health-row__name i { background: var(--pms-warning); }
.dashboard-health-row--critical .dashboard-health-row__name i { background: var(--pms-danger); }
.dashboard-health-row__top > strong { color: var(--pms-text); font-size: var(--pms-font-size-section); font-weight: 650; }
.dashboard-health-row__top > strong small { margin-left: 4px; color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); font-weight: 400; }
.dashboard-health-meter { display: block; height: 7px; overflow: hidden; border-radius: 5px; background: var(--pms-surface-strong); }
.dashboard-health-meter i { display: block; height: 100%; border-radius: inherit; background: var(--pms-success); transition: width var(--pms-motion-fast); }
.dashboard-health-row--watch .dashboard-health-meter i { background: var(--pms-warning); }
.dashboard-health-row--critical .dashboard-health-meter i { background: var(--pms-danger); }
.dashboard-health-row.is-selected .dashboard-health-row__name { color: var(--pms-primary); font-weight: 650; }
.dashboard-health-footnote { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; margin-top: 14px; padding-top: 11px; border-top: 1px solid var(--pms-border); color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.dashboard-upcoming-list { display: flex; flex-direction: column; }
.dashboard-upcoming-row { display: grid; grid-template-columns: 90px minmax(0, 1fr) 18px; align-items: center; gap: 12px; min-width: 0; padding: 10px 4px; color: inherit; text-align: left; background: transparent; border: 0; border-bottom: 1px solid var(--pms-border); cursor: pointer; }
.dashboard-upcoming-row:last-child { border-bottom: 0; }
.dashboard-upcoming-row:hover { background: var(--pms-surface-muted); }
.dashboard-upcoming-row__date, .dashboard-upcoming-row__content { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.dashboard-upcoming-row__date strong { color: var(--pms-text); font-size: var(--pms-font-size-compact); font-weight: 600; }
.dashboard-upcoming-row__date small { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.dashboard-upcoming-row__content strong, .dashboard-upcoming-row__content small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dashboard-upcoming-row__content strong { color: var(--pms-text); font-size: var(--pms-font-size-compact); font-weight: 600; }
.dashboard-upcoming-row__content small { color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); }
.dashboard-upcoming-row__arrow { color: var(--pms-text-faint); font-size: 20px; }
.dashboard-projects { padding-bottom: 8px; }
.dashboard-projects__header { align-items: center; }
.dashboard-project-count { color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.dashboard-load-progress { display: flex; align-items: center; gap: 10px; margin: 0 0 10px; color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.dashboard-load-progress :deep(.ant-progress) { max-width: 160px; margin: 0; }
.dashboard-project-table :deep(.ant-table-thead > tr > th) { color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); font-weight: 600; white-space: nowrap; }
.dashboard-project-table :deep(.ant-table-tbody > tr > td) { vertical-align: middle; }
.dashboard-project-link { display: flex; min-width: 0; flex-direction: column; gap: 4px; padding: 0; color: inherit; text-align: left; background: transparent; border: 0; cursor: pointer; }
.dashboard-project-link strong { overflow: hidden; color: var(--pms-primary); text-overflow: ellipsis; white-space: nowrap; font-size: var(--pms-font-size-body); font-weight: 650; }
.dashboard-project-link:hover strong { text-decoration: underline; }
.dashboard-project-link small { overflow: hidden; color: var(--pms-text-faint); text-overflow: ellipsis; white-space: nowrap; font-size: var(--pms-font-size-caption); }
.dashboard-project-health { display: flex; min-width: 0; flex-direction: column; align-items: flex-start; gap: 4px; }
.dashboard-project-health :deep(.ant-tag) { margin: 0; }
.dashboard-project-health small { color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); line-height: 1.35; }
.dashboard-project-health .dashboard-project-health__data-issue { color: var(--pms-warning); }
.dashboard-project-node { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
.dashboard-project-node strong { overflow: hidden; color: var(--pms-text); text-overflow: ellipsis; white-space: nowrap; font-size: var(--pms-font-size-compact); font-weight: 550; }
.dashboard-project-node small { display: -webkit-box; overflow: hidden; color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.dashboard-project-progress { display: grid; grid-template-columns: minmax(48px, 1fr) auto; align-items: center; gap: 5px 8px; min-width: 108px; }
.dashboard-project-progress__line { display: block; height: 6px; overflow: hidden; border-radius: 4px; background: var(--pms-surface-strong); }
.dashboard-project-progress__line i { display: block; height: 100%; border-radius: inherit; background: var(--pms-primary); }
.dashboard-project-progress > strong { color: var(--pms-text); font-size: var(--pms-font-size-compact); font-weight: 600; }
.dashboard-project-progress > small { grid-column: 1 / -1; color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.dashboard-manager, .dashboard-end-date { color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }

@media (max-width: 1100px) {
  .dashboard-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dashboard-analysis-grid { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 720px) {
  .dashboard-updated { display: none; }
  .dashboard-filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dashboard-filter-group--search { grid-column: 1 / -1; }
  .dashboard-kpi-grid { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .dashboard-kpi { padding: 12px; }
  .dashboard-kpi__body { display: grid; grid-template-columns: 1fr auto; align-items: baseline; width: 100%; }
  .dashboard-kpi__body strong { grid-column: 2; grid-row: 1 / span 2; }
  .dashboard-panel { padding: 14px; }
  .dashboard-health-footnote { flex-direction: column; }
  .dashboard-panel__header { align-items: flex-start; }
}
</style>
