import { getStoryWorkbenchVariant } from './story-node-workbench.mjs'

const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const text = value => typeof value === 'string' && value.trim().length > 0
const ids = value => Array.isArray(value) && value.length > 0 && value.every(id => Number.isSafeInteger(id) && id > 0)
const present = value => value != null && (typeof value === 'string' ? text(value) : Array.isArray(value) ? value.length > 0 && value.every(present) : true)

/** A saved-content indicator, deliberately independent of node completion status. */
export function isWorkbenchFilled(key, node = {}, item = {}, pending = false) {
  if (pending) return false
  const state = record(record(record(node.fieldValues).__components)[key])
  const config = record(record(node.componentConfigs)[key])
  if (key === 'requirement-receiving-analysis') {
    if (config.showAnalysis !== false) {
      if (config.requireCategory !== false && !['FUNCTIONAL', 'NON_FUNCTIONAL'].includes(state.category)) return false
      if (config.showStrategicFitScore !== false && config.requireStrategicFitScore !== false
        && !(Number.isInteger(state.strategicFitScore) && state.strategicFitScore >= 1 && state.strategicFitScore <= 5)) return false
    }
    if (config.showDecision !== false) {
      if (!['PASS', 'NEEDS_INFO', 'REJECT'].includes(state.decision)) return false
      if (state.decision === 'NEEDS_INFO' && !text(state.supplementNote)) return false
      if (state.decision === 'REJECT' && !text(state.decisionReason)) return false
    }
    return Object.values(state).some(present)
  }
  if (key === 'topic-research') return state.needed === 'NO' ? text(state.skipReason)
    : state.needed === 'YES' && text(state.goal) && text(state.reportUrl)
  if (key === 'topic-design-review') return text(state.productPlanUrl) && ids(state.productReviewerIds)
    && ['PASSED', 'REJECTED'].includes(state.productReviewStatus)
  if (key === 'requirement-execution') return !!item.executionTarget?.targetId
  if (key === 'requirement-node-workbench') {
    const name = String(node.name || config.nodeName || '')
    if (name.includes('澄清')) return text(state.background) && text(state.acceptanceCriteria) && ['CLARIFIED', 'NEEDS_INFO', 'RETURNED'].includes(state.conclusion)
    if (name.includes('整合')) return ['PROJECT', 'TOPIC', 'STORY'].includes(state.requirementSpecification)
      && (state.shouldIntegrate === 'NO' || state.shouldIntegrate === 'YES' && ids(state.requirementIds))
    if (name.includes('排期')) return !!state.targetId && text(state.expectedLaunchStartDate) && text(state.expectedLaunchEndDate)
      && state.expectedLaunchStartDate <= state.expectedLaunchEndDate
    if (name.includes('验收')) return ['PASSED', 'CONDITIONAL', 'REJECTED'].includes(state.businessResult) && text(state.businessConfirmation)
      && (!Array.isArray(state.residualIssues) || state.residualIssues.every(issue => text(issue.description)))
    if (name.includes('开发')) return !!item.executionTarget?.targetId && item.executionTarget?.status === 'DONE'
    return false
  }
  if (key === 'story-node-workbench') {
    const variant = config.variant || getStoryWorkbenchVariant(node)
    if (variant === 'writing') return text(item.title) && (text(state.descriptionAndAcceptance) || text(state.background) && text(state.acceptanceCriteria))
      && ['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(state.priority || 'NORMAL')
    if (variant === 'iteration') return present(item.iterationPlanId || state.iterationPlanId) && ids(state.developerIds) && ids(state.testerIds)
    if (variant === 'development') return Array.isArray(state.testCases) && state.testCases.length > 0
      && state.testCases.every(entry => text(entry.name) && text(entry.expectedResult) && ['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(entry.priority))
      && ['NOT_MERGED', 'MERGED'].includes(state.mergeStatus) && text(state.deployEnv)
    if (variant === 'acceptance') return ['PASS', 'CONDITIONAL', 'FAIL'].includes(state.acceptanceConclusion) && text(state.acceptanceNote)
    if (variant === 'release') return present(item.iterationPlanId || state.iterationPlanId)
    if (variant === 'launch') return text(state.launchDate) && text(state.launchVerification) && text(state.retrospective)
    return false
  }
  if (key === 'story-testing' || key === 'story-list' && config.testingResultsEnabled === true) return (text(state.reportUrl) || Array.isArray(state.residualIssues) && state.residualIssues.length > 0)
    && (!Array.isArray(state.residualIssues) || state.residualIssues.every(issue => text(issue.name) && text(issue.description) && text(issue.expectedResult) && present(issue.owner)))
  return false
}

export function areWorkflowFieldsFilled(fields = [], values = {}, boundValues = {}, pending = false) {
  if (pending) return false
  const visible = fields.filter(field => field.visible !== false)
  const required = visible.filter(field => field.required)
  const value = field => field.binding && !Object.hasOwn(values, field.key) ? boundValues[field.key] : values[field.key]
  return visible.length > 0 && required.every(field => present(value(field)))
    && (required.length > 0 || visible.some(field => present(value(field))))
}
