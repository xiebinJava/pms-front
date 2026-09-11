import type { NotificationPageParams } from '/@/api/notification'
import type { NotificationType } from '/@/types/domain'

export type NotificationFilter = 'all' | 'unread' | 'due-soon' | 'overdue'

export function notificationQuery(
  filter: NotificationFilter,
  page: number,
  pageSize: number,
): NotificationPageParams {
  const base = { currPage: page, pageSize }
  if (filter === 'unread') return { unreadOnly: true, ...base }
  if (filter === 'due-soon') return { type: 'TASK_DUE_SOON', ...base }
  if (filter === 'overdue') return { type: 'TASK_OVERDUE', ...base }
  return base
}

export function notificationTypeKey(type: NotificationType | string): string {
  if (type === 'TASK_DUE_SOON') return 'notifications.types.dueSoon'
  if (type === 'TASK_OVERDUE') return 'notifications.types.overdue'
  return 'notifications.types.default'
}

export function notificationTypeClass(type: NotificationType | string): string {
  if (type === 'TASK_DUE_SOON') return 'pms-notification-type--due-soon'
  if (type === 'TASK_OVERDUE') return 'pms-notification-type--overdue'
  return 'pms-notification-type--default'
}
