import type { EnterpriseProjectBoardItem } from '/@/api/project-board'
import type { OrgUnit } from '/@/types/domain'

export interface BoardFilters {
  query?: string
  orgUnitId?: number | string | 'ALL'
  phase?: string | 'ALL'
  health?: string | 'ALL' | 'ATTENTION'
  level?: number | string | 'ALL'
}

export interface BoardSummary {
  total: number
  active: number
  attention: number
  critical: number
  overdueNodes: number
  highRisks: number | null
  phases: Record<string, number>
  health: Record<string, number>
  levels: Record<string, number>
  riskCovered: number
  riskIncomplete: number
  openRisks: number | null
  averageProgress: number | null
  fullyAssessed: number
}

export interface OverviewMetricCard {
  key: 'total' | 'notStarted' | 'inProgress' | 'completed'
  value: number
  filter: 'ALL' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  tone: 'blue' | 'neutral' | 'active' | 'success'
}

export type OrganizationPhase = 'IN_PROGRESS' | 'NOT_STARTED' | 'COMPLETED' | 'TERMINATED' | 'UNKNOWN'

export interface OrganizationComparisonGroup {
  id: number | null
  name: string
  total: number
  phases: Record<string, number>
  levels: Record<string, number>
}

export interface OrganizationColumnChartGroup extends OrganizationComparisonGroup {
  barHeightPercent: number
  segments: Array<{ phase: OrganizationPhase; count: number; sharePercent: number }>
}

export interface OrganizationColumnChart {
  axisMax: number
  ticks: number[]
  groups: OrganizationColumnChartGroup[]
}

export function filterBoardProjects(items: EnterpriseProjectBoardItem[], filters?: BoardFilters): EnterpriseProjectBoardItem[]
export function summarizeBoard(items: EnterpriseProjectBoardItem[]): BoardSummary
export function overviewMetricCards(summary: Pick<BoardSummary, 'total' | 'phases'>): OverviewMetricCard[]
export function workflowProgress(item: EnterpriseProjectBoardItem): number | null
export function buildOrgComparison(items: EnterpriseProjectBoardItem[], orgUnits?: OrgUnit[], selectedOrgId?: number | string | 'ALL'): OrganizationComparisonGroup[]
export function buildOrgColumnChart(groups: OrganizationComparisonGroup[]): OrganizationColumnChart
export function upcomingNodes(items: EnterpriseProjectBoardItem[], asOfDate: string, limit?: number): EnterpriseProjectBoardItem[]
export function percentage(part: number, total: number): number | null
