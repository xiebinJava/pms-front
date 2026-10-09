export type RequirementIntegrationDecision = 'YES' | 'NO'

export function readRequirementIntegrationDecision(eventOrValue: unknown): RequirementIntegrationDecision | undefined

export function applyRequirementIntegrationDecision<T extends {
  shouldIntegrate?: RequirementIntegrationDecision
  requirementIds?: number[]
}>(current: T, eventOrValue: unknown): T & {
  shouldIntegrate: RequirementIntegrationDecision
  requirementIds: number[]
}
