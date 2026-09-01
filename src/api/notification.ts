import { http } from '/@/plugins/http'
import type { UserNotification } from '/@/types/domain'

export function getNotifications(limit = 20): Promise<UserNotification[]> {
  return http.get('/notifications', { params: { unreadFirst: true, limit } })
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
