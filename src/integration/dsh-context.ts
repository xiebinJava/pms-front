export const PMS_CONTEXT_MESSAGE_SOURCE = 'pms'
export const PMS_CONTEXT_SYNC_MESSAGE = 'pms.context.sync'
export const PMS_CONTEXT_REQUEST_MESSAGE = 'pms.context.request'
export const PMS_CONTEXT_MESSAGE_VERSION = 1

export interface PmsContextLocator {
  pageType: string
  route: string
  projectId?: number
  nodeId?: number
  contextVersion?: string
}

export function parsePmsContextRequest(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false
  const message = value as Record<string, unknown>
  return message.source === PMS_CONTEXT_MESSAGE_SOURCE
    && message.type === PMS_CONTEXT_REQUEST_MESSAGE
    && message.version === PMS_CONTEXT_MESSAGE_VERSION
}

export function createPmsContextLocator(href: string): PmsContextLocator {
  const parsed = new URL(href, 'http://127.0.0.1')
  const pathname = normalizePathname(parsed.pathname)
  const route = `${parsed.pathname || '/'}${parsed.search}${parsed.hash}`
  const detailMatch = pathname.match(/^\/projects\/(\d+)$/)
  if (detailMatch) {
    const nodeId = queryInteger(parsed.searchParams.get('node'))
    return {
      pageType: 'project-detail',
      route,
      projectId: Number(detailMatch[1]),
      ...(nodeId === undefined ? {} : { nodeId }),
      contextVersion: 'v1',
    }
  }
  if (pathname === '/projects') return { pageType: 'project-list', route, contextVersion: 'v1' }
  if (pathname === '/projects/dashboard' || pathname === '/dashboard') {
    return { pageType: 'project-dashboard', route, contextVersion: 'v1' }
  }
  return { pageType: 'pms-workspace', route, contextVersion: 'v1' }
}

export function createPmsContextSyncMessage(locator: PmsContextLocator): Record<string, unknown> {
  return {
    source: PMS_CONTEXT_MESSAGE_SOURCE,
    type: PMS_CONTEXT_SYNC_MESSAGE,
    version: PMS_CONTEXT_MESSAGE_VERSION,
    context: locator,
  }
}

function queryInteger(value: string | null): number | undefined {
  if (value === null || value === '') return undefined
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) return undefined
  return parsed
}

function normalizePathname(value: string): string {
  if (value === '/') return value
  return value.replace(/\/+$/, '')
}
