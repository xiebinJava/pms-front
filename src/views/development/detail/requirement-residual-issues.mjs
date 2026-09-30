export function normalizeResidualIssues(value) {
  if (typeof value === 'string') return value.trim() ? [{ id: 'legacy', description: value }] : []
  if (!Array.isArray(value)) return []
  return value.filter((item) => item && typeof item.description === 'string').map((item, index) => ({
    id: typeof item.id === 'string' ? item.id : `existing-${index}`,
    description: item.description,
  }))
}
