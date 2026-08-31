import { http } from '/@/plugins/http'
import type { User } from '/@/types/domain'

export function getFollowers(projectId: number | string): Promise<User[]> {
  return http.get(`/projects/${projectId}/followers`)
}
