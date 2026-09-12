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

function clone(value) {
  return structuredClone(value)
}

function projectFieldKey(key) {
  return `project-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
}

function normalizeProjectFields(fields) {
  return (Array.isArray(fields) ? fields : [])
    .filter((field) => PROJECT_FIELD_BINDINGS[field.key])
    .map((field) => {
      const definition = PROJECT_FIELD_BINDINGS[field.key]
      return {
        key: projectFieldKey(field.key),
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
  const hasFields = hasProjectFields || Array.isArray(node.fields) && node.fields.length > 0
  const contentOrder = components.flatMap((component) => component === 'project-basic-info'
    ? (hasFields ? ['fields'] : [])
    : [`component:${component}`])

  if (hasFields && !contentOrder.includes('fields')) contentOrder.push('fields')

  return {
    key: node.key,
    name: node.name,
    description: node.description ?? '',
    deliverable: node.deliverable ?? '',
    roles: node.roles ?? '',
    fields: [...(hasProjectFields ? normalizeProjectFields(node.projectBasicInfoFields) : []), ...normalizeCustomFields(node.fields)],
    contentOrder,
  }
}

export function normalizeWorkflowDefinition(definition) {
  if (definition?.schemaVersion === 2) return clone(definition)

  return {
    schemaVersion: 2,
    nodes: (Array.isArray(definition?.nodes) ? definition.nodes : []).map(normalizeNode),
  }
}
