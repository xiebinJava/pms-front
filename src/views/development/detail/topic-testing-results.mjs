const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
export function isTestingResultsEnabled(config) {
  return record(config).testingResultsEnabled === true
}
export function configureTopicTesting(node, enabled) {
  if (!node.contentOrder?.includes('component:story-list')) return node
  const configs = record(node.componentConfigs)
  return { ...node, componentConfigs: { ...configs, 'story-list': { ...record(configs['story-list']), testingResultsEnabled: enabled === true } } }
}
export function normalizeTopicTesting(values) {
  const state = record(record(record(values).__components)['story-list'])
  return {
    buildVersion: typeof state.buildVersion === 'string' ? state.buildVersion : '',
    testStatus: ['NOT_STARTED', 'IN_PROGRESS', 'PASSED', 'FAILED'].includes(state.testStatus) ? state.testStatus : 'NOT_STARTED',
    reportUrl: typeof state.reportUrl === 'string' ? state.reportUrl : '',
    residualIssues: Array.isArray(state.residualIssues) ? state.residualIssues
      .filter(issue => issue && typeof issue.id === 'string' && issue.id && (issue.description == null || typeof issue.description === 'string'))
      .map(issue => ({ ...issue, description: issue.description ?? '' })) : [],
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
