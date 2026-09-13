import type { NodeRisk, Project, ProjectNode } from '/@/types/domain'

export type DashboardHealth = 'HEALTHY' | 'WATCH' | 'CRITICAL' | 'COMPLETED' | 'TERMINATED'
export type DashboardDataState = 'AVAILABLE' | 'NOT_CONFIGURED' | 'UNAVAILABLE'

export interface ProjectHealthAssessment {
  project: Project
  health: DashboardHealth
  expectedProgress: number | null
  actualProgress: number
  progressVariance: number | null
  overdueNodeCount: number
  openRiskCounts: { high: number; medium: number; low: number }
  openRiskCount: number
  riskDataState: DashboardDataState
  nodeDataState: DashboardDataState
  dataIssues: string[]
  nextNode: Pick<ProjectNode, 'id' | 'name' | 'endDate'> | null
}

export interface PortfolioSummary {
  activeProjectCount: number
  healthyProjectCount: number
  watchProjectCount: number
  criticalProjectCount: number
  overdueNodeCount: number
  openRiskCount: number
  averageProgress: number
}

export function expectedProjectProgress(project: Pick<Project, 'startDate' | 'endDate'>, today: string): number | null

export function assessProjectHealth(
  project: Project,
  nodes?: ProjectNode[],
  risks?: NodeRisk[],
  options?: { today?: string; nodeDataState?: DashboardDataState; riskDataState?: DashboardDataState },
): ProjectHealthAssessment

export function buildPortfolioSummary(items: ProjectHealthAssessment[]): PortfolioSummary

export function filterDashboardProjects(
  items: ProjectHealthAssessment[],
  filters?: { query?: string; orgUnitId?: number | string | 'ALL'; health?: DashboardHealth | 'ATTENTION' | 'ALL'; status?: 'ACTIVE' | 'COMPLETED' | 'TERMINATED' | 'ALL' },
): ProjectHealthAssessment[]
