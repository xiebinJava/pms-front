import { http } from '/@/plugins/http'
import type { PageResult } from '/@/types/api'
import type { NotificationType, UserNotification } from '/@/types/domain'

export interface NotificationPageParams {
  type?: Extract<NotificationType, 'TASK_DUE_SOON' | 'TASK_OVERDUE'>
  unreadOnly?: boolean
  currPage?: number
  pageSize?: number
}

export function getNotifications(limit = 20): Promise<UserNotification[]> {
  return http.get('/notifications', { params: { unreadFirst: true, limit } })
}

export function getNotificationPage(params: NotificationPageParams = {}): Promise<PageResult<UserNotification>> {
  return http.get('/notifications/page', { params })
}

export function getUnreadNotificationCount(): Promise<{ unreadCount: number }> {
  return http.get('/notifications/unread-count', { _silentError: true } as never)
}

export function markNotificationRead(id: number): Promise<void> {
  return http.post(`/notifications/${id}/read`)
}

export function markAllNotificationsRead(): Promise<void> {
  return http.post('/notifications/read-all')
}
