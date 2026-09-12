import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeWorkflowDefinition } from './workflow-template-schema.mjs'

const legacyDefinition = {
  schemaVersion: 1,
  nodes: [{
    key: 'initiation',
    name: '项目立项与启动',
    description: '确认项目资料',
    deliverable: '立项说明',
    roles: '项目经理',
    components: ['requirement-scope', 'project-basic-info', 'solution-design'],
    projectBasicInfo: true,
    projectBasicInfoFields: [
      { key: 'description', label: '项目描述', visible: true, required: true },
      { key: 'priority', label: '优先级', visible: true, required: true },
      { key: 'projectLevel', label: '项目等级', visible: false, required: false },
      { key: 'schedule', label: '项目排期', visible: true, required: true },
      { key: 'businessLine', label: '业务线', visible: true, required: false },
      { key: 'projectManager', label: '项目经理', visible: true, required: true },
      { key: 'projectMembers', label: '项目成员', visible: true, required: true },
      { key: 'followers', label: '关注人', visible: true, required: false },
    ],
    fields: [{ key: 'risk-note', label: '风险备注', type: 'TEXTAREA', required: true, options: ['保留'] }],
  }],
}

test('preserves both v1 field positions while adapting bindings without changing custom field semantics', () => {
  const original = structuredClone(legacyDefinition)

  const definition = normalizeWorkflowDefinition(legacyDefinition)
  const node = definition.nodes[0]

  assert.equal(definition.schemaVersion, 2)
  assert.deepEqual(node.contentOrder, ['component:requirement-scope', 'fields', 'component:solution-design', 'legacy-custom-fields'])
  assert.deepEqual(node.fields.map(({ key, binding, type, visible, required }) => ({ key, binding, type, visible, required })), [
    { key: 'project-description', binding: 'project.description', type: 'TEXTAREA', visible: true, required: true },
    { key: 'project-priority', binding: 'project.priority', type: 'RADIO', visible: true, required: true },
    { key: 'project-project-level', binding: 'project.projectLevel', type: 'SINGLE_SELECT', visible: false, required: false },
    { key: 'project-schedule', binding: 'project.schedule', type: 'DATE_RANGE', visible: true, required: true },
    { key: 'project-business-line', binding: 'project.businessLine', type: 'SINGLE_SELECT', visible: true, required: false },
    { key: 'project-project-manager', binding: 'project.projectManager', type: 'PERSON', visible: true, required: true },
    { key: 'project-project-members', binding: 'project.projectMembers', type: 'PERSON_MULTI', visible: true, required: true },
    { key: 'project-followers', binding: 'project.followers', type: 'PERSON_MULTI', visible: true, required: false },
    { key: 'risk-note', binding: null, type: 'TEXTAREA', visible: true, required: true },
  ])
  assert.deepEqual(node.fields.at(-1).options, ['保留'])
  assert.deepEqual(legacyDefinition, original)
  assert.deepEqual(normalizeWorkflowDefinition(definition), definition)
})

test('generates binding keys around colliding legacy custom keys without renaming their data', () => {
  const definition = normalizeWorkflowDefinition({
    schemaVersion: 1,
    nodes: [{
      key: 'collision',
      name: '兼容字段冲突',
      components: ['project-basic-info'],
      projectBasicInfo: true,
      projectBasicInfoFields: [{ key: 'description', label: '项目描述', visible: true, required: false }],
      fields: [{ key: 'project-description', label: '旧自定义字段', type: 'TEXT', required: false, options: ['保留值'] }],
    }],
  })
  const fields = definition.nodes[0].fields

  assert.deepEqual(fields.map(({ key, binding }) => ({ key, binding })), [
    { key: 'project-description-2', binding: 'project.description' },
    { key: 'project-description', binding: null },
  ])
  assert.deepEqual(fields[1].options, ['保留值'])
  assert.deepEqual(definition.nodes[0].contentOrder, ['fields', 'legacy-custom-fields'])
})

test('does not revive project fields retained by a disabled v1 project-basic-info switch', () => {
  const definition = normalizeWorkflowDefinition({
    schemaVersion: 1,
    nodes: [{
      key: 'disabled-profile',
      name: '禁用资料区',
      components: ['requirement-scope'],
      projectBasicInfo: false,
      projectBasicInfoFields: legacyDefinition.nodes[0].projectBasicInfoFields,
      fields: [],
    }],
  })

  assert.deepEqual(definition.nodes[0].fields, [])
  assert.deepEqual(definition.nodes[0].contentOrder, ['component:requirement-scope'])
})

test('keeps an explicit disabled project-basic-info flag authoritative over a stale component marker', () => {
  const definition = normalizeWorkflowDefinition({
    schemaVersion: 1,
    nodes: [{
      key: 'disabled-marker',
      name: '禁用资料区组件标记',
      components: ['project-basic-info'],
      projectBasicInfo: false,
      projectBasicInfoFields: legacyDefinition.nodes[0].projectBasicInfoFields,
      fields: [],
    }],
  })

  assert.deepEqual(definition.nodes[0].fields, [])
  assert.deepEqual(definition.nodes[0].contentOrder, [])
})

test('uses the legacy component marker only when project-basic-info flag is absent', () => {
  const definition = normalizeWorkflowDefinition({
    schemaVersion: 1,
    nodes: [{
      key: 'legacy-marker-only',
      name: '仅旧组件标记',
      components: ['project-basic-info'],
      projectBasicInfoFields: legacyDefinition.nodes[0].projectBasicInfoFields,
      fields: [],
    }],
  })

  assert.equal(definition.nodes[0].fields.length, 8)
  assert.deepEqual(definition.nodes[0].contentOrder, ['fields'])
})
