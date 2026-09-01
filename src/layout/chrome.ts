import type { SearchHit, SearchResult, UserNotification } from '/@/types/domain'

export interface ChromeRoute {
  path: string
  query?: { task: string }
}

export function canSearch(query: string): boolean {
  return query.trim().length >= 2
}

export function firstSearchHit(result: SearchResult | null | undefined): SearchHit | null {
  if (!result) return null
  return result.projects[0] || result.tasks[0] || result.comments[0] || null
}

export function searchHitRoute(hit: SearchHit): ChromeRoute {
  if (hit.taskId) return { path: `/projects/${hit.projectId}`, query: { task: String(hit.taskId) } }
  return { path: `/projects/${hit.projectId}` }
}

export function notificationRoute(item: UserNotification): ChromeRoute | null {
  if (!item.projectId) return null
  if (item.taskId) return { path: `/projects/${item.projectId}`, query: { task: String(item.taskId) } }
  return { path: `/projects/${item.projectId}` }
}
