const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'PASSED', 'FAILED']
export const DEFECT_TYPES = ['RND', 'UI', 'PRODUCT']
export const DEFECT_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
export function isTestingResultsEnabled(config) {
  return record(config).testingResultsEnabled === true
}
export function configureTopicTesting(node, enabled) {
  if (!node.contentOrder?.includes('component:story-list')) return node
  const configs = record(node.componentConfigs)
  return { ...node, componentConfigs: { ...configs, 'story-list': { ...record(configs['story-list']), testingResultsEnabled: enabled === true } } }
}
function normalizeDefects(issues) {
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
export function normalizeTopicTesting(values) {
  const state = record(record(record(values).__components)['story-list'])
  return {
    buildVersion: typeof state.buildVersion === 'string' ? state.buildVersion : '',
    testStatus: ['NOT_STARTED', 'IN_PROGRESS', 'PASSED', 'FAILED'].includes(state.testStatus) ? state.testStatus : 'NOT_STARTED',
    reportUrl: typeof state.reportUrl === 'string' ? state.reportUrl : '',
    residualIssues: normalizeDefects(state.residualIssues),
  }
}
export function mergeTopicTesting(values, state) {
  const root = record(values)
  const components = record(root.__components)
  return { ...root, __components: { ...components, 'story-list': { ...record(components['story-list']), ...state,
    residualIssues: state.residualIssues.map(issue => ({ ...issue })) } } }
}
export function summarizeStoryTesting(stories) {
  const counts = { total: 0, passed: 0, failed: 0, testing: 0, notStarted: 0, unknown: 0 }
  for (const story of Array.isArray(stories) ? stories : []) {
    counts.total += 1
    if (story?.testStatus === 'PASSED') counts.passed += 1
    else if (story?.testStatus === 'FAILED') counts.failed += 1
    else if (story?.testStatus === 'IN_PROGRESS') counts.testing += 1
    else if (story?.testStatus === 'NOT_STARTED') counts.notStarted += 1
    else counts.unknown += 1
  }
  return counts
}
