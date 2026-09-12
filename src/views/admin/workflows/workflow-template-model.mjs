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

export function moveWorkflowNode(nodes, nodeKey, toIndex) {
  const fromIndex = nodes.findIndex((node) => node.key === nodeKey)
  if (fromIndex < 0 || !Number.isInteger(toIndex) || toIndex < 0 || toIndex >= nodes.length) return [...nodes]
  const next = [...nodes]
  const [node] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, node)
  return next
}

export function createWorkflowNode(nodes, { name = '新节点', description = '', key } = {}) {
  const base = (key || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'custom-node')
  let uniqueKey = base
  let index = 2
  const used = new Set(nodes.map((node) => node.key))
  while (used.has(uniqueKey)) uniqueKey = `${base}-${index++}`
  return {
    key: uniqueKey,
    name,
    description,
    deliverable: '',
    roles: '',
    components: [],
    fields: [],
    projectBasicInfo: false,
    projectBasicInfoFields: [],
  }
}

export function removeWorkflowNode(nodes, nodeKey) {
  if (nodes.length <= 1) throw new Error('流程至少保留一个节点')
  return nodes.filter((node) => node.key !== nodeKey)
}
