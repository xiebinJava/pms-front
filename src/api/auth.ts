import { http } from '/@/plugins/http'
import type { User } from '/@/types/domain'

export interface LoginResult {
  token?: string
  accessToken: string
  refreshToken?: string
  user: User
}

export function login(username: string, password: string): Promise<LoginResult> {
  return http.post('/auth/login', { username, password })
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

export function requestPasswordReset(username: string) { return http.post<{ resetUrl: string; expiresAt: string }>('/auth/password-reset/request', { username }) }
export function confirmPasswordReset(token: string, password: string) { return http.post('/auth/password-reset/confirm', { token, password }) }
