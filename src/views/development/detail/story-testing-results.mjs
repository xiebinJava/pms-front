const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const COMPONENT_KEY = 'story-testing'
const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'PASSED', 'FAILED']

export function isStoryTestingEnabled(config) {
  return record(config).testingResultsEnabled === true
}
export function normalizeStoryTesting(values) {
  const state = record(record(record(values).__components)[COMPONENT_KEY])
  return {
    buildVersion: typeof state.buildVersion === 'string' ? state.buildVersion : '',
    testStatus: STATUSES.includes(state.testStatus) ? state.testStatus : 'NOT_STARTED',
    reportUrl: typeof state.reportUrl === 'string' ? state.reportUrl : '',
    residualIssues: Array.isArray(state.residualIssues) ? state.residualIssues
      .filter(issue => issue && typeof issue.id === 'string' && issue.id && (issue.description == null || typeof issue.description === 'string'))
      .map(issue => ({ ...issue, description: issue.description ?? '' })) : [],
  }
}
export function mergeStoryTesting(values, state) {
  const root = record(values)
  const components = record(root.__components)
  return { ...root, __components: { ...components, [COMPONENT_KEY]: { ...record(components[COMPONENT_KEY]), ...state,
    residualIssues: state.residualIssues.map(issue => ({ ...issue })) } } }
}
