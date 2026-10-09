const SUPPORTED_DECISIONS = new Set(['YES', 'NO'])

export function readRequirementIntegrationDecision(eventOrValue) {
  const value = eventOrValue && typeof eventOrValue === 'object' && 'target' in eventOrValue
    ? eventOrValue.target?.value
    : eventOrValue
  return SUPPORTED_DECISIONS.has(value) ? value : undefined
}

export function applyRequirementIntegrationDecision(current, eventOrValue) {
  const decision = readRequirementIntegrationDecision(eventOrValue)
  if (!decision) return current

  return {
    ...current,
    shouldIntegrate: decision,
    requirementIds: decision === 'NO'
      ? []
      : Array.isArray(current?.requirementIds) ? [...current.requirementIds] : [],
  }
}
