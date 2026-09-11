import type {
  NodePlanResourceRisk,
  NodeIterationPlan,
  NodeResource,
  NodeRisk,
} from '/@/types/domain'

export interface PlanResourceRiskCompletionInput {
  iterationPlans?: Array<Partial<NodeIterationPlan>>
  resources: Array<Partial<NodeResource>>
  risks: Array<Partial<NodeRisk>>
}

export function splitRoleNames(roles?: string): string[] {
  return (roles || '')
    .split(/[、,，;/；]+/)
    .map((role) => role.trim())
    .filter(Boolean)
}

export function isPlanResourceRiskDraftValid(input: PlanResourceRiskCompletionInput): boolean {
  return (input.iterationPlans || []).every((item) => Boolean(item.name?.trim()))
    && input.resources.every((item) => Boolean(item.role?.trim()))
    && input.risks.every((item) => Boolean(item.title?.trim()))
}

export function isPlanResourceRiskEditable(input: {
  canEdit: boolean
  nodeReadOnly: boolean
  stateCanEdit: boolean
  loading: boolean
  confirming: boolean
}): boolean {
  return input.canEdit && !input.nodeReadOnly && input.stateCanEdit && !input.loading && !input.confirming
}

function applySavedRowIds<T extends { id?: number }>(current: T[], saved?: T[]) {
  saved?.forEach((row, index) => {
    const item = current[index]
    if (item && row.id != null) item.id = row.id
  })
}

export function mergePlanResourceRiskSaveResult(
  current: NodePlanResourceRisk,
  saved: NodePlanResourceRisk,
): NodePlanResourceRisk {
  applySavedRowIds(current.iterationPlans, saved.iterationPlans)
  applySavedRowIds(current.resources, saved.resources)
  applySavedRowIds(current.risks, saved.risks)
  return {
    ...current,
    version: saved.version,
    baselineStatus: saved.baselineStatus,
    confirmedBy: saved.confirmedBy,
    confirmedByName: saved.confirmedByName,
    confirmedAt: saved.confirmedAt,
    sourceDecisionVersion: saved.sourceDecisionVersion,
    sourceDecisionChanged: saved.sourceDecisionChanged,
    canEdit: saved.canEdit,
    iterationPlans: current.iterationPlans,
    resources: current.resources,
    risks: current.risks,
  }
}

export function isPlanResourceRiskComplete(input: PlanResourceRiskCompletionInput): boolean {
  if (!(input.iterationPlans || []).length || (input.iterationPlans || []).some((item) => !item.name?.trim()
    || !item.ownerId || !item.startDate || !item.dueDate)) return false
  if (!input.resources.length || input.resources.some((item) => !item.role?.trim() || !item.ownerId || !item.focus?.trim())) return false
  return input.risks.length > 0 && input.risks.every((item) => Boolean(item.title?.trim() && item.ownerId && item.response?.trim()))
}
