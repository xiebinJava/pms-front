const BINDABLE = new Set(['PLANNED', 'DEVELOPING'])

export function applyIterationSystem(form, systemId) {
  if (form.systemId !== systemId) form.systemVersionId = undefined
  form.systemId = systemId
}

export function selectableIterationVersions(versions, systemId) {
  return systemId == null ? [] : versions.filter(version => version.systemId === systemId && BINDABLE.has(version.status))
}

export async function loadAllOptionPages(fetchPage) {
  const rows = []
  for (let page = 1; ; page++) {
    const result = await fetchPage(page)
    rows.push(...result.list)
    if (!result.list.length || rows.length >= result.total) return rows
  }
}
