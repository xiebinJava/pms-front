import { http } from '/@/plugins/http'
import type { SearchResult } from '/@/types/domain'

export function searchWorkspace(q: string, limit = 8): Promise<SearchResult> {
  return http.get('/search', { params: { q, limit } })
}
