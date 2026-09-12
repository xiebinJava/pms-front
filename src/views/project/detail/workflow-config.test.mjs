import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { emptyWorkflowFieldValue, isWorkflowFieldEmpty, legacyWorkflowComponents, missingConfiguredProjectFields, nodeHasComponent, visibleProjectFields } from './workflow-config.mjs'

test('workflow components follow published definitions and retain legacy project compatibility', () => {
  assert.equal(nodeHasComponent({ nodeKey: 'requirement', components: ['solution-design'] }, 'solution-design'), true)
  assert.equal(nodeHasComponent({ nodeKey: 'requirement', components: ['solution-design'] }, 'requirement-scope'), false)
  assert.equal(nodeHasComponent({ nodeKey: 'requirement' }, 'requirement-scope'), true)
  assert.equal(nodeHasComponent({ nodeKey: 'custom-stage' }, 'requirement-scope'), false)
  assert.deepEqual(legacyWorkflowComponents.kickoff, ['project-basic-info'])
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
