export const FIXED_NODE_BLOCKS = Object.freeze(['owner', 'schedule', 'task-board'])

export const DEFAULT_PROJECT_BASIC_INFO_FIELDS = Object.freeze([
  { key: 'description', label: '项目描述', visible: true, required: true },
  { key: 'priority', label: '优先级', visible: true, required: true },
  { key: 'projectLevel', label: '项目等级', visible: true, required: false },
  { key: 'schedule', label: '项目排期', visible: true, required: true },
  { key: 'businessLine', label: '业务线', visible: true, required: false },
  { key: 'projectManager', label: '项目经理', visible: true, required: true },
  { key: 'projectMembers', label: '项目成员', visible: true, required: true },
  { key: 'followers', label: '关注人', visible: true, required: false },
])

export function createUniqueWorkflowKey(existingKeys, requestedKey, fallback = 'field') {
  const base = String(requestedKey || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || fallback
  const used = new Set(existingKeys)
  let key = base
  let index = 2
  while (used.has(key)) key = `${base}-${index++}`
  return key
}

function moveByKey(items, key, toIndex) {
  const fromIndex = items.findIndex((item) => (typeof item === 'string' ? item : item.key) === key)
  if (fromIndex < 0 || !Number.isInteger(toIndex) || toIndex < 0 || toIndex >= items.length) return [...items]
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

export function addWorkflowField(node, { key, label = '新字段', type = 'TEXT', required = false, options = [], visible = true, binding = null } = {}) {
  const fields = Array.isArray(node.fields) ? node.fields : []
  const field = {
    key: createUniqueWorkflowKey(fields.map((item) => item.key), key || label),
    label,
    type,
    required,
    options: [...options],
    visible,
    binding,
  }
  const contentOrder = Array.isArray(node.contentOrder) ? [...node.contentOrder] : []
  if (!contentOrder.includes('legacy-custom-fields') && !contentOrder.includes('fields')) contentOrder.push('fields')
  if (field.binding && !contentOrder.includes('fields')) contentOrder.push('fields')
  return { ...node, fields: [...fields, field], contentOrder }
}

export function removeWorkflowField(node, fieldKey) {
  const fields = (node.fields || []).filter((field) => field.key !== fieldKey)
  const hasCompatibilitySlot = (node.contentOrder || []).includes('legacy-custom-fields')
  const hasBoundFields = fields.some((field) => Boolean(field.binding))
  const hasUnboundFields = fields.some((field) => !field.binding)
  const contentOrder = (node.contentOrder || []).filter((item) => {
    if (item === 'fields') return fields.length > 0 && (!hasCompatibilitySlot || hasBoundFields)
    if (item === 'legacy-custom-fields') return hasCompatibilitySlot && hasUnboundFields
    return true
  })
  return { ...node, fields, contentOrder }
}

export function moveWorkflowField(node, fieldKey, toIndex) {
  return { ...node, fields: moveByKey(node.fields || [], fieldKey, toIndex) }
}

export function moveWorkflowContentItem(node, contentItem, toIndex) {
  return { ...node, contentOrder: moveByKey(node.contentOrder || [], contentItem, toIndex) }
}

export function moveWorkflowNode(nodes, nodeKey, toIndex) {
  const fromIndex = nodes.findIndex((node) => node.key === nodeKey)
  if (fromIndex < 0 || !Number.isInteger(toIndex) || toIndex < 0 || toIndex >= nodes.length) return [...nodes]
  const next = [...nodes]
  const [node] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, node)
  return next
}

export function createWorkflowNode(nodes, { name = '新节点', description = '', key } = {}) {
  const uniqueKey = createUniqueWorkflowKey(nodes.map((node) => node.key), key || name, 'custom-node')
  return {
    key: uniqueKey,
    name,
    description,
    deliverable: '',
    roles: '',
    fields: [],
    contentOrder: [],
  }
}

export function removeWorkflowNode(nodes, nodeKey) {
  if (nodes.length <= 1) throw new Error('流程至少保留一个节点')
  return nodes.filter((node) => node.key !== nodeKey)
}
