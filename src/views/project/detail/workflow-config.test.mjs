import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { emptyWorkflowFieldValue, isWorkflowFieldEmpty, legacyWorkflowComponents, missingConfiguredProjectFields, nodeHasComponent, transitionActiveNode, visibleProjectFields } from './workflow-config.mjs'

test('workflow components follow published definitions and retain legacy project compatibility', () => {
  assert.equal(nodeHasComponent({ nodeKey: 'requirement', components: ['solution-design'] }, 'solution-design'), true)
  assert.equal(nodeHasComponent({ nodeKey: 'requirement', components: ['solution-design'] }, 'requirement-scope'), false)
  assert.equal(nodeHasComponent({ nodeKey: 'requirement' }, 'requirement-scope'), true)
  assert.equal(nodeHasComponent({ nodeKey: 'custom-stage' }, 'requirement-scope'), false)
  assert.deepEqual(legacyWorkflowComponents.kickoff, ['project-basic-info'])
})

test('saves pending node data before switching and stays put when saving fails', async () => {
  const events = []
  const blocked = await transitionActiveNode(1, 2, async () => {
    events.push('save')
    return false
  }, (nodeId) => events.push(`select:${nodeId}`))

  assert.equal(blocked, false)
  assert.deepEqual(events, ['save'])

  const switched = await transitionActiveNode(1, 2, async () => {
    events.push('save')
    return true
  }, (nodeId) => events.push(`select:${nodeId}`))

  assert.equal(switched, true)
  assert.deepEqual(events, ['save', 'save', 'select:2'])
})

test('does not save or reselect the already active node', async () => {
  const events = []
  const switched = await transitionActiveNode(3, 3, () => events.push('save'), (nodeId) => events.push(nodeId))

  assert.equal(switched, true)
  assert.deepEqual(events, [])
})

test('node navigation waits for custom field persistence before replacing the editor', () => {
  const detailPage = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
  const customFields = readFileSync(new URL('./components/WorkflowCustomFields.vue', import.meta.url), 'utf8')
  const activateNode = detailPage.match(/async function activateNode\([\s\S]*?\n\}/)?.[0]

  assert.ok(activateNode)
  assert.match(activateNode, /transitionActiveNode/)
  assert.match(activateNode, /saveIfDirty/)
  assert.match(customFields, /defineExpose\(\{ flushAutoSave, saveIfDirty: save \}\)/)
  assert.match(detailPage, /onBeforeRouteLeave\(async \(\) => \{[\s\S]*?saveIfDirty\(\)/)
  assert.match(customFields, /:disabled="!canEdit \|\| readOnly \|\| saving"/)
  assert.match(customFields, /watch\(\(\) => \[props\.projectId, props\.nodeId\], loadValues/)
  assert.match(customFields, /if \(activeSave\) return activeSave/)
})

test('project parameter changes save custom fields even when the route component is reused', () => {
  const detailPage = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
  assert.match(detailPage, /onBeforeRouteUpdate\(async \(to, from\) => \{[\s\S]*?to\.params\.id !== from\.params\.id[\s\S]*?saveIfDirty\(\)/)
})

test('project basics use configured visibility and requiredness, with the canonical fallback', () => {
  const fields = [
    { key: 'businessLine', label: '业务线', visible: true, required: true },
    { key: 'description', label: '项目描述', visible: false, required: false },
  ]
  assert.deepEqual(visibleProjectFields(fields).map((field) => field.key), ['businessLine'])
  assert.deepEqual(visibleProjectFields([]), [])
  assert.deepEqual(visibleProjectFields(undefined).map((field) => field.key), [
    'description', 'priority', 'projectLevel', 'schedule', 'businessLine', 'projectManager', 'projectMembers', 'followers',
  ])
})

test('only configured required project fields block node completion', () => {
  const fields = [
    { key: 'description', visible: false, required: false },
    { key: 'businessLine', visible: true, required: true },
    { key: 'projectManager', visible: true, required: true },
  ]
  assert.deepEqual(missingConfiguredProjectFields(fields, { orgUnitId: undefined, projectManagerId: undefined }), ['businessLine', 'projectManager'])
  assert.deepEqual(missingConfiguredProjectFields(fields, { orgUnitId: 4, projectManagerId: 12 }), [])
})

test('optional field defaults are valid for backend field-type validation', () => {
  assert.equal(emptyWorkflowFieldValue('DATE'), null)
  assert.equal(emptyWorkflowFieldValue('SINGLE_SELECT'), null)
  assert.deepEqual(emptyWorkflowFieldValue('MULTI_SELECT'), [])
  assert.equal(emptyWorkflowFieldValue('TEXT'), '')
  assert.equal(isWorkflowFieldEmpty('  '), true)
  assert.equal(isWorkflowFieldEmpty([]), true)
  assert.equal(isWorkflowFieldEmpty(0), false)
})

test('optional required fields can be saved as a draft and checked when completing', () => {
  const source = readFileSync(new URL('./components/WorkflowCustomFields.vue', import.meta.url), 'utf8')
  const saveBlock = source.slice(source.indexOf('async function save()'), source.indexOf('async function flushAutoSave()'))
  const completionBlock = source.slice(source.indexOf('async function flushAutoSave()'), source.indexOf('async function onFileSelected'))
  assert.doesNotMatch(saveBlock, /validateRequired\(\)/)
  assert.match(completionBlock, /if \(dirty\.value && !\(await save\(\)\)\) return false/)
  assert.ok(completionBlock.indexOf('return validateRequired()') > completionBlock.indexOf('save()'))
})
