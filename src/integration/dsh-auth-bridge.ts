import {
  DSH_AUTH_AGENT_ID,
  DSH_AUTH_SCOPES,
  requestDshAuthorizationCode,
  type DshAuthorizationCodeRequest,
} from '/@/api/dsh-auth'

export const DSH_AUTH_MESSAGE_SOURCE = 'dsh'
export const PMS_AUTH_MESSAGE_SOURCE = 'pms'
export const DSH_AUTH_REQUEST_MESSAGE = 'pms.dsh.auth.request'
export const PMS_AUTH_SYNC_MESSAGE = 'pms.dsh.auth.sync'
export const DSH_AUTH_MESSAGE_VERSION = 1

type DshAuthRequestMessage = DshAuthorizationCodeRequest & {
  source: typeof DSH_AUTH_MESSAGE_SOURCE
  type: typeof DSH_AUTH_REQUEST_MESSAGE
  version: number
  requestId: string
}

export function resolveParentOrigin(referrer: string, ancestorOrigin = ''): string {
  for (const candidate of [referrer, ancestorOrigin]) {
    if (!candidate) continue
    try {
      return new URL(candidate).origin
    } catch {
      // Try the next browser-provided source of the embedding origin.
    }
  }
  return ''
}

function isValidRequest(value: unknown): value is DshAuthRequestMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Partial<DshAuthRequestMessage>
  return message.source === DSH_AUTH_MESSAGE_SOURCE
    && message.type === DSH_AUTH_REQUEST_MESSAGE
    && message.version === DSH_AUTH_MESSAGE_VERSION
    && typeof message.requestId === 'string'
    && message.requestId.length > 0
    && typeof message.dshSessionId === 'string'
    && message.dshSessionId.length > 0
    && message.dshSessionId.length <= 128
}

export function installDshAuthBridge(): () => void {
  const win = window
  const parentOrigin = resolveParentOrigin(document.referrer, window.location.ancestorOrigins?.[0] || '')
  if (!parentOrigin || win.parent === win) return () => undefined

  const onMessage = (event: MessageEvent<unknown>) => {
    if (event.source !== win.parent) return
    if (event.origin !== parentOrigin) return
    if (!isValidRequest(event.data)) return

    const request = event.data
    void requestDshAuthorizationCode({
      dshSessionId: request.dshSessionId,
      agentId: request.agentId || DSH_AUTH_AGENT_ID,
      scopes: request.scopes?.length ? request.scopes : [...DSH_AUTH_SCOPES],
    }).then((response) => {
      win.parent.postMessage({
        source: PMS_AUTH_MESSAGE_SOURCE,
        type: PMS_AUTH_SYNC_MESSAGE,
        version: DSH_AUTH_MESSAGE_VERSION,
        requestId: request.requestId,
        authorizationCode: response.authorizationCode,
        expiresInSeconds: response.expiresInSeconds,
        agentId: request.agentId || DSH_AUTH_AGENT_ID,
        scopes: response.scopes,
      }, parentOrigin)
    }).catch(() => {
      win.parent.postMessage({
        source: PMS_AUTH_MESSAGE_SOURCE,
        type: PMS_AUTH_SYNC_MESSAGE,
        version: DSH_AUTH_MESSAGE_VERSION,
        requestId: request.requestId,
        error: 'PMS_DSH_AUTH_UNAVAILABLE',
      }, parentOrigin)
    })
  }

  win.addEventListener('message', onMessage)
  return () => win.removeEventListener('message', onMessage)
}
