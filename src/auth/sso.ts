export const PUBLIC_AUTH_PATHS = ['/login', '/login/oidc/callback', '/auth/activate', '/auth/reset-password']
export const OIDC_REDIRECT_KEY = 'pms.oidc.redirect'

export interface AuthProvider {
  type: string
  enabled: boolean
  displayName?: string
  startPath?: string | null
}

export function isPublicAuthPath(path: string): boolean {
  return PUBLIC_AUTH_PATHS.includes(path)
}

export function localPasswordEnabled(providers: AuthProvider[] | null | undefined): boolean {
  const local = providers?.find((item) => item.type === 'local')
  return local ? local.enabled : true
}

export function ldapEnabled(providers: AuthProvider[] | null | undefined): boolean {
  return !!providers?.find((item) => item.type === 'ldap' && item.enabled)
}

export function oidcProvider(providers: AuthProvider[] | null | undefined): AuthProvider | null {
  return providers?.find((item) => item.type === 'oidc' && item.enabled) || null
}

export function rememberOidcRedirect(redirect?: string | null) {
  if (typeof sessionStorage === 'undefined') return
  if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
    sessionStorage.setItem(OIDC_REDIRECT_KEY, redirect)
  } else {
    sessionStorage.removeItem(OIDC_REDIRECT_KEY)
  }
}

export function consumeOidcRedirect(): string {
  if (typeof sessionStorage === 'undefined') return '/'
  const value = sessionStorage.getItem(OIDC_REDIRECT_KEY)
  sessionStorage.removeItem(OIDC_REDIRECT_KEY)
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

export function oidcCallbackParams(query: { code?: unknown; state?: unknown; error?: unknown }) {
  return {
    code: typeof query.code === 'string' ? query.code : '',
    state: typeof query.state === 'string' ? query.state : '',
    error: typeof query.error === 'string' ? query.error : '',
  }
}
