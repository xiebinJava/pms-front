import type { SearchHit, SearchResult, UserNotification } from '/@/types/domain'

export const NOTIFICATIONS_CHANGED_EVENT = 'pms:notifications-changed'

export function notifyNotificationsChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT))
}

export interface ChromeRoute {
  path: string
  query?: { task?: string; node?: string; milestone?: string }
}

export function canSearch(query: string): boolean {
  return query.trim().length >= 2
}

export function firstSearchHit(result: SearchResult | null | undefined): SearchHit | null {
  if (!result) return null
  return result.projects[0] || result.tasks[0] || result.milestones?.[0] || result.comments[0] || null
}

export function searchHitRoute(hit: SearchHit): ChromeRoute {
  if (hit.taskId) return { path: `/projects/${hit.projectId}`, query: { task: String(hit.taskId) } }
  if (hit.milestoneId) return { path: `/projects/${hit.projectId}`, query: { milestone: String(hit.milestoneId) } }
  return { path: `/projects/${hit.projectId}` }
}

export function notificationRoute(item: UserNotification): ChromeRoute | null {
  if (!item.projectId) return null
  if (item.taskId) return { path: `/projects/${item.projectId}`, query: { task: String(item.taskId) } }
  if (item.nodeId) return { path: `/projects/${item.projectId}`, query: { node: String(item.nodeId) } }
  return { path: `/projects/${item.projectId}` }
}
