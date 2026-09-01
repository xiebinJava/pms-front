import { http } from '/@/plugins/http'
import type { User } from '/@/types/domain'

export interface LoginResult {
  token?: string
  accessToken: string
  refreshToken?: string
  user: User
}

export interface AuthProvider {
  type: string
  enabled: boolean
  displayName?: string
  startPath?: string | null
}

export interface OidcStart {
  authorizationUrl: string
  state: string
}

export function login(email: string, password: string): Promise<LoginResult> {
  return http.post('/auth/login', { email, password })
}

export function listAuthProviders(): Promise<AuthProvider[]> {
  return http.get('/auth/providers', { _silentError: true } as never)
}

export function startOidc(): Promise<OidcStart> {
  return http.get('/auth/oidc/start')
}

export function loginOidc(code: string, state: string): Promise<LoginResult> {
  return http.post('/auth/oidc/callback', { code, state })
}

export function loginLdap(email: string, password: string): Promise<LoginResult> {
  return http.post('/auth/ldap/login', { email, password })
}

export function getMe(): Promise<User> {
  return http.get('/auth/me')
}

export function activate(token: string, password: string) {
  return http.post('/auth/activate', { token, password })
}

export function refreshSession(): Promise<LoginResult> {
  return http.post('/auth/refresh')
}
export function logout() { return http.post('/auth/logout') }
export function changePassword(currentPassword: string, newPassword: string) {
  return http.post('/auth/password/change', { currentPassword, newPassword })
}

export function requestPasswordReset(email: string) { return http.post<{ resetUrl: string; expiresAt: string }>('/auth/password-reset/request', { email }) }
export function confirmPasswordReset(token: string, password: string) { return http.post('/auth/password-reset/confirm', { token, password }) }
