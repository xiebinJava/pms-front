import type { Router } from 'vue-router'
import { getAccessToken, http } from '/@/plugins/http'
import {
  createPmsAuthSyncMessage,
  isTrustedParentOrigin,
  parentOriginFromReferrer,
  parseDshAuthRequest,
  type DshAuthRequest,
  type DshAuthorizationCode,
} from './dsh-auth'
import { createPmsContextLocator, createPmsContextSyncMessage, parsePmsContextRequest } from './dsh-context'
import { parsePmsRefreshRequest, shouldReloadForRefresh } from './dsh-refresh'

function issueDshAuthorizationCode(request: Omit<DshAuthRequest, 'requestId'>): Promise<DshAuthorizationCode> {
  return http.post<DshAuthorizationCode>(
    '/integration/dsh/v1/authorization-codes',
    {
      dshSessionId: request.dshSessionId,
      agentId: request.agentId,
      scopes: request.scopes,
    },
    { _silentError: true } as never,
  ).then((data) => ({
    authorizationCode: data.authorizationCode,
    expiresInSeconds: data.expiresInSeconds,
    agentId: request.agentId,
    scopes: data.scopes,
  }))
}

export function startPmsDshBridges(router: Router): () => void {
  const postToParent = (data: Record<string, unknown>, origin: string) => {
    if (window.parent === window || origin === '') return
    window.parent.postMessage(data, origin)
  }

  const currentHref = () => `${window.location.pathname}${window.location.search}${window.location.hash}`

  const syncContext = (origin: string) => {
    postToParent(createPmsContextSyncMessage(createPmsContextLocator(currentHref())), origin)
  }

  const onMessage = (event: MessageEvent<unknown>) => {
    if (event.source !== window.parent) return
    const parentOrigin = parentOriginFromReferrer(document.referrer)
    if (!isTrustedParentOrigin(event.origin, parentOrigin)) return

    if (parsePmsContextRequest(event.data)) {
      syncContext(event.origin)
      return
    }

    const refresh = parsePmsRefreshRequest(event.data)
    if (refresh) {
      if (shouldReloadForRefresh(refresh.scopes)) router.go(0)
      return
    }

    const authRequest = parseDshAuthRequest(event.data)
    if (!authRequest || !getAccessToken()) return
    void issueDshAuthorizationCode(authRequest)
      .then((payload) => {
        if (!payload.authorizationCode) return
        postToParent(createPmsAuthSyncMessage(authRequest.requestId, payload), event.origin)
      })
      .catch(() => undefined)
  }

  window.addEventListener('message', onMessage)
  const stopRouteSync = router.afterEach(() => {
    const parentOrigin = parentOriginFromReferrer(document.referrer)
    if (parentOrigin) syncContext(parentOrigin)
  })
  const parentOrigin = parentOriginFromReferrer(document.referrer)
  if (parentOrigin) syncContext(parentOrigin)

  return () => {
    window.removeEventListener('message', onMessage)
    stopRouteSync()
  }
}
