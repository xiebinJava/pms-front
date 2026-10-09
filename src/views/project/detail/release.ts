import type { NodeRelease } from '/@/types/domain'

type ReleaseCompletionInput = Partial<Pick<NodeRelease, 'handoverOwnerId' | 'handoverNotes'>>

export type ReleaseWorkbenchStatus = 'draft' | 'ready' | 'completed' | 'terminated'

export function getReleaseWorkbenchStatus(input: {
  nodeStatus: number
  completionReady: boolean
}): ReleaseWorkbenchStatus {
  if (input.nodeStatus === 2) return 'completed'
  if (input.nodeStatus === 3) return 'terminated'
  return input.completionReady ? 'ready' : 'draft'
}

export function isReleaseComplete(input: Partial<ReleaseCompletionInput>): boolean {
  return Boolean(input.handoverOwnerId && input.handoverNotes?.trim())
}
