import type { User } from '/@/types/domain'
import { isPermissionSatisfied } from '/@/utils/permission'

export function canAccessAdminRoute(user: Pick<User, 'systemRole' | 'permissionCodes'> | null, permission: string): boolean {
  if (!user) return false
  return user.systemRole === 1 || !!user.permissionCodes?.some((granted) => isPermissionSatisfied(permission, granted))
}
