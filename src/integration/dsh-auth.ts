export const DSH_AUTH_MESSAGE_SOURCE = 'dsh'
export const PMS_AUTH_MESSAGE_SOURCE = 'pms'
export const DSH_AUTH_REQUEST_MESSAGE = 'pms.dsh.auth.request'
export const PMS_AUTH_SYNC_MESSAGE = 'pms.dsh.auth.sync'
export const DSH_AUTH_MESSAGE_VERSION = 1

export interface DshAuthRequest {
  requestId: string
  dshSessionId: string
  agentId: string
  scopes: string[]
}

export interface DshAuthorizationCode {
  authorizationCode: string
  expiresInSeconds: number
  agentId: string
  scopes: string[]
}

export function parentOriginFromReferrer(referrer: string | undefined | null): string {
  if (!referrer) return ''
  try {
    return new URL(referrer).origin
  } catch {
    return ''
  }
}

export function parseDshAuthRequest(value: unknown): DshAuthRequest | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const message = value as Record<string, unknown>
  if (message.source !== DSH_AUTH_MESSAGE_SOURCE
    || message.type !== DSH_AUTH_REQUEST_MESSAGE
    || message.version !== DSH_AUTH_MESSAGE_VERSION) return undefined
  if (typeof message.requestId !== 'string' || message.requestId.trim() === '' || message.requestId.length > 128) {
    return undefined
  }
  if (typeof message.dshSessionId !== 'string' || message.dshSessionId.trim() === '' || message.dshSessionId.length > 128) {
    return undefined
  }
  if (typeof message.agentId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/u.test(message.agentId)) return undefined
  if (!Array.isArray(message.scopes) || message.scopes.length === 0 || message.scopes.length > 32) return undefined
  const scopes = message.scopes.filter((scope): scope is string =>
    typeof scope === 'string' && scope.trim() !== '' && scope.length <= 128)
  if (scopes.length !== message.scopes.length) return undefined
  return {
    requestId: message.requestId,
    dshSessionId: message.dshSessionId.trim(),
    agentId: message.agentId,
    scopes,
  }
}

export function isTrustedParentOrigin(eventOrigin: string, parentOrigin: string): boolean {
  return parentOrigin !== '' && eventOrigin === parentOrigin
}

export function createPmsAuthSyncMessage(requestId: string, payload: DshAuthorizationCode): Record<string, unknown> {
  return {
    source: PMS_AUTH_MESSAGE_SOURCE,
    type: PMS_AUTH_SYNC_MESSAGE,
    version: DSH_AUTH_MESSAGE_VERSION,
    requestId,
    authorizationCode: payload.authorizationCode,
    expiresInSeconds: payload.expiresInSeconds,
    agentId: payload.agentId,
    scopes: [...payload.scopes],
  }
}
