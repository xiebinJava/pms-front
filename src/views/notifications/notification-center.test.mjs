import assert from 'node:assert/strict'
import test from 'node:test'
import { notificationQuery, notificationTypeKey } from './notification-center.ts'

test('maps all notification-center filters to page API parameters', () => {
  assert.deepEqual(notificationQuery('all', 1, 20), { currPage: 1, pageSize: 20 })
  assert.deepEqual(notificationQuery('unread', 1, 20), { unreadOnly: true, currPage: 1, pageSize: 20 })
  assert.deepEqual(notificationQuery('due-soon', 2, 20), { type: 'TASK_DUE_SOON', currPage: 2, pageSize: 20 })
  assert.deepEqual(notificationQuery('overdue', 3, 20), { type: 'TASK_OVERDUE', currPage: 3, pageSize: 20 })
})

test('maps reminder types to locale keys without treating unknown types as overdue', () => {
  assert.equal(notificationTypeKey('TASK_DUE_SOON'), 'notifications.types.dueSoon')
  assert.equal(notificationTypeKey('TASK_OVERDUE'), 'notifications.types.overdue')
  assert.equal(notificationTypeKey('UNEXPECTED_TYPE'), 'notifications.types.default')
})
