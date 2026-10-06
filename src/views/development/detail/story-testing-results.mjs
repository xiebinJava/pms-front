const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const COMPONENT_KEY = 'story-testing'
const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'PASSED', 'FAILED']
export const DEFECT_TYPES = ['RND', 'UI', 'PRODUCT']
export const DEFECT_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export function isStoryTestingEnabled(config) {
  return record(config).testingResultsEnabled === true
}
export function normalizeDefects(issues) {
  return (Array.isArray(issues) ? issues : [])
    .filter(issue => issue && typeof issue.id === 'string' && issue.id && (issue.description == null || typeof issue.description === 'string'))
    .map(issue => ({
      ...issue,
      name: typeof issue.name === 'string' ? issue.name : '',
      type: DEFECT_TYPES.includes(issue.type) ? issue.type : '',
      level: DEFECT_LEVELS.includes(issue.level) ? issue.level : '',
      description: typeof issue.description === 'string' ? issue.description : '',
      expectedResult: typeof issue.expectedResult === 'string' ? issue.expectedResult : '',
      owner: typeof issue.owner === 'number' || (typeof issue.owner === 'string' && issue.owner.trim() !== '') ? issue.owner : null,
    }))
}
export function normalizeStoryTesting(values) {
  const state = record(record(record(values).__components)[COMPONENT_KEY])
  return {
    buildVersion: typeof state.buildVersion === 'string' ? state.buildVersion : '',
    testStatus: STATUSES.includes(state.testStatus) ? state.testStatus : 'NOT_STARTED',
    reportUrl: typeof state.reportUrl === 'string' ? state.reportUrl : '',
    residualIssues: normalizeDefects(state.residualIssues),
  }
}
export function mergeStoryTesting(values, state) {
  const root = record(values)
  const components = record(root.__components)
  return { ...root, __components: { ...components, [COMPONENT_KEY]: { ...record(components[COMPONENT_KEY]), ...state,
    residualIssues: state.residualIssues.map(issue => ({ ...issue })) } } }
}
