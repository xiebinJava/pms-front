export const legacyWorkflowComponents = Object.freeze({
  kickoff: ['project-basic-info'],
  requirement: ['requirement-scope'],
  design: ['solution-design'],
  plan: ['plan-resource-risk'],
  develop: ['development-control'],
  acceptance: ['business-acceptance'],
  release: ['release-handover'],
  review: ['value-review'],
  knowledge: ['knowledge-standard'],
})

export const defaultProjectFields = Object.freeze([
  { key: 'description', label: 'detail.profileDescription', visible: true, required: true },
  { key: 'priority', label: 'detail.profilePriority', visible: true, required: true },
  { key: 'projectLevel', label: 'detail.profileProjectLevel', visible: true, required: false },
  { key: 'schedule', label: 'detail.profileSchedule', visible: true, required: true },
  { key: 'businessLine', label: 'detail.businessLine', visible: true, required: false },
  { key: 'projectManager', label: 'detail.manager', visible: true, required: true },
  { key: 'projectMembers', label: 'detail.members', visible: true, required: true },
  { key: 'followers', label: 'detail.followers', visible: true, required: false },
])

const projectFieldBindings = Object.freeze({
  description: { binding: 'project.description', type: 'TEXTAREA' },
  priority: { binding: 'project.priority', type: 'RADIO' },
  projectLevel: { binding: 'project.projectLevel', type: 'SINGLE_SELECT' },
  schedule: { binding: 'project.schedule', type: 'DATE_RANGE' },
  businessLine: { binding: 'project.businessLine', type: 'SINGLE_SELECT' },
  projectManager: { binding: 'project.projectManager', type: 'PERSON' },
  projectMembers: { binding: 'project.projectMembers', type: 'PERSON_MULTI' },
  followers: { binding: 'project.followers', type: 'PERSON_MULTI' },
})

function legacyProfileEnabled(node) {
  return node?.projectBasicInfo === true
    || (node?.projectBasicInfo == null && Array.isArray(node?.components) && node.components.includes('project-basic-info'))
}

export function nodeWorkflowFields(node) {
  if (!node) return []
  if (Array.isArray(node.contentOrder)) {
    return (node.fields || []).map((field) => ({ ...field, visible: field.visible !== false, binding: field.binding ?? null }))
  }
  const profileFields = legacyProfileEnabled(node)
    ? (Array.isArray(node.projectBasicInfoFields) ? node.projectBasicInfoFields : defaultProjectFields).map((field) => {
      const definition = projectFieldBindings[field.key]
      return definition && {
        key: `project-${field.key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
        label: field.label,
        type: definition.type,
        required: Boolean(field.required),
        options: [],
        visible: field.visible !== false,
        binding: definition.binding,
      }
    }).filter(Boolean)
    : []
  return [...profileFields, ...(node.fields || []).map((field) => ({ ...field, visible: field.visible !== false, binding: null }))]
}

export function nodeWorkflowContentOrder(node) {
  if (!node) return []
  if (Array.isArray(node.contentOrder)) return [...node.contentOrder]
  const hasFields = nodeWorkflowFields(node).length > 0
  const components = Array.isArray(node.components) ? node.components : (legacyWorkflowComponents[node.nodeKey] || [])
  const contentOrder = components.flatMap((component) => component === 'project-basic-info'
    ? (hasFields ? ['fields'] : [])
    : [`component:${component}`])
  if (hasFields && !contentOrder.includes('fields')) contentOrder.push('fields')
  return contentOrder
}

export function nodeHasComponent(node, componentKey) {
  if (!node) return false
  if (Array.isArray(node.components)) return node.components.includes(componentKey)
  return (legacyWorkflowComponents[node.nodeKey] || []).includes(componentKey)
}

export function shouldRefreshRequirements(node) {
  return nodeHasComponent(node, 'requirement-scope')
}

export function removeWorkflowAttachmentState(values, attachments, fieldKey, attachmentId) {
  const fieldValue = values[fieldKey]
  const fieldAttachments = attachments[fieldKey] || []
  return {
    values: {
      ...values,
      [fieldKey]: (Array.isArray(fieldValue) ? fieldValue : []).filter((id) => id !== attachmentId),
    },
    attachments: {
      ...attachments,
      [fieldKey]: fieldAttachments.filter((attachment) => attachment.id !== attachmentId),
    },
  }
}

export async function transitionActiveNode(currentNodeId, nextNodeId, savePendingChanges, selectNode) {
  if (currentNodeId === nextNodeId) return true
  if (typeof savePendingChanges === 'function' && await savePendingChanges() === false) return false
  selectNode(nextNodeId)
  return true
}

export function visibleProjectFields(fields) {
  const configured = Array.isArray(fields) ? fields : defaultProjectFields
  return configured.filter((field) => field.visible !== false)
}

export function missingConfiguredProjectFields(fields, profile) {
  const configured = Array.isArray(fields) && fields.some((field) => field.binding)
    ? fields.map((field) => ({ ...field, key: field.binding?.slice('project.'.length) || field.key }))
    : fields
  return visibleProjectFields(configured)
    .filter((field) => field.required)
    .filter((field) => {
      switch (field.key) {
        case 'description': return !profile.description?.trim()
        case 'priority': return profile.priority == null
        case 'projectLevel': return profile.projectLevel == null
        case 'schedule': return profile.schedule?.length !== 2 || profile.schedule.some((date) => !date)
        case 'businessLine': return profile.orgUnitId == null
        case 'projectManager': return profile.projectManagerId == null
        case 'projectMembers': return !profile.memberIds?.length
        case 'followers': return !profile.followerIds?.length
        default: return false
      }
    })
    .map((field) => field.key)
}

export function emptyWorkflowFieldValue(type) {
  if (type === 'MULTI_SELECT' || type === 'PERSON_MULTI' || type === 'ATTACHMENT' || type === 'DATE_RANGE') return []
  if (type === 'PERSON' || type === 'NUMBER' || type === 'DATE' || type === 'RADIO' || type === 'SINGLE_SELECT') return null
  return ''
}

export function isWorkflowFieldEmpty(value) {
  return value == null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && value.length === 0)
}
