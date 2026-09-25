import { resolveParentOrigin } from './dsh-auth-bridge'

export const DSH_CONTEXT_MESSAGE_SOURCE = 'pms'
export const DSH_CONTEXT_REQUEST_MESSAGE = 'pms.context.request'
export const PMS_CONTEXT_SYNC_MESSAGE = 'pms.context.sync'
export const DSH_CONTEXT_MESSAGE_VERSION = 1

export interface PmsRouteSnapshot {
  readonly path: string
  readonly fullPath: string
  readonly params?: Record<string, unknown>
  readonly query?: Record<string, unknown>
}

export interface PmsContextLocator {
  readonly pageType: string
  readonly route: string
  readonly projectId?: number
  readonly nodeId?: number
}

export interface DshContextBridgeController {
  sync(): void
  stop(): void
}

interface DshContextRequest {
  readonly source: typeof DSH_CONTEXT_MESSAGE_SOURCE
  readonly type: typeof DSH_CONTEXT_REQUEST_MESSAGE
  readonly version: typeof DSH_CONTEXT_MESSAGE_VERSION
}

export function createPmsContextLocator(route: PmsRouteSnapshot): PmsContextLocator {
  const path = normalizePathname(route.path)
  const projectId = readInteger(route.params?.id) ?? readProjectIdFromPath(path)
  const nodeId = readInteger(route.params?.nodeId) ?? readInteger(route.query?.nodeId)
  const pageType = projectId === undefined
    ? path === '/projects/dashboard' ? 'project-dashboard' : path === '/projects' ? 'project-list' : 'pms-page'
    : 'project-detail'
  return {
    pageType,
    route: route.fullPath || route.path || '/',
    ...(projectId === undefined ? {} : { projectId }),
    ...(nodeId === undefined ? {} : { nodeId }),
  }
}

export function installDshContextBridge(getRoute: () => PmsRouteSnapshot): DshContextBridgeController {
  const win = window
  const parentOrigin = resolveParentOrigin(document.referrer)
  if (!parentOrigin || win.parent === win) return { sync: () => undefined, stop: () => undefined }

  const sync = (): void => {
    win.parent.postMessage({
      source: DSH_CONTEXT_MESSAGE_SOURCE,
      type: PMS_CONTEXT_SYNC_MESSAGE,
      version: DSH_CONTEXT_MESSAGE_VERSION,
      context: createPmsContextLocator(getRoute()),
    }, parentOrigin)
  }
  const onMessage = (event: MessageEvent<unknown>): void => {
    if (event.source !== win.parent || event.origin !== parentOrigin || !isContextRequest(event.data)) return
    sync()
  }
  win.addEventListener('message', onMessage)
  sync()
  return {
    sync,
    stop: () => win.removeEventListener('message', onMessage),
  }
}

function isContextRequest(value: unknown): value is DshContextRequest {
  if (value === null || typeof value !== 'object') return false
  const message = value as Partial<DshContextRequest>
  return message.source === DSH_CONTEXT_MESSAGE_SOURCE
    && message.type === DSH_CONTEXT_REQUEST_MESSAGE
    && message.version === DSH_CONTEXT_MESSAGE_VERSION
}

function normalizePathname(value: string): string {
  if (value === '/') return value
  return value.replace(/\/+$/, '')
}

function readProjectIdFromPath(path: string): number | undefined {
  const match = path.match(/\/projects\/(\d+)$/)
  return match === null ? undefined : Number(match[1])
}

function readInteger(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  return undefined
}
