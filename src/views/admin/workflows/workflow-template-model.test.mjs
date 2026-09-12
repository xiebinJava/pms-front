import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_PROJECT_BASIC_INFO_FIELDS,
  FIXED_NODE_BLOCKS,
  createWorkflowNode,
  moveWorkflowNode,
  removeWorkflowNode,
} from './workflow-template-model.mjs'

const nodes = [
  { key: 'intake', name: '立项', components: [], fields: [], projectBasicInfo: false, projectBasicInfoFields: [] },
  { key: 'design', name: '设计', components: [], fields: [], projectBasicInfo: false, projectBasicInfoFields: [] },
  { key: 'release', name: '发布', components: [], fields: [], projectBasicInfo: false, projectBasicInfoFields: [] },
]

test('moves nodes in a sequential flow without dropping node definitions', () => {
  const moved = moveWorkflowNode(nodes, 'release', 0)
  assert.deepEqual(moved.map((node) => node.key), ['release', 'intake', 'design'])
  assert.equal(moved[0].name, '发布')
  assert.deepEqual(nodes.map((node) => node.key), ['intake', 'design', 'release'])
})

test('creates a generic node with a unique stable key and no accidental workbench', () => {
  const first = createWorkflowNode(nodes, { name: '数据复核' })
  const second = createWorkflowNode([...nodes, first], { name: '数据复核' })
  assert.equal(first.name, '数据复核')
  assert.notEqual(first.key, second.key)
  assert.deepEqual(first.components, [])
  assert.deepEqual(first.fields, [])
})

test('prevents deleting the final stage and keeps the three platform blocks fixed', () => {
  assert.throws(() => removeWorkflowNode([nodes[0]], 'intake'), /至少保留一个节点/)
  assert.deepEqual(FIXED_NODE_BLOCKS, ['owner', 'schedule', 'task-board'])
})

test('ships canonical project profile fields as configurable visibility/requiredness settings', () => {
  assert.deepEqual(DEFAULT_PROJECT_BASIC_INFO_FIELDS.map((field) => field.key), [
    'description', 'priority', 'projectLevel', 'schedule', 'businessLine', 'projectManager', 'projectMembers', 'followers',
  ])
  assert.equal(DEFAULT_PROJECT_BASIC_INFO_FIELDS.find((field) => field.key === 'description').required, true)
})

test('confirms before a type switch can clear an unsaved workflow draft', () => {
  const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
  const handler = source.match(/async function changeProjectType\([\s\S]*?\n\}/)?.[0]
  assert.ok(handler)
  assert.ok(handler.indexOf('confirmDiscard') < handler.indexOf('selectedTypeId.value = typeId'))
})

test('node preview shows fixed sections and configured components and fields', () => {
  const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
  assert.match(source, /preview-owner-schedule/)
  assert.match(source, /preview-task-board/)
  assert.match(source, /preview-component-card/)
  assert.match(source, /currentNode\.fields/)
})
