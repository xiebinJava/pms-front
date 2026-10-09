export const PROJECT_FIELD_BINDINGS = Object.freeze({
  description: { binding: 'project.description', type: 'TEXTAREA' },
  priority: { binding: 'project.priority', type: 'RADIO' },
  projectLevel: { binding: 'project.projectLevel', type: 'SINGLE_SELECT' },
  schedule: { binding: 'project.schedule', type: 'DATE_RANGE' },
  businessLine: { binding: 'project.businessLine', type: 'SINGLE_SELECT' },
  projectManager: { binding: 'project.projectManager', type: 'PERSON' },
  projectMembers: { binding: 'project.projectMembers', type: 'PERSON_MULTI' },
  followers: { binding: 'project.followers', type: 'PERSON_MULTI' },
})

export const REQUIREMENT_FIELD_BINDINGS = Object.freeze({
  title: { binding: 'requirement.title', type: 'TEXT' },
  description: { binding: 'requirement.description', type: 'TEXTAREA' },
  priority: { binding: 'requirement.priority', type: 'SINGLE_SELECT' },
  businessLine: { binding: 'requirement.businessLine', type: 'SINGLE_SELECT' },
  owner: { binding: 'requirement.owner', type: 'PERSON' },
})

export const TOPIC_FIELD_BINDINGS = Object.freeze({
  title: { binding: 'topic.title', type: 'TEXT' },
  owner: { binding: 'topic.owner', type: 'PERSON' },
  project: { binding: 'topic.project', type: 'TEXT' },
  status: { binding: 'topic.status', type: 'TEXT' },
  progress: { binding: 'topic.progress', type: 'NUMBER' },
  latestBuildVersion: { binding: 'topic.latestBuildVersion', type: 'TEXT' },
  testStatus: { binding: 'topic.testStatus', type: 'TEXT' },
})

export const STORY_FIELD_BINDINGS = Object.freeze({
  title: { binding: 'story.title', type: 'TEXT' },
  owner: { binding: 'story.owner', type: 'PERSON' },
  status: { binding: 'story.status', type: 'TEXT' },
  progress: { binding: 'story.progress', type: 'NUMBER' },
  storyPoints: { binding: 'story.storyPoints', type: 'NUMBER' },
  schedule: { binding: 'story.schedule', type: 'DATE_RANGE' },
  blocker: { binding: 'story.blocker', type: 'TEXTAREA' },
})

const DEFAULT_PROJECT_FIELDS = Object.freeze([
  { key: 'description', label: 'detail.profileDescription', visible: true, required: true },
  { key: 'priority', label: 'detail.profilePriority', visible: true, required: true },
  { key: 'projectLevel', label: 'detail.profileProjectLevel', visible: true, required: false },
  { key: 'schedule', label: 'detail.profileSchedule', visible: true, required: true },
  { key: 'businessLine', label: 'detail.businessLine', visible: true, required: false },
  { key: 'projectManager', label: 'detail.manager', visible: true, required: true },
  { key: 'projectMembers', label: 'detail.members', visible: true, required: true },
  { key: 'followers', label: 'detail.followers', visible: true, required: false },
])

export const DEFAULT_REQUIREMENT_RECEIVING_ANALYSIS_CONFIG = Object.freeze({
  showFilter: false,
  showAnalysis: true,
  showDecision: true,
  requireCategory: true,
  showFeasibilityScore: false,
  requireFeasibilityScore: false,
  showRoiScore: false,
  requireRoiScore: false,
  showStrategicFitScore: true,
  requireStrategicFitScore: true,
  requireAnalysisConclusion: false,
  allowReject: true,
})

function clone(value) {
  return structuredClone(value)
}

function projectFieldKey(key) {
  return `project-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
}

function uniqueProjectFieldKey(key, usedKeys) {
  const base = projectFieldKey(key)
  let candidate = base
  let suffix = 2
  while (usedKeys.has(candidate)) candidate = `${base}-${suffix++}`
  usedKeys.add(candidate)
  return candidate
}

function normalizeProjectFields(fields, usedKeys) {
  return (Array.isArray(fields) ? fields : DEFAULT_PROJECT_FIELDS)
    .filter((field) => PROJECT_FIELD_BINDINGS[field.key])
    .map((field) => {
      const definition = PROJECT_FIELD_BINDINGS[field.key]
      return {
        key: uniqueProjectFieldKey(field.key, usedKeys),
        label: field.label,
        type: definition.type,
        required: Boolean(field.required),
        options: [],
        visible: field.visible !== false,
        binding: definition.binding,
      }
    })
}

function normalizeCustomFields(fields) {
  return (Array.isArray(fields) ? fields : []).map((field) => ({
    ...clone(field),
    options: Array.isArray(field.options) ? clone(field.options) : [],
    visible: field.visible !== false,
    binding: field.binding ?? null,
  }))
}

function normalizeNode(node) {
  const components = Array.isArray(node.components) ? node.components : []
  const hasExplicitProjectBasicInfo = Object.hasOwn(node, 'projectBasicInfo')
  const hasProjectFields = hasExplicitProjectBasicInfo
    ? node.projectBasicInfo === true
    : components.includes('project-basic-info')
  const customFields = normalizeCustomFields(node.fields)
  const usedKeys = new Set(customFields.map((field) => field.key))
  const projectFields = hasProjectFields
    ? normalizeProjectFields(node.projectBasicInfoFields, usedKeys)
    : []
  const contentOrder = components.flatMap((component) => component === 'project-basic-info'
    ? (projectFields.length ? ['fields'] : [])
    : [`component:${component}`])

  if (projectFields.length && !contentOrder.includes('fields')) contentOrder.push('fields')
  if (customFields.length) contentOrder.push('legacy-custom-fields')

  return {
    key: node.key,
    name: node.name,
    description: node.description ?? '',
    deliverable: node.deliverable ?? '',
    roles: node.roles ?? '',
    fields: [...projectFields, ...customFields],
    contentOrder,
    ...(node.componentConfigs ? { componentConfigs: clone(node.componentConfigs) } : {}),
  }
}

export function normalizeWorkflowDefinition(definition) {
  if (definition?.schemaVersion === 2) {
    const normalized = clone(definition)
    normalized.nodes = (normalized.nodes || []).map((node) => ({
      ...node,
      fields: (node.fields || []).map((field) => field.binding === 'requirement.priority' && field.type === 'NUMBER'
        ? { ...field, type: 'SINGLE_SELECT' }
        : field),
    }))
    return normalized
  }

  const normalized = {
    schemaVersion: 2,
    nodes: (Array.isArray(definition?.nodes) ? definition.nodes : []).map(normalizeNode),
  }
  if (typeof definition?.sourceProjectNodeKey === 'string') {
    normalized.sourceProjectNodeKey = definition.sourceProjectNodeKey
  }
  if (typeof definition?.sourceTopicNodeKey === 'string') {
    normalized.sourceTopicNodeKey = definition.sourceTopicNodeKey
  }
  return normalized
}
