import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ensureRequirementReleaseVersionField,
  ensureRequirementNodeWorkbenchConfigs,
  addWorkflowComponent,
  getAvailableWorkflowComponents,
  REQUIREMENT_WORKBENCH_PALETTE,
  removeWorkflowComponent,
} from './workflow-template-model.mjs'

test('lists the seven requirement workbench entries and maps them to runtime components', () => {
  const components = [
    { key: 'requirement-execution', processTypeCodes: ['requirement-management'], workbenchTypes: ['requirement'] },
    { key: 'requirement-receiving-analysis', processTypeCodes: ['requirement-management'], workbenchTypes: ['requirement'] },
    { key: 'requirement-node-workbench', processTypeCodes: ['requirement-management'], workbenchTypes: ['requirement'] },
    { key: 'solution-design', processTypeCodes: [], workbenchTypes: ['project', 'topic', 'story'] },
  ]

  assert.deepEqual(getAvailableWorkflowComponents({
    processTypeCode: 'requirement-management',
    source: 'requirement',
    components,
    paletteComponents: REQUIREMENT_WORKBENCH_PALETTE,
    currentNode: { key: 'clarify', name: '需求澄清' },
    currentNodeIndex: 2,
  }).map((component) => component.key), [
    'requirement-receiving-analysis',
    'requirement-clarification-workbench',
    'requirement-integration-workbench',
    'requirement-scheduling-workbench',
    'requirement-execution',
    'requirement-acceptance-workbench',
    'requirement-release-workbench',
  ])

  const clarification = getAvailableWorkflowComponents({
    processTypeCode: 'requirement-management',
    source: 'requirement',
    components,
    paletteComponents: REQUIREMENT_WORKBENCH_PALETTE,
    currentNode: { key: 'clarify', name: '需求澄清' },
    currentNodeIndex: 2,
  }).find((component) => component.key === 'requirement-clarification-workbench')
  assert.equal(clarification.runtimeKey, 'requirement-node-workbench')
  assert.equal(clarification.applicable, true)

  const entry = getAvailableWorkflowComponents({
    processTypeCode: 'requirement-management',
    source: 'requirement',
    components,
    paletteComponents: REQUIREMENT_WORKBENCH_PALETTE,
    currentNode: { key: 'intake', name: '需求录入' },
    currentNodeIndex: 0,
  })
  assert.equal(entry.length, 7)
  assert.ok(entry.every((component) => component.applicable === false))
})

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

test('repairs legacy empty requirement node workbench activities before writing', () => {
  const definition = {
    schemaVersion: 2,
    nodes: [{
      key: 'schedule',
      name: '需求排期',
      fields: [],
      contentOrder: ['component:requirement-node-workbench'],
      componentConfigs: {
        'requirement-node-workbench': {
          nodeKey: 'schedule',
          nodeName: '需求排期',
          purpose: '旧配置',
          activities: [],
        },
      },
    }],
  }
  const repaired = ensureRequirementNodeWorkbenchConfigs(definition)
  assert.deepEqual(repaired.nodes[0].componentConfigs['requirement-node-workbench'].activities, [
    '确认目标对象',
    '安排计划时间',
    '确认依赖与风险',
    '形成需求排期',
  ])
  assert.equal(repaired.nodes[0].componentConfigs['requirement-node-workbench'].purpose, '旧配置')
})

test('keeps valid custom requirement node workbench activities unchanged', () => {
  const definition = {
    schemaVersion: 2,
    nodes: [{
      key: 'clarify',
      name: '需求澄清',
      fields: [],
      contentOrder: ['component:requirement-node-workbench'],
      componentConfigs: {
        'requirement-node-workbench': {
          nodeKey: 'clarify',
          nodeName: '需求澄清',
          purpose: '自定义说明',
          activities: ['自定义活动'],
        },
      },
    }],
  }
  const normalized = ensureRequirementNodeWorkbenchConfigs(definition)
  assert.strictEqual(normalized, definition)
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
