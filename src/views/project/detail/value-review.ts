import type { NodeValueReview, NodeValueReviewResultStatus } from '/@/types/domain'

export const valueReviewResultStatuses: NodeValueReviewResultStatus[] = ['ACHIEVED', 'PARTIAL', 'NOT_ACHIEVED']

export type ValueReviewResultStatus = typeof valueReviewResultStatuses[number]

type ValueReviewCompletionInput = Pick<NodeValueReview, 'resultStatus'>
  & Partial<Pick<NodeValueReview, 'actualResult' | 'retrospectiveConclusion'>>

export function isValueReviewComplete(input: Partial<ValueReviewCompletionInput>): boolean {
  return Boolean(
    input.resultStatus
      && input.resultStatus !== 'PENDING'
      && input.actualResult?.trim()
      && input.retrospectiveConclusion?.trim(),
  )
}
