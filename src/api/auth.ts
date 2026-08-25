import { http } from '/@/plugins/http'
import type { User } from '/@/types/domain'

export interface LoginResult {
  token: string
  user: User
}

export function login(username: string, password: string): Promise<LoginResult> {
  return http.post('/auth/login', { username, password })
}

export function getMe(): Promise<User> {
  return http.get('/auth/me')
}
