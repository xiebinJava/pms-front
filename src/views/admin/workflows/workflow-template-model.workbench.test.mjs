import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ensureRequirementReleaseVersionField,
  addWorkflowComponent,
  removeWorkflowComponent,
} from './workflow-template-model.mjs'

test('restores only the required publish version field on the requirement release node', () => {
  const definition = {
    schemaVersion: 2,
    nodes: [{ key: 'release', name: '需求上线', fields: [], contentOrder: [] }],
  }
  const restored = ensureRequirementReleaseVersionField(definition)
  assert.deepEqual(restored.nodes[0].fields, [{
    key: 'release-version',
    label: '发布版本',
    type: 'TEXT',
    required: true,
    options: [],
    visible: true,
    binding: null,
    fullWidth: false,
  }])
  assert.deepEqual(restored.nodes[0].contentOrder, ['legacy-custom-fields'])
})

test('does not duplicate an existing publish version field or remove other node content', () => {
  const definition = {
    schemaVersion: 2,
    nodes: [{
      key: 'release',
      name: '需求上线',
      fields: [{ key: 'release-version', label: '版本号', type: 'TEXT', required: false, options: [] }],
      contentOrder: ['fields', 'component:release-handover'],
    }],
  }
  const restored = ensureRequirementReleaseVersionField(definition)
  assert.equal(restored.nodes[0].fields.length, 1)
  assert.deepEqual(restored.nodes[0].contentOrder, ['fields', 'component:release-handover'])
})

test('persists a node workbench config through component binding and removal', () => {
  const node = { key: 'clarify', name: '需求澄清', fields: [], contentOrder: [] }
  const config = { nodeKey: 'clarify', nodeName: '需求澄清', purpose: '说明', activities: ['活动'] }
  const configured = addWorkflowComponent(node, 'requirement-node-workbench', config)
  assert.deepEqual(configured.contentOrder, ['component:requirement-node-workbench'])
  assert.deepEqual(configured.componentConfigs['requirement-node-workbench'], config)
  const removed = removeWorkflowComponent(configured, 'requirement-node-workbench')
  assert.deepEqual(removed.contentOrder, [])
  assert.equal(removed.componentConfigs, undefined)
})
