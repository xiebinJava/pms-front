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
  return visibleProjectFields(fields)
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
  if (type === 'MULTI_SELECT' || type === 'ATTACHMENT') return []
  if (type === 'PERSON' || type === 'NUMBER' || type === 'DATE' || type === 'SINGLE_SELECT') return null
  return ''
}

export function isWorkflowFieldEmpty(value) {
  return value == null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && value.length === 0)
}
