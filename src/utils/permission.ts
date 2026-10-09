/**
 * Returns whether a granted permission satisfies a requested permission.
 *
 * Feedback and system-version permissions are hierarchical: managing a module
 * includes its write and read access, while writing includes reading it. Other
 * permission families remain exact-match so a broad grant cannot accidentally
 * cross a module boundary.
 */
export function isPermissionSatisfied(requested: string, granted: string): boolean {
  if (!requested || !granted) return false
  if (requested === granted) return true
  if (requested === 'feedback:read') return granted === 'feedback:write' || granted === 'feedback:manage'
  if (requested === 'feedback:write') return granted === 'feedback:manage'
  if (requested === 'system-version:read') return granted === 'system-version:write' || granted === 'system-version:manage'
  if (requested === 'system-version:write') return granted === 'system-version:manage'
  return false
}
