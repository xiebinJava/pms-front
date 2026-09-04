import type {
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
  return [
    pkg.packageVersion,
    pkg.productSolution,
    pkg.technicalSolution,
    pkg.summary,
    pkg.scopeCoverage,
    pkg.rolloutPremise,
  ].every((value) => Boolean(value?.trim()))
}

export function allSolutionReviewsPassed(reviews: Pick<NodeSolutionReview, 'reviewType' | 'status'>[]): boolean {
  return solutionReviewTypes.every((reviewType) => reviews.some(
    (review) => review.reviewType === reviewType && review.status === 'PASSED',
  ))
}

export function isSolutionDecisionComplete(decision: Pick<NodeSolutionDecision, 'result' | 'reason' | 'conditions'>): boolean {
  if (!decision.result || !decision.reason?.trim()) return false
  return decision.result !== 'CONDITIONAL_PASS' || Boolean(decision.conditions?.trim())
}
