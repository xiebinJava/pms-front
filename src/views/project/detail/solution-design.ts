import type {
  NodeRequirementBaselineSummary,
  NodeSolutionDecision,
  NodeSolutionPackage,
  NodeSolutionReview,
  NodeSolutionReviewType,
} from '/@/types/domain'

export const solutionReviewTypes: NodeSolutionReviewType[] = [
  'BUSINESS_PRODUCT',
  'TECHNICAL',
  'TEST_RELEASE',
]

export function isSolutionPackageComplete(pkg: Partial<NodeSolutionPackage>): boolean {
  return [pkg.productSolution, pkg.technicalSolution].every((value) => Boolean(value?.trim()))
}

export function canSubmitSolutionPackage(
  editable: boolean,
  pkg: Partial<NodeSolutionPackage>,
  baseline?: Pick<NodeRequirementBaselineSummary, 'confirmed'>,
): boolean {
  return editable && baseline?.confirmed === true && isSolutionPackageComplete(pkg)
}

export function allSolutionReviewsPassed(reviews: Pick<NodeSolutionReview, 'reviewType' | 'status'>[]): boolean {
  return solutionReviewTypes.every((reviewType) => reviews.some(
    (review) => review.reviewType === reviewType && review.status === 'PASSED',
  ))
}

export function allSolutionReviewsReady(
  reviews: Pick<NodeSolutionReview, 'reviewType' | 'status' | 'reviewerId'>[],
): boolean {
  return solutionReviewTypes.every((reviewType) => reviews.some(
    (review) => review.reviewType === reviewType && review.status === 'PASSED' && review.reviewerId != null,
  ))
}

export function canEditSolutionReviews(canEdit: boolean, nodeReadOnly: boolean): boolean {
  return canEdit && !nodeReadOnly
}

export function isSolutionDecisionComplete(decision: Pick<NodeSolutionDecision, 'result' | 'conditions'>): boolean {
  if (!decision.result) return false
  return decision.result !== 'CONDITIONAL_PASS' || Boolean(decision.conditions?.trim())
}

export function shouldAutoConfirmDecision(
  editable: boolean,
  packageStatus: NodeSolutionPackage['status'],
  reviews: Pick<NodeSolutionReview, 'reviewType' | 'status' | 'reviewerId'>[],
  decision: Pick<NodeSolutionDecision, 'result' | 'conditions'>,
): boolean {
  return editable
    && packageStatus === 'SUBMITTED'
    && allSolutionReviewsReady(reviews)
    && isSolutionDecisionComplete(decision)
}
