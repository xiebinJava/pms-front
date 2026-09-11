import { http } from '/@/plugins/http'
import type { User } from '/@/types/domain'

export function searchUsers(keyword?: string): Promise<User[]> {
  return http.get('/users/search', { params: { keyword } })
}
