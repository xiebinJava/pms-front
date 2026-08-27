import type { User } from '/@/types/domain'

export function canAccessAdminRoute(user: Pick<User, 'systemRole' | 'permissionCodes'> | null, permission: string): boolean {
  if (!user) return false
  return user.systemRole === 1 || !!user.permissionCodes?.includes(permission)
}
