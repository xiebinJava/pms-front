import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_PROJECT_BASIC_INFO_FIELDS,
  FIXED_NODE_BLOCKS,
  addWorkflowField,
  createWorkflowNode,
  moveWorkflowContentItem,
  moveWorkflowField,
  moveWorkflowNode,
  removeWorkflowField,
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
  assert.deepEqual(first.fields, [])
  assert.deepEqual(first.contentOrder, [])
  assert.equal(Object.hasOwn(first, 'components'), false)
  assert.equal(Object.hasOwn(first, 'projectBasicInfo'), false)
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

test('adds fields with unique keys and creates the fields content item only when needed', () => {
  const node = { ...nodes[0], contentOrder: ['component:requirement-scope'], fields: [{ key: 'risk', label: '风险', type: 'TEXT', required: false, options: [] }] }
  const next = addWorkflowField(node, { key: 'risk', label: '风险说明', type: 'TEXTAREA' })

  assert.equal(next.fields.at(-1).key, 'risk-2')
  assert.equal(next.fields.at(-1).visible, true)
  assert.equal(next.fields.at(-1).binding, null)
  assert.deepEqual(next.contentOrder, ['component:requirement-scope', 'fields'])
  assert.deepEqual(node.contentOrder, ['component:requirement-scope'])
})

test('moves fields and content items immutably and removes fields content after the last field is deleted', () => {
  const node = {
    ...nodes[0],
    fields: [
      { key: 'first', label: '第一项', type: 'TEXT', required: false, options: [] },
      { key: 'second', label: '第二项', type: 'TEXT', required: false, options: [] },
    ],
    contentOrder: ['component:requirement-scope', 'fields', 'component:solution-design'],
  }
  const movedFields = moveWorkflowField(node, 'second', 0)
  const movedContent = moveWorkflowContentItem(movedFields, 'fields', 2)
  const oneRemaining = removeWorkflowField(movedContent, 'first')
  const empty = removeWorkflowField(oneRemaining, 'second')

  assert.deepEqual(movedFields.fields.map((field) => field.key), ['second', 'first'])
  assert.deepEqual(movedContent.contentOrder, ['component:requirement-scope', 'component:solution-design', 'fields'])
  assert.deepEqual(empty.fields, [])
  assert.deepEqual(empty.contentOrder, ['component:requirement-scope', 'component:solution-design'])
  assert.deepEqual(node.fields.map((field) => field.key), ['first', 'second'])
})

test('removing the last legacy custom field clears only its compatibility slot', () => {
  const node = {
    ...nodes[0],
    fields: [
      { key: 'project-description', label: '项目描述', type: 'TEXTAREA', required: false, options: [], binding: 'project.description' },
      { key: 'legacy-note', label: '旧备注', type: 'TEXT', required: false, options: [], binding: null },
    ],
    contentOrder: ['fields', 'component:solution-design', 'legacy-custom-fields'],
  }

  const withoutLegacyField = removeWorkflowField(node, 'legacy-note')
  const withoutAnyFields = removeWorkflowField(withoutLegacyField, 'project-description')

  assert.deepEqual(withoutLegacyField.contentOrder, ['fields', 'component:solution-design'])
  assert.deepEqual(withoutLegacyField.fields.map((field) => field.key), ['project-description'])
  assert.deepEqual(withoutAnyFields.contentOrder, ['component:solution-design'])
  assert.deepEqual(withoutAnyFields.fields, [])
})

test('confirms before a type switch can clear an unsaved workflow draft', () => {
  const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
  const handler = source.match(/async function changeProjectType\([\s\S]*?\n\}/)?.[0]
  assert.ok(handler)
  assert.ok(handler.indexOf('confirmDiscard') < handler.indexOf('selectedTypeId.value = typeId'))
})

test('confirms before leaving the workflow editor with unsaved changes', () => {
  const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
  assert.match(source, /onBeforeRouteLeave\(async \(\) => \{[\s\S]*?return confirmDiscard\(\)/)
})

test('new templates normalize the persisted base definition rather than discarded editor state', () => {
  const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
  const handler = source.match(/async function newTemplate\(\)[\s\S]*?\n\}/)?.[0]

  assert.ok(handler)
  assert.ok(handler.indexOf('confirmDiscard') < handler.indexOf('getWorkflowTemplate(base.id)'))
  assert.match(handler, /normalizeWorkflowDefinition\(baseTemplate\.definition\)\.nodes/)
  assert.doesNotMatch(handler, /structuredClone\(toRaw\(definition\.value\.nodes\)\)/)
})

test('existing workflow drafts send the revision loaded by the editor', () => {
  const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
  const handler = source.match(/async function saveDraft\(\)[\s\S]*?\n\}/)?.[0]

  assert.ok(handler)
  assert.match(handler, /expectedDraftRevision:\s*selectedTemplateSummary\.value\?\.draftRevision\s*\?\?\s*null/)
})

test('ignores stale workflow template list and detail responses after a newer selection', () => {
  const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
  assert.match(source, /let templateListRequestSequence\s*=\s*0/)
  assert.match(source, /let templateDetailRequestSequence\s*=\s*0/)
  const loadTemplates = source.match(/async function loadTemplates\([\s\S]*?\n\}/)?.[0]
  const selectTemplate = source.match(/async function selectTemplate\([\s\S]*?\n\}/)?.[0]
  assert.ok(loadTemplates)
  assert.ok(selectTemplate)
  assert.match(loadTemplates, /requestSequence !== templateListRequestSequence \|\| typeId !== selectedTypeId\.value/)
  assert.match(selectTemplate, /requestSequence !== templateDetailRequestSequence \|\| typeId !== selectedTypeId\.value/)
})

test('changing project type clears the previous type editor before loading its templates', () => {
  const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
  const changeType = source.match(/async function changeProjectType\([\s\S]*?\n\}/)?.[0]
  assert.ok(changeType)
  assert.match(changeType, /selectedTypeId\.value = typeId[\s\S]*?templates\.value = \[\][\s\S]*?clearEditor\(\)[\s\S]*?await loadTemplates\(\)/)
})

test('draft save snapshots edits and refuses to publish a stale draft', () => {
  const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
  const saveDraft = source.match(/async function saveDraft\(\)[\s\S]*?\n\}/)?.[0]
  const publish = source.match(/async function publish\(\)[\s\S]*?\n\}/)?.[0]
  assert.ok(saveDraft)
  assert.ok(publish)
  assert.match(saveDraft, /const editRevision = templateEditSequence/)
  assert.match(saveDraft, /definition: JSON\.parse\(JSON\.stringify\(definition\.value\)\)/)
  assert.match(saveDraft, /dirty\.value = templateEditSequence !== editRevision/)
  assert.doesNotMatch(saveDraft, /await loadTemplates\(saved\.id\)/)
  assert.match(publish, /if \(dirty\.value\).*?return/s)
  assert.match(source, /class="workflow-editor"[^>]*:inert="saving \|\| loading"/)
})

test('uses write responses as the source of truth for saved and published template versions', () => {
  const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
  const saveDraft = source.match(/async function saveDraft\(\)[\s\S]*?\n\}/)?.[0]
  const publish = source.match(/async function publish\(\)[\s\S]*?\n\}/)?.[0]
  const setDefault = source.match(/async function setAsDefault\(\)[\s\S]*?\n\}/)?.[0]
  const upsertSummary = source.match(/function upsertTemplateSummary\([\s\S]*?\n\}/)?.[0]
  assert.ok(saveDraft)
  assert.ok(publish)
  assert.ok(setDefault)
  assert.ok(upsertSummary)
  assert.match(saveDraft, /upsertTemplateSummary\(saved\)/)
  assert.match(upsertSummary, /draftRevision:\s*template\.draftRevision/)
  assert.match(publish, /const published = await publishWorkflowTemplate\(templateId\)/)
  assert.match(publish, /upsertTemplateSummary\(published\)/)
  assert.match(setDefault, /const updatedType = await setWorkflowDefault\(typeId, versionId\)/)
  assert.match(setDefault, /defaultTemplateVersionId:\s*updatedType\.defaultTemplateVersionId/)
})

test('node preview shows fixed sections and configured components and fields', () => {
  const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
  assert.match(source, /preview-owner-schedule/)
  assert.match(source, /preview-task-board/)
  assert.match(source, /preview-component-card/)
  assert.match(source, /currentNode\.fields/)
})
