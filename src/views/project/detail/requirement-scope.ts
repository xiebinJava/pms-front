export interface RequirementBaselineCheckItem {
  status?: number
  name?: string
  acceptanceCriteria?: string
}

export interface RequirementBaselineCheckInput {
  objective?: string
  deliverable?: string
  scopeItems?: Array<{ direction?: string; title?: string }>
  requirements?: RequirementBaselineCheckItem[]
}

export function isRequirementBaselineComplete(input: RequirementBaselineCheckInput): boolean {
  const objective = input.objective?.trim()
  const deliverable = input.deliverable?.trim()
  const scopeItems = input.scopeItems || []
  const requirements = input.requirements || []
  return Boolean(
    objective
      && deliverable
      && scopeItems.some((item) => item.direction === 'IN' && item.title?.trim())
      && requirements.length > 0
      && requirements.every((item) => item.status === 1 && item.name?.trim() && item.acceptanceCriteria?.trim()),
  )
}

export function nextRequirementCode(items: Array<{ code?: string }>): string {
  const used = new Set(items.map((item) => item.code?.trim()).filter(Boolean))
  for (let number = 1; number <= items.length + 1_000; number += 1) {
    const code = `REQ-${String(number).padStart(3, '0')}`
    if (!used.has(code)) return code
  }
  return `REQ-${String(items.length + 1).padStart(3, '0')}`
}

export function scopeItemCount(items: Array<{ direction?: string }>): { inScope: number; outScope: number } {
  return items.reduce((count, item) => {
    if (item.direction === 'IN') count.inScope += 1
    if (item.direction === 'OUT') count.outScope += 1
    return count
  }, { inScope: 0, outScope: 0 })
}
