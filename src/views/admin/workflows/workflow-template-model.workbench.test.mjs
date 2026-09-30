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

test('dedicated topic design review workbench is isolated and only applicable on its node', () => {
  const components = [{ key: 'topic-design-review', workbenchTypes: ['topic'], processTypeCodes: ['topic-management'] }]
  const options = (source, code, name) => getAvailableWorkflowComponents({ source, processTypeCode: code, components, currentNode: { name } })
  assert.equal(options('topic', 'topic-management', '方案设计与评审')[0].applicable, true)
  assert.equal(options('topic', 'topic-management', '需求调研')[0].applicable, false)
  for (const [source, code] of [['project', 'general'], ['requirement', 'requirement-management'], ['story', 'story-management']])
    assert.deepEqual(options(source, code, '方案设计与评审'), [])
})

test('topic palette excludes project and retired story split workbenches while retaining story list and saved bindings', () => {
  const keys = ['requirement-scope', 'solution-design', 'plan-resource-risk', 'development-control', 'business-acceptance', 'release-handover', 'value-review', 'knowledge-standard', 'story-split', 'story-list']
  const components = keys.map((key) => ({ key, workbenchTypes: ['project', 'topic'] }))
  const currentNode = { name: '需求调研', contentOrder: ['component:solution-design'] }
  assert.deepEqual(getAvailableWorkflowComponents({ processTypeCode: 'topic-management', source: 'topic', components, currentNode }).map((item) => item.key), ['story-list'])
  assert.deepEqual(currentNode.contentOrder, ['component:solution-design'])
  assert.deepEqual(getAvailableWorkflowComponents({ processTypeCode: 'story-management', source: 'story', components, currentNode }), [])
})

test('project nodes only allow their corresponding workbench without changing existing bindings', () => {
  const pairs = [
    ['需求澄清与范围基线', 'requirement-scope'], ['方案设计、评审与决策', 'solution-design'],
    ['计划、资源与风险基线', 'plan-resource-risk'], ['开发测试与项目控制', 'development-control'],
    ['业务验收与缺陷闭环', 'business-acceptance'], ['发布决策与运营交接', 'release-handover'],
    ['价值验证与项目复盘', 'value-review'], ['知识沉淀与标准改进', 'knowledge-standard'],
  ]
  const components = pairs.map(([, key]) => ({ key, workbenchTypes: ['project'] }))
  for (const [name, key] of pairs) {
    const currentNode = { name, contentOrder: ['component:solution-design'] }
    const result = getAvailableWorkflowComponents({ processTypeCode: 'general', source: 'project', components, currentNode })
    assert.deepEqual(result.filter((item) => item.applicable).map((item) => item.key), [key])
    assert.deepEqual(currentNode.contentOrder, ['component:solution-design'])
  }
  assert.ok(getAvailableWorkflowComponents({ processTypeCode: 'general', source: 'project', components, currentNode: { name: '项目立项与启动' } }).every((item) => !item.applicable))
})

test('renaming a bound project node keeps its workbench marked applicable by identity', () => {
  const currentNode = { key: 'stable-control', name: '项目控制', contentOrder: ['component:development-control'] }
  const result = getAvailableWorkflowComponents({ processTypeCode: 'general', source: 'project',
    components: [{ key: 'development-control', workbenchTypes: ['project'] }], currentNode })
  assert.equal(result[0].applicable, true)
  assert.deepEqual(currentNode.contentOrder, ['component:development-control'])
})

test('lists six requirement workbenches without the redundant release entry', () => {
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
  assert.equal(entry.length, 6)
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
