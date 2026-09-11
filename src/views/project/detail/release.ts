import type { NodeRelease } from '/@/types/domain'

type ReleaseCompletionInput = Partial<Pick<NodeRelease, 'releaseVersion' | 'releaseWindowStart' | 'releaseWindowEnd' | 'releaseType' | 'decisionResult' | 'handoverNotes' | 'observationItems' | 'emergencyContact'>>

export function isReleaseComplete(input: Partial<ReleaseCompletionInput>): boolean {
  return Boolean(
    input.releaseVersion?.trim()
      && input.releaseWindowStart
      && input.releaseWindowEnd
      && input.releaseType
      && input.decisionResult === 'APPROVED'
      && input.handoverNotes?.trim()
      && input.observationItems?.trim()
      && input.emergencyContact?.trim(),
  )
}
