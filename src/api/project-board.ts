import { http } from '/@/plugins/http'
import type { Project } from '/@/types/domain'

export type BoardPhase = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'TERMINATED' | 'UNKNOWN'
export type BoardHealth = 'HEALTHY' | 'WATCH' | 'CRITICAL' | 'UNKNOWN' | 'COMPLETED' | 'TERMINATED'

export interface BoardNodeSummary {
  id: number
  name: string
  endDate: string
}

export interface BoardStorySummary {
  total: number
  notStarted: number
  inProgress: number
  testing: number
  done: number
  blocked: number
  overdue: number
  points: number
  donePoints: number
}

export interface BoardAcceptanceSummary {
  total: number
  open: number
  resolved: number
}

export interface EnterpriseProjectBoardItem {
  project: Project
  phase: BoardPhase
  health: BoardHealth
  expectedProgress: number | null
  progressVariance: number | null
  overdueDays: number
  overdueNodeCount: number
  openRiskCount: number | null
  highRiskCount: number | null
  mediumRiskCount: number | null
  riskDataState: 'AVAILABLE' | 'NOT_CONFIGURED'
  nodeDataState: 'AVAILABLE' | 'NOT_CONFIGURED'
  dataIssues: string[]
  nextNode: BoardNodeSummary | null
  storySummary: BoardStorySummary | null
  acceptanceSummary: BoardAcceptanceSummary | null
}

export interface EnterpriseProjectBoard {
  asOfDate: string
  generatedAt: string
  allCompanyScope: boolean
  projects: EnterpriseProjectBoardItem[]
}

export function getEnterpriseProjectBoard(params: { orgUnitId?: number } = {}): Promise<EnterpriseProjectBoard> {
  return http.get('/projects/board', { params })
}
