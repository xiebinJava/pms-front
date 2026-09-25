<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { BarChartOutlined, CalendarOutlined, CheckCircleOutlined, CloseOutlined, InfoCircleOutlined, ReloadOutlined, RightOutlined, WarningOutlined } from '@ant-design/icons-vue'
import { getEnterpriseProjectBoard, type BoardHealth, type BoardPhase, type EnterpriseProjectBoard, type EnterpriseProjectBoardItem } from '/@/api/project-board'
import { getProjectOrgTree } from '/@/api/admin-org'
import { apiErrorMessage } from '/@/plugins/http'
import type { OrgUnit } from '/@/types/domain'
import { formatDate, formatDateTime } from '/@/utils/format'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
import { buildOrgColumnChart, buildOrgComparison, filterBoardProjects, overviewMetricCards, percentage, summarizeBoard, upcomingNodes, workflowProgress } from './enterprise-board.mjs'
import './enterprise-board.css'

type PhaseFilter = BoardPhase | 'ALL'
type HealthFilter = Extract<BoardHealth, 'HEALTHY' | 'WATCH' | 'CRITICAL' | 'UNKNOWN'> | 'ALL' | 'ATTENTION'
type LevelFilter = 'ALL' | '3' | '2' | '1' | '0' | 'UNKNOWN'
interface OrgTreeOption { title: string; value: number | 'ALL'; key: string; children?: OrgTreeOption[] }

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const board = ref<EnterpriseProjectBoard | null>(null)
const orgTree = ref<OrgUnit[]>([])
const orgTreeReady = ref(false)
const orgTreeUnavailable = ref(false)
const loadedOrgUnitId = ref<number | 'ALL'>('ALL')
const loading = ref(true)
const refreshing = ref(false)
const stale = ref(false)
const loadError = ref('')
const methodologyOpen = ref(false)
const selectedProject = ref<EnterpriseProjectBoardItem | null>(null)
const page = ref(1)
const pageSize = 10
const filters = reactive<{ orgUnitId: number | 'ALL'; phase: PhaseFilter; health: HealthFilter; level: LevelFilter; query: string }>({
  orgUnitId: 'ALL', phase: 'ALL', health: 'ALL', level: 'ALL', query: '',
})
let loadGeneration = 0
let mounted = false

function orgOptions(units: OrgUnit[], ancestors: string[] = []): OrgTreeOption[] {
  return units.filter(unit => unit.status === 'ACTIVE').map((unit) => {
    const path = [...ancestors, unit.name]
    const children = orgOptions(unit.children || [], path)
    return { title: path.join(' / '), value: unit.id, key: String(unit.id), ...(children.length ? { children } : {}) }
  })
}

const organizationOptions = computed<OrgTreeOption[]>(() => [{
  title: t('enterpriseBoard.filters.allOrganizations'), value: 'ALL', key: 'ALL', children: orgOptions(orgTree.value),
}])
const visibleProjects = computed(() => filterBoardProjects(board.value?.projects || [], {
  phase: filters.phase, health: filters.health, level: filters.level, query: filters.query,
}))
const summary = computed(() => summarizeBoard(visibleProjects.value))
const orgComparison = computed(() => buildOrgComparison(visibleProjects.value, orgTree.value, filters.orgUnitId))
const orgColumnChart = computed(() => buildOrgColumnChart(orgComparison.value))
const nearNodes = computed(() => upcomingNodes(visibleProjects.value, board.value?.asOfDate || ''))
const lastPage = computed(() => Math.max(1, Math.ceil(visibleProjects.value.length / pageSize)))
const pageProjects = computed(() => visibleProjects.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const attentionProjects = computed(() => visibleProjects.value.filter((item) => (
  (item.phase === 'NOT_STARTED' || item.phase === 'IN_PROGRESS' || item.phase === 'UNKNOWN')
  && (item.health === 'CRITICAL' || item.health === 'WATCH' || item.health === 'UNKNOWN')
)).slice(0, 4))
const hasFilters = computed(() => filters.orgUnitId !== 'ALL' || filters.phase !== 'ALL' || filters.health !== 'ALL' || filters.level !== 'ALL' || Boolean(filters.query.trim()))
const overviewCards = computed(() => overviewMetricCards(summary.value).map(card => ({
  ...card,
  label: t(`enterpriseBoard.metrics.${card.key}`),
})))
const healthItems = computed(() => [
  { key: 'CRITICAL', count: summary.value.health.CRITICAL, tone: 'danger' },
  { key: 'WATCH', count: summary.value.health.WATCH, tone: 'warning' },
  { key: 'HEALTHY', count: summary.value.health.HEALTHY, tone: 'success' },
  { key: 'UNKNOWN', count: summary.value.health.UNKNOWN, tone: 'neutral' },
])
const levelItems = computed(() => [3, 2, 1, 0, 'UNKNOWN'].map((level) => ({
  key: String(level), label: t(`enterpriseBoard.levels.${level}`), count: summary.value.levels[level] || 0,
  percent: percentage(summary.value.levels[level] || 0, summary.value.total),
})))
const activeFilterLabels = computed(() => {
  const result: string[] = []
  if (filters.orgUnitId !== 'ALL') {
    const findName = (units: OrgUnit[]): string => {
      for (const unit of units) {
        if (unit.id === filters.orgUnitId) return unit.name
        const child = findName(unit.children || [])
        if (child) return child
      }
      return ''
    }
    result.push(findName(orgTree.value) || t('enterpriseBoard.filters.organization'))
  }
  if (filters.phase !== 'ALL') result.push(t(`enterpriseBoard.phases.${filters.phase}`))
  if (filters.health !== 'ALL') result.push(t(`enterpriseBoard.health.${filters.health}`))
  if (filters.level !== 'ALL') result.push(t(`enterpriseBoard.levels.${filters.level}`))
  if (filters.query.trim()) result.push(filters.query.trim())
  return result
})
const scopeLabel = computed(() => filters.orgUnitId !== 'ALL'
  ? t('enterpriseBoard.filteredScope')
  : board.value?.allCompanyScope ? t('enterpriseBoard.fullCompany') : t('enterpriseBoard.currentScope'))
const ringStyle = computed(() => {
  const total = summary.value.active
  if (!total) return { background: 'var(--pms-surface-strong)' }
  const colors = [['CRITICAL', 'var(--pms-danger)'], ['WATCH', 'var(--pms-warning)'], ['HEALTHY', 'var(--pms-success)'], ['UNKNOWN', 'var(--pms-text-faint)']] as const
  let start = 0
  const stops = colors.map(([key, color]) => {
    const end = start + (summary.value.health[key] / total) * 100
    const segment = `${color} ${start.toFixed(2)}% ${end.toFixed(2)}%`
    start = end
    return segment
  })
  return { background: `conic-gradient(${stops.join(', ')})` }
})

function queryFromRoute() {
  const query = route.query
  const phaseValues: PhaseFilter[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'TERMINATED', 'UNKNOWN']
  const healthValues: HealthFilter[] = ['HEALTHY', 'WATCH', 'CRITICAL', 'UNKNOWN', 'ATTENTION']
  const levelValues: LevelFilter[] = ['3', '2', '1', '0', 'UNKNOWN']
  return {
    orgUnitId: typeof query.orgUnitId === 'string' && /^\d+$/.test(query.orgUnitId) ? Number(query.orgUnitId) : 'ALL',
    phase: typeof query.phase === 'string' && phaseValues.includes(query.phase as PhaseFilter) ? query.phase as PhaseFilter : 'ALL',
    health: typeof query.health === 'string' && healthValues.includes(query.health as HealthFilter) ? query.health as HealthFilter : 'ALL',
    level: typeof query.level === 'string' && levelValues.includes(query.level as LevelFilter) ? query.level as LevelFilter : 'ALL',
    query: typeof query.q === 'string' ? query.q.slice(0, 120) : '',
  }
}

function syncQuery() {
  const query: Record<string, string> = {}
  if (filters.orgUnitId !== 'ALL') query.orgUnitId = String(filters.orgUnitId)
  if (filters.phase !== 'ALL') query.phase = filters.phase
  if (filters.health !== 'ALL') query.health = filters.health
  if (filters.level !== 'ALL') query.level = filters.level
  if (filters.query.trim()) query.q = filters.query.trim()
  const current = Object.fromEntries(Object.entries(route.query).filter(([, value]) => typeof value === 'string'))
  if (JSON.stringify(current) !== JSON.stringify(query)) router.replace({ name: 'project-dashboard', query }).catch(() => {})
}

async function loadData() {
  const generation = ++loadGeneration
  const requestedOrg = filters.orgUnitId
  if (loadedOrgUnitId.value !== requestedOrg) board.value = null
  loading.value = !board.value
  refreshing.value = Boolean(board.value)
  loadError.value = ''
  stale.value = false
  const orgPromise = orgTreeReady.value ? Promise.resolve(orgTree.value) : getProjectOrgTree()
  const [boardResult, orgResult] = await Promise.allSettled([
    getEnterpriseProjectBoard({ orgUnitId: requestedOrg === 'ALL' ? undefined : requestedOrg }), orgPromise,
  ])
  if (generation !== loadGeneration) return
  loading.value = false
  refreshing.value = false
  if (orgResult.status === 'fulfilled') {
    orgTree.value = orgResult.value
    orgTreeReady.value = true
    orgTreeUnavailable.value = false
  } else if (!orgTreeReady.value) {
    orgTreeUnavailable.value = true
  }
  if (boardResult.status === 'rejected') {
    loadError.value = apiErrorMessage(boardResult.reason, t('enterpriseBoard.loadFailed'))
    if (board.value) stale.value = true
    return
  }
  board.value = boardResult.value
  loadedOrgUnitId.value = requestedOrg
}

function setPhase(value: string) { filters.phase = filters.phase === value ? 'ALL' : value as PhaseFilter }
function setHealth(value: string) { filters.health = filters.health === value ? 'ALL' : value as HealthFilter }
function setLevel(value: string) { filters.level = filters.level === value ? 'ALL' : value as LevelFilter }
function resetFilters() {
  filters.orgUnitId = 'ALL'; filters.phase = 'ALL'; filters.health = 'ALL'; filters.level = 'ALL'; filters.query = ''
}
function healthTone(health: string) {
  if (health === 'CRITICAL') return 'danger'
  if (health === 'WATCH') return 'warning'
  if (health === 'HEALTHY' || health === 'COMPLETED') return 'success'
  if (health === 'TERMINATED') return 'neutral'
  return 'neutral'
}
function phaseTone(phase: string) {
  if (phase === 'IN_PROGRESS') return 'active'
  if (phase === 'COMPLETED') return 'success'
  if (phase === 'TERMINATED') return 'danger'
  return 'neutral'
}
function progressText(value?: number | null) {
  return Number.isFinite(value) ? `${Math.min(100, Math.max(0, Number(value)))}%` : '—'
}
function nodeProgressText(item: EnterpriseProjectBoardItem) {
  return progressText(workflowProgress(item))
}
function dateOffset(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !board.value?.asOfDate) return null
  return Math.round((Date.parse(`${value}T00:00:00Z`) - Date.parse(`${board.value.asOfDate}T00:00:00Z`)) / 86_400_000)
}
function nodeDateLabel(item: EnterpriseProjectBoardItem) {
  const date = item.nextNode?.endDate
  if (!date) return ''
  const offset = dateOffset(date)
  if (offset == null) return formatDate(date)
  if (offset < 0) return t('enterpriseBoard.overdueDays', { days: -offset })
  if (offset === 0) return t('enterpriseBoard.today')
  return t('enterpriseBoard.dueInDays', { days: offset })
}
function healthSignals(item: EnterpriseProjectBoardItem) {
  const signals: string[] = []
  if (item.overdueNodeCount) signals.push(t('enterpriseBoard.overdueNode', { count: item.overdueNodeCount }))
  if (item.overdueDays) signals.push(t('enterpriseBoard.overdueProject', { days: item.overdueDays }))
  if (item.highRiskCount) signals.push(t('enterpriseBoard.risk', { count: item.highRiskCount }))
  if (item.mediumRiskCount) signals.push(t('enterpriseBoard.mediumRisk', { count: item.mediumRiskCount }))
  if (item.progressVariance != null && item.progressVariance <= -8) signals.push(t('enterpriseBoard.scheduleLag', { value: Math.abs(item.progressVariance) }))
  return signals.slice(0, 3)
}
function healthSignalLabel(item: EnterpriseProjectBoardItem) {
  const signal = healthSignals(item)[0]
  if (signal) return signal
  const issue = item.dataIssues?.[0]
  return issue ? t(`enterpriseBoard.issues.${issue}`) : ''
}
function orgBarLabel(group: { name: string; total: number; phases: Record<string, number> }) {
  const phases = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'TERMINATED', 'UNKNOWN']
  return `${group.name}，${t('enterpriseBoard.metrics.total')} ${group.total}，${phases.map(phase => `${t(`enterpriseBoard.phases.${phase}`)} ${group.phases[phase] || 0}`).join('，')}`
}
function openProject(item: EnterpriseProjectBoardItem) {
  router.push({ name: 'project-detail', params: { id: item.project.id } })
}
function openOrg(id: number | null) {
  if (id == null) return
  filters.orgUnitId = id
}

watch(() => filters.orgUnitId, (value, previous) => {
  page.value = 1
  if (mounted && value !== previous) void loadData()
}, { flush: 'sync' })
watch(filters, () => { page.value = 1; if (mounted) syncQuery() }, { deep: true })
watch(lastPage, total => { if (page.value > total) page.value = total })

onMounted(() => {
  Object.assign(filters, queryFromRoute())
  mounted = true
  void loadData()
})
onBeforeUnmount(() => {
  loadGeneration += 1
})
</script>

<template>
  <div class="enterprise-board pms-page-stack">
    <PmsPageHeader :title="t('enterpriseBoard.title')" :description="t('enterpriseBoard.subtitle')">
      <template #actions>
        <span class="enterprise-board__scope"><CheckCircleOutlined />{{ scopeLabel }}</span>
        <span v-if="board" class="enterprise-board__updated">{{ t('enterpriseBoard.updatedAt', { time: formatDateTime(board.generatedAt) }) }}</span>
        <a-button :disabled="refreshing" @click="loadData"><ReloadOutlined :spin="refreshing" />{{ refreshing ? t('enterpriseBoard.refreshing') : t('enterpriseBoard.refresh') }}</a-button>
        <a-button @click="methodologyOpen = true"><InfoCircleOutlined />{{ t('enterpriseBoard.methodology') }}</a-button>
      </template>
    </PmsPageHeader>

    <div v-if="stale" class="enterprise-board__stale" role="status"><WarningOutlined />{{ t('enterpriseBoard.staleData') }}</div>
    <section class="enterprise-board__filters pms-panel" :aria-label="t('enterpriseBoard.filters.title')">
      <div class="enterprise-board__filter-heading">
        <div><h2>{{ t('enterpriseBoard.filters.title') }}</h2><span>{{ t('enterpriseBoard.filters.organizationHint') }}</span></div>
        <button v-if="hasFilters" class="enterprise-board__clear" type="button" @click="resetFilters"><CloseOutlined />{{ t('enterpriseBoard.filters.clear') }}</button>
      </div>
      <div class="enterprise-board__filter-controls">
        <a-tree-select v-model:value="filters.orgUnitId" class="enterprise-board__org-select" :tree-data="organizationOptions" :disabled="orgTreeUnavailable" :show-search="true" :filter-tree-node="(input: string, node: OrgTreeOption) => node.title.toLowerCase().includes(input.toLowerCase())" :placeholder="t('enterpriseBoard.filters.organization')" :aria-label="t('enterpriseBoard.filters.organization')" />
        <a-select v-model:value="filters.phase" class="enterprise-board__filter-select" :aria-label="t('enterpriseBoard.filters.phase')">
          <a-select-option value="ALL">{{ t('enterpriseBoard.filters.allPhases') }}</a-select-option>
          <a-select-option v-for="phase in ['NOT_STARTED','IN_PROGRESS','COMPLETED','TERMINATED','UNKNOWN']" :key="phase" :value="phase">{{ t(`enterpriseBoard.phases.${phase}`) }}</a-select-option>
        </a-select>
        <a-select v-model:value="filters.level" class="enterprise-board__filter-select" :aria-label="t('enterpriseBoard.filters.level')">
          <a-select-option value="ALL">{{ t('enterpriseBoard.filters.allLevels') }}</a-select-option>
          <a-select-option v-for="level in ['3','2','1','0','UNKNOWN']" :key="level" :value="level">{{ t(`enterpriseBoard.levels.${level}`) }}</a-select-option>
        </a-select>
        <a-select v-model:value="filters.health" class="enterprise-board__filter-select" :aria-label="t('enterpriseBoard.filters.health')">
          <a-select-option value="ALL">{{ t('enterpriseBoard.filters.allHealth') }}</a-select-option>
          <a-select-option value="ATTENTION">{{ t('enterpriseBoard.health.ATTENTION') }}</a-select-option>
          <a-select-option v-for="health in ['CRITICAL','WATCH','HEALTHY','UNKNOWN']" :key="health" :value="health">{{ t(`enterpriseBoard.health.${health}`) }}</a-select-option>
        </a-select>
        <a-input v-model:value="filters.query" class="pms-filter-control" allow-clear :placeholder="t('enterpriseBoard.filters.search')" :aria-label="t('enterpriseBoard.filters.search')" />
      </div>
      <div v-if="orgTreeUnavailable" class="enterprise-board__org-warning" role="status"><WarningOutlined /><span>{{ t('enterpriseBoard.orgUnavailable') }}</span><a-button size="small" @click="loadData">{{ t('common.retry') }}</a-button></div>
      <div v-if="activeFilterLabels.length" class="enterprise-board__filter-tags" aria-live="polite"><span>{{ t('enterpriseBoard.filters.active') }}:</span><a-tag v-for="label in activeFilterLabels" :key="label">{{ label }}</a-tag></div>
    </section>

    <div v-if="loading && !board" class="enterprise-board__loading pms-panel" role="status"><a-spin /><span>{{ t('projectDashboard.loading') }}</span></div>
    <div v-else-if="loadError && !board" class="enterprise-board__error pms-panel" role="alert"><WarningOutlined /><span>{{ loadError || t('enterpriseBoard.loadFailed') }}</span><a-button type="primary" @click="loadData">{{ t('common.retry') }}</a-button></div>

    <template v-else-if="board">
      <section class="enterprise-board__kpis" :aria-label="t('enterpriseBoard.title')">
        <button v-for="card in overviewCards" :key="card.key" class="enterprise-board__kpi pms-panel" :class="[`enterprise-board__kpi--${card.tone}`, { 'is-active': card.filter === 'ALL' ? filters.phase === 'ALL' : filters.phase === card.filter }]" type="button" :aria-pressed="card.filter === 'ALL' ? filters.phase === 'ALL' : filters.phase === card.filter" @click="setPhase(card.filter)">
          <span class="enterprise-board__kpi-label">{{ card.label }}</span><strong>{{ card.value }}</strong><span class="enterprise-board__kpi-mark" aria-hidden="true"></span>
        </button>
      </section>
      <div class="enterprise-board__kpi-secondary-row">
        <button type="button" class="enterprise-board__kpi-secondary" :class="{ 'is-active': filters.phase === 'TERMINATED' }" :aria-pressed="filters.phase === 'TERMINATED'" @click="setPhase('TERMINATED')">
          <span>{{ t('enterpriseBoard.metrics.terminated') }}</span><strong>{{ summary.phases.TERMINATED }}</strong>
        </button>
      </div>

      <section class="enterprise-board__analysis-grid">
        <article class="enterprise-board__panel pms-panel enterprise-board__health-panel">
          <header class="enterprise-board__panel-header"><div><h2>{{ t('enterpriseBoard.healthSection') }}</h2><p>{{ t('enterpriseBoard.healthDescription') }}</p></div><BarChartOutlined class="enterprise-board__panel-icon" /></header>
          <div class="enterprise-board__health-content">
            <div class="enterprise-board__health-ring" :style="ringStyle" role="img" :aria-label="`${t('enterpriseBoard.metrics.active')}: ${summary.active}`"><div><strong>{{ summary.active }}</strong><span>{{ t('enterpriseBoard.metrics.active') }}</span></div></div>
            <div class="enterprise-board__health-legend">
              <button v-for="item in healthItems" :key="item.key" type="button" :class="['enterprise-board__legend-row', `tone-${item.tone}`, { 'is-active': filters.health === item.key }]" :aria-pressed="filters.health === item.key" @click="setHealth(item.key)"><span class="enterprise-board__legend-dot"></span><span>{{ t(`enterpriseBoard.health.${item.key}`) }}</span><strong>{{ item.count }}</strong></button>
              <div class="enterprise-board__coverage"><span>{{ t('enterpriseBoard.metrics.coverage') }}</span><strong>{{ summary.active ? `${summary.fullyAssessed} / ${summary.active}` : '—' }}</strong></div>
              <div v-if="summary.riskIncomplete" class="enterprise-board__coverage"><span>{{ t('enterpriseBoard.metrics.riskCoverage') }}</span><strong>{{ summary.riskCovered }} / {{ summary.active }}</strong></div>
              <div v-if="summary.riskCovered" class="enterprise-board__coverage"><span>{{ t('enterpriseBoard.metrics.highRisks') }}</span><strong>{{ summary.highRisks }}</strong></div>
            </div>
          </div>
          <p v-if="!summary.active" class="enterprise-board__panel-empty">{{ t('enterpriseBoard.healthEmpty') }}</p>
        </article>

        <article class="enterprise-board__panel pms-panel enterprise-board__level-panel">
          <header class="enterprise-board__panel-header"><div><h2>{{ t('enterpriseBoard.levelSection') }}</h2><p>{{ t('enterpriseBoard.levelDescription') }}</p></div><span class="enterprise-board__panel-total">{{ summary.total }}</span></header>
          <div class="enterprise-board__level-list"><button v-for="item in levelItems" :key="item.key" type="button" class="enterprise-board__level-row" :class="{ 'is-active': filters.level === item.key }" :aria-pressed="filters.level === item.key" @click="setLevel(item.key)"><span class="enterprise-board__level-name">{{ item.label }}</span><span class="enterprise-board__bar"><i :style="{ width: `${item.percent ?? 0}%` }"></i></span><strong>{{ item.count }}</strong><small>{{ item.percent == null ? '—' : `${item.percent}%` }}</small></button></div>
          <div class="enterprise-board__average"><span>{{ t('enterpriseBoard.metrics.averageProgress') }}</span><strong>{{ progressText(summary.averageProgress) }}</strong></div>
        </article>
      </section>

      <section class="enterprise-board__analysis-grid enterprise-board__analysis-grid--lower">
        <article class="enterprise-board__panel pms-panel enterprise-board__org-panel">
          <header class="enterprise-board__panel-header"><div><h2>{{ t('enterpriseBoard.orgSection') }}</h2><p>{{ t('enterpriseBoard.orgDescription') }}</p></div></header>
          <div v-if="orgColumnChart.groups.length" class="enterprise-board__org-chart">
            <div class="enterprise-board__org-chart-axis" aria-hidden="true">
              <span v-for="tick in orgColumnChart.ticks" :key="tick" class="enterprise-board__org-chart-axis-tick">{{ tick }}</span>
            </div>
            <div class="enterprise-board__org-chart-scroll">
              <div class="enterprise-board__org-chart-canvas" :style="{ minWidth: `${Math.max(orgColumnChart.groups.length * 76, 280)}px` }">
                <div class="enterprise-board__org-chart-grid" aria-hidden="true"><span v-for="tick in orgColumnChart.ticks" :key="tick"></span></div>
                <div class="enterprise-board__org-chart-columns">
                  <button
                    v-for="group in orgColumnChart.groups"
                    :key="`${group.id ?? 'unassigned'}-${group.name}`"
                    type="button"
                    class="enterprise-board__org-column"
                    :style="{ '--org-column-height': `${group.barHeightPercent}%` }"
                    :aria-label="orgBarLabel(group)"
                    :disabled="group.id == null"
                    :title="orgBarLabel(group)"
                    @click="group.id != null && openOrg(group.id)"
                  >
                    <span class="enterprise-board__org-column-plot">
                      <strong class="enterprise-board__org-column-total">{{ group.total }}</strong>
                      <span class="enterprise-board__org-column-stack">
                        <span v-for="segment in group.segments" :key="segment.phase" class="enterprise-board__org-column-segment" :class="`phase-${segment.phase.toLowerCase()}`" :style="{ height: `${segment.sharePercent}%` }" :title="`${t(`enterpriseBoard.phases.${segment.phase}`)}: ${segment.count}`"></span>
                      </span>
                    </span>
                    <span class="enterprise-board__org-column-label" :title="group.name">{{ group.name }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div v-if="orgColumnChart.groups.length" class="enterprise-board__org-legend"><span v-for="phase in ['IN_PROGRESS','NOT_STARTED','COMPLETED','TERMINATED','UNKNOWN']" :key="phase" :class="`phase-${phase.toLowerCase()}`"><i></i>{{ t(`enterpriseBoard.phases.${phase}`) }}</span></div>
          <p v-else class="enterprise-board__panel-empty">{{ t('enterpriseBoard.noOrgData') }}</p>
        </article>

        <article class="enterprise-board__panel pms-panel enterprise-board__upcoming-panel">
          <header class="enterprise-board__panel-header"><div><h2>{{ t('enterpriseBoard.upcomingSection') }}</h2><p>{{ t('enterpriseBoard.upcomingDescription') }}</p></div><CalendarOutlined class="enterprise-board__panel-icon" /></header>
          <div v-if="nearNodes.length" class="enterprise-board__upcoming-list"><button v-for="item in nearNodes" :key="`${item.project.id}-${item.nextNode?.id}`" type="button" class="enterprise-board__upcoming-row" @click="openProject(item)"><span class="enterprise-board__upcoming-date"><strong>{{ item.nextNode?.endDate ? formatDate(item.nextNode.endDate) : '—' }}</strong><small>{{ nodeDateLabel(item) }}</small></span><span class="enterprise-board__upcoming-copy"><strong>{{ item.nextNode?.name }}</strong><small>{{ item.project.name }}</small></span><RightOutlined /></button></div>
          <p v-else class="enterprise-board__panel-empty">{{ t('enterpriseBoard.noUpcoming') }}</p>
        </article>
      </section>

      <section class="enterprise-board__panel pms-panel enterprise-board__attention-panel">
        <header class="enterprise-board__panel-header"><div><h2><WarningOutlined />{{ t('enterpriseBoard.attentionSection') }}</h2><p>{{ t('enterpriseBoard.attentionDescription') }}</p></div><span class="enterprise-board__attention-total">{{ t('enterpriseBoard.attentionCount', { count: summary.attention }) }}</span></header>
        <div v-if="attentionProjects.length" class="enterprise-board__attention-list"><button v-for="item in attentionProjects" :key="item.project.id" type="button" class="enterprise-board__attention-row" @click="openProject(item)"><span :class="['enterprise-board__status-dot', `tone-${healthTone(item.health)}`]"></span><span class="enterprise-board__attention-name"><strong>{{ item.project.name }}</strong><small>{{ item.project.orgUnitName || t('enterpriseBoard.levels.UNKNOWN') }} · {{ t(`enterpriseBoard.levels.${item.project.projectLevel ?? 'UNKNOWN'}`) }}</small></span><span :class="['enterprise-board__status-tag', `tone-${healthTone(item.health)}`]">{{ t(`enterpriseBoard.health.${item.health}`) }}</span><span class="enterprise-board__attention-signal">{{ healthSignals(item).join(' · ') || (item.dataIssues?.[0] ? t(`enterpriseBoard.issues.${item.dataIssues[0]}`) : t('enterpriseBoard.healthAssessmentPending')) }}</span><RightOutlined /></button></div>
        <p v-else class="enterprise-board__panel-empty">{{ t('enterpriseBoard.noResults') }}</p>
      </section>

      <section class="enterprise-board__panel pms-panel enterprise-board__projects">
        <header class="enterprise-board__panel-header"><div><h2>{{ t('enterpriseBoard.projectSection') }}</h2><p>{{ t('enterpriseBoard.projectCount', { visible: visibleProjects.length, total: board.projects.length }) }}</p></div><span>{{ t('enterpriseBoard.updatedAt', { time: formatDateTime(board.generatedAt) }) }}</span></header>
        <div v-if="pageProjects.length" class="enterprise-board__table-scroll" role="region" tabindex="0" :aria-label="t('enterpriseBoard.projectSection')">
          <table class="enterprise-board__table"><thead><tr><th>{{ t('enterpriseBoard.table.project') }}</th><th>{{ t('enterpriseBoard.table.organization') }}</th><th>{{ t('enterpriseBoard.table.level') }}</th><th>{{ t('enterpriseBoard.table.manager') }}</th><th>{{ t('enterpriseBoard.table.phase') }}</th><th>{{ t('enterpriseBoard.table.progress') }}</th><th>{{ t('enterpriseBoard.table.health') }}</th><th>{{ t('enterpriseBoard.table.dueDate') }}</th></tr></thead>
            <tbody><tr v-for="item in pageProjects" :key="item.project.id">
              <td><div class="enterprise-board__project-actions"><button class="enterprise-board__project-link" type="button" @click="openProject(item)"><strong>{{ item.project.name }}</strong><small>{{ item.project.code }}</small></button><button class="enterprise-board__analysis-action" type="button" :aria-label="t('enterpriseBoard.openAnalysis', { project: item.project.name })" :title="t('enterpriseBoard.openAnalysis', { project: item.project.name })" @click="selectedProject = item"><BarChartOutlined /></button></div></td>
              <td>{{ item.project.orgUnitName || '—' }}</td><td>{{ t(`enterpriseBoard.levels.${item.project.projectLevel ?? 'UNKNOWN'}`) }}</td><td>{{ item.project.projectManagerName || '—' }}</td>
              <td><span :class="['enterprise-board__status-tag', `tone-${phaseTone(item.phase)}`]">{{ t(`enterpriseBoard.phases.${item.phase}`) }}</span><small v-if="item.project.currentNodeName" class="enterprise-board__node-name">{{ item.project.currentNodeName }}</small></td>
              <td><span class="enterprise-board__progress"><i><b :style="{ width: nodeProgressText(item) }"></b></i><strong>{{ nodeProgressText(item) }}</strong></span></td>
              <td><span :class="['enterprise-board__status-tag', `tone-${healthTone(item.health)}`]">{{ t(`enterpriseBoard.health.${item.health}`) }}</span><small v-if="healthSignalLabel(item)" class="enterprise-board__node-name">{{ healthSignalLabel(item) }}</small><small v-if="item.project.attentionSummary && (item.project.attentionSummary.criticalCount || item.project.attentionSummary.warningCount)" class="enterprise-board__node-name enterprise-board__attention-summary">{{ item.project.attentionSummary.criticalCount ? t('project.attentionCriticalCount', { count: item.project.attentionSummary.criticalCount }) : '' }}<template v-if="item.project.attentionSummary.criticalCount && item.project.attentionSummary.warningCount"> · </template>{{ item.project.attentionSummary.warningCount ? t('project.attentionWarningCount', { count: item.project.attentionSummary.warningCount }) : '' }}</small></td>
              <td>{{ item.project.endDate ? formatDate(item.project.endDate) : '—' }}</td>
            </tr></tbody>
          </table>
        </div>
        <div v-else class="enterprise-board__empty"><BarChartOutlined /><strong>{{ t('enterpriseBoard.noProjects') }}</strong><button v-if="hasFilters" type="button" @click="resetFilters">{{ t('enterpriseBoard.filters.clear') }}</button></div>
        <footer v-if="visibleProjects.length" class="enterprise-board__pagination"><span>{{ t('enterpriseBoard.page', { current: page, total: lastPage }) }}</span><div><a-button size="small" :disabled="page <= 1" @click="page -= 1">{{ t('enterpriseBoard.previous') }}</a-button><a-button size="small" :disabled="page >= lastPage" @click="page += 1">{{ t('enterpriseBoard.next') }}</a-button></div></footer>
      </section>
    </template>

    <a-drawer :open="Boolean(selectedProject)" :title="t('enterpriseBoard.projectAnalysis')" placement="right" :width="460" @close="selectedProject = null">
      <template v-if="selectedProject">
        <div class="enterprise-board__drawer-project"><div><span>{{ selectedProject.project.code }}</span><h2>{{ selectedProject.project.name }}</h2></div><span :class="['enterprise-board__status-tag', `tone-${healthTone(selectedProject.health)}`]">{{ t(`enterpriseBoard.health.${selectedProject.health}`) }}</span></div>
        <div class="enterprise-board__drawer-grid"><div><span>{{ t('enterpriseBoard.table.phase') }}</span><strong>{{ t(`enterpriseBoard.phases.${selectedProject.phase}`) }}</strong></div><div><span>{{ t('enterpriseBoard.table.progress') }}</span><strong>{{ nodeProgressText(selectedProject) }}</strong></div><div><span>{{ t('enterpriseBoard.table.manager') }}</span><strong>{{ selectedProject.project.projectManagerName || '—' }}</strong></div><div><span>{{ t('enterpriseBoard.table.dueDate') }}</span><strong>{{ selectedProject.project.endDate ? formatDate(selectedProject.project.endDate) : '—' }}</strong></div></div>
        <section class="enterprise-board__drawer-section"><h3>{{ t('enterpriseBoard.healthSection') }}</h3><p v-for="signal in healthSignals(selectedProject)" :key="signal">{{ signal }}</p><p v-for="issue in selectedProject.dataIssues" :key="issue">{{ t(`enterpriseBoard.issues.${issue}`) }}</p><p v-if="!healthSignals(selectedProject).length && !selectedProject.dataIssues.length">{{ t('enterpriseBoard.healthRule') }}</p></section>
        <section class="enterprise-board__drawer-section"><h3>{{ t('enterpriseBoard.metrics.riskCoverage') }}</h3><template v-if="selectedProject.riskDataState === 'AVAILABLE'"><p>{{ selectedProject.openRiskCount == null ? '—' : t('enterpriseBoard.risk', { count: selectedProject.openRiskCount }) }}</p><p>{{ t('enterpriseBoard.metrics.highRisks') }}：{{ selectedProject.highRiskCount ?? '—' }}</p><p>{{ t('enterpriseBoard.metrics.mediumRisks') }}：{{ selectedProject.mediumRiskCount ?? '—' }}</p></template><p v-else>{{ t('enterpriseBoard.notConfigured') }}</p></section>
        <section class="enterprise-board__drawer-section"><h3>{{ t('enterpriseBoard.storySummary') }}</h3><template v-if="selectedProject.storySummary"><p>{{ t('enterpriseBoard.storyTotal', { count: selectedProject.storySummary.total }) }}</p><p>{{ t('enterpriseBoard.storyStates', selectedProject.storySummary) }}</p><p>{{ t('enterpriseBoard.storyPoints', { done: selectedProject.storySummary.donePoints, total: selectedProject.storySummary.points }) }}</p><p>{{ t('enterpriseBoard.overdueStories', { count: selectedProject.storySummary.overdue }) }}</p></template><p v-else>{{ t('enterpriseBoard.notConfigured') }}</p></section>
        <section class="enterprise-board__drawer-section"><h3>{{ t('enterpriseBoard.acceptanceSummary') }}</h3><template v-if="selectedProject.acceptanceSummary"><p>{{ t('enterpriseBoard.acceptanceBreakdown', selectedProject.acceptanceSummary) }}</p></template><p v-else>{{ t('enterpriseBoard.notConfigured') }}</p></section>
        <a-button type="primary" block @click="openProject(selectedProject)">{{ t('enterpriseBoard.detail') }}<RightOutlined /></a-button>
      </template>
    </a-drawer>

    <a-drawer :open="methodologyOpen" :title="t('enterpriseBoard.methodologyTitle')" placement="right" :width="460" @close="methodologyOpen = false">
      <section class="enterprise-board__drawer-section"><h3>{{ t('enterpriseBoard.availableTitle') }}</h3><p>{{ t('enterpriseBoard.availableItems') }}</p></section>
      <section class="enterprise-board__drawer-section"><h3>{{ t('enterpriseBoard.pendingTitle') }}</h3><p>{{ t('enterpriseBoard.pendingItems') }}</p><ul><li>{{ t('enterpriseBoard.rejectedPending') }}</li><li>{{ t('enterpriseBoard.waitingAgingPending') }}</li><li>{{ t('enterpriseBoard.ratingPending') }}</li><li>{{ t('enterpriseBoard.productionIncidentPending') }}</li><li>{{ t('enterpriseBoard.capacityPending') }}</li><li>{{ t('enterpriseBoard.trendPending') }}</li></ul></section>
      <section class="enterprise-board__drawer-section"><h3>{{ t('enterpriseBoard.sourceTitle') }}</h3><p>{{ t('enterpriseBoard.lifecycleRule') }}</p><p>{{ t('enterpriseBoard.progressRule') }}</p><p>{{ t('enterpriseBoard.healthRule') }}</p><p>{{ t('enterpriseBoard.permissionRule') }}</p></section>
    </a-drawer>
  </div>
</template>
