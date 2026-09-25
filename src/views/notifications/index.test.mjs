import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '../..')

test('notification center page exposes guarded filters and safe states', () => {
  const pagePath = path.join(root, 'views/notifications/index.vue')
  assert.equal(fs.existsSync(pagePath), true, 'notification center page should exist')
  const source = fs.readFileSync(pagePath, 'utf8')
  assert.match(source, /getNotificationPage/)
  assert.match(source, /getUnreadNotificationCount/)
  assert.match(source, /markAllNotificationsRead/)
  assert.match(source, /refreshUnreadCount/)
  assert.match(source, /notifyNotificationsChanged/)
  assert.doesNotMatch(source, /records\.value\.some\(\(item\) => !item\.readAt\)/)
  assert.match(source, /due-soon|TASK_DUE_SOON/)
  assert.match(source, /overdue|TASK_OVERDUE/)
  assert.match(source, /loading|Loading/)
  assert.match(source, /empty|Empty/)
  assert.match(source, /error|Error/)
  assert.match(source, /notificationRoute/)
  assert.match(source, /notificationTypeKey/)
  assert.doesNotMatch(source, /v-html/)
})

test('router and topbar expose the notification center entry', () => {
  const router = fs.readFileSync(path.join(root, 'router/index.ts'), 'utf8')
  const layout = fs.readFileSync(path.join(root, 'layout/Index.vue'), 'utf8')
  assert.match(router, /path:\s*'notifications'/)
  assert.match(router, /permission:\s*'project:read'/)
  assert.match(layout, /\/notifications/)
  assert.match(layout, /layout\.viewAllNotifications|查看全部|View all/)
})
