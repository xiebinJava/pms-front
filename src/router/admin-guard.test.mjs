import test from 'node:test'
import assert from 'node:assert/strict'

function canAccessAdminRoute(user, permission) {
  return !!user && (user.systemRole === 1 || user.permissionCodes?.includes(permission))
}

test('organization manager can enter org page but not role page', () => {
  const user = { permissionCodes: ['admin:org:read'] }
  assert.equal(canAccessAdminRoute(user, 'admin:org:read'), true)
  assert.equal(canAccessAdminRoute(user, 'admin:role:read'), false)
})
