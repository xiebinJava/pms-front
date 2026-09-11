import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

function canAccessAdminRoute(user, permission) {
  return !!user && (user.systemRole === 1 || user.permissionCodes?.includes(permission))
}

test('organization manager can enter org page but not role page', () => {
  const user = { permissionCodes: ['admin:org:read'] }
  assert.equal(canAccessAdminRoute(user, 'admin:org:read'), true)
  assert.equal(canAccessAdminRoute(user, 'admin:role:read'), false)
})

test('feedback manager can enter the feedback read route through permission implication', () => {
  const source = fs.readFileSync(path.join(import.meta.dirname, 'admin-guard.ts'), 'utf8')
  const permissions = fs.readFileSync(path.join(import.meta.dirname, '../utils/permission.ts'), 'utf8')
  assert.match(source, /isPermissionSatisfied/)
  assert.match(permissions, /feedback:read/)
  assert.match(permissions, /feedback:manage/)
})
