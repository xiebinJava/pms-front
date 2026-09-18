export type ActionCenterFilter = 'ALL' | 'OVERDUE' | 'TODAY' | 'PROJECT' | 'SOON'

export function filterActionItems<T extends { type?: string }>(items: T[], filter?: ActionCenterFilter): T[]
export function emptyActionState(
  filter: ActionCenterFilter,
  context?: { totalCount?: number; hasAssignedTasks?: boolean },
): 'NO_TASKS' | 'NO_PROJECT_ISSUES' | 'NO_TIME_ACTIONS'
