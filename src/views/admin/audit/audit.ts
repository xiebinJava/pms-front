export interface AuditDiffRow {
  field: string
  before: string
  after: string
  changed: boolean
}

export function normalizeAuditQuery<T extends Record<string, unknown>>(query: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== '' && value !== undefined && value !== null),
  ) as Partial<T>
}

function parseSnapshot(value?: string): Record<string, unknown> {
  if (!value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : { value: parsed }
  } catch {
    return { value }
  }
}

function formatValue(value: unknown): string {
  if (value === undefined) return '—'
  if (typeof value === 'string') return value
  try { return JSON.stringify(value) } catch { return String(value) }
}

export function parseAuditDiff(beforeJson?: string, afterJson?: string): AuditDiffRow[] {
  const before = parseSnapshot(beforeJson)
  const after = parseSnapshot(afterJson)
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
  return fields.map(field => {
    const beforeValue = formatValue(before[field])
    const afterValue = formatValue(after[field])
    return { field, before: beforeValue, after: afterValue, changed: beforeValue !== afterValue }
  })
}
