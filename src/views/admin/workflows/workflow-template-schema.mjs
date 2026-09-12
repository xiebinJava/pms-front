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

function uniqueProjectFieldKey(key, usedKeys) {
  const base = projectFieldKey(key)
  let candidate = base
  let suffix = 2
  while (usedKeys.has(candidate)) candidate = `${base}-${suffix++}`
  usedKeys.add(candidate)
  return candidate
}

function normalizeProjectFields(fields, usedKeys) {
  return (Array.isArray(fields) ? fields : [])
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
  }
}

export function normalizeWorkflowDefinition(definition) {
  if (definition?.schemaVersion === 2) return clone(definition)

  return {
    schemaVersion: 2,
    nodes: (Array.isArray(definition?.nodes) ? definition.nodes : []).map(normalizeNode),
  }
}
