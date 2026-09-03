/**
 * Returns whether a granted permission satisfies a requested permission.
 *
 * Feedback is the only hierarchical permission family in V1: managing
 * feedback includes reading and submitting it, while submitting includes
 * reading the submitter's own tickets. All other permission families remain
 * exact-match so a broad grant cannot accidentally cross a module boundary.
 */
export function isPermissionSatisfied(requested: string, granted: string): boolean {
  if (!requested || !granted) return false
  if (requested === granted) return true
  if (requested === 'feedback:read') return granted === 'feedback:write' || granted === 'feedback:manage'
  if (requested === 'feedback:write') return granted === 'feedback:manage'
  return false
}
