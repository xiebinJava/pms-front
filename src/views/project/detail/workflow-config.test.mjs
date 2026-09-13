import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { emptyWorkflowFieldValue, isWorkflowFieldEmpty, legacyWorkflowComponents, missingConfiguredProjectFields, nodeHasComponent, nodeWorkflowContentOrder, nodeWorkflowFields, transitionActiveNode, visibleProjectFields } from './workflow-config.mjs'

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
  const savePending = detailPage.match(/async function savePendingWorkflowCustomFields\([\s\S]*?\n\}/)?.[0]

  assert.ok(activateNode)
  assert.ok(savePending)
  assert.match(activateNode, /transitionActiveNode/)
  assert.match(activateNode, /savePendingWorkflowCustomFields/)
  assert.match(savePending, /workflowCustomFieldsRef, legacyWorkflowCustomFieldsRef/)
  assert.match(customFields, /defineExpose\(\{ flushAutoSave, saveIfDirty: save \}\)/)
  assert.match(detailPage, /onBeforeRouteLeave\(async \(\) => \{[\s\S]*?savePendingProjectChanges\(\)/)
  assert.match(customFields, /:disabled="!canEdit \|\| readOnly \|\| saving"/)
  assert.match(customFields, /watch\(\(\) => \[props\.projectId, props\.nodeId\], loadValues/)
  assert.match(customFields, /if \(activeSave\) return activeSave/)
})

test('the workflow field save action persists bound project profile values and custom values together', () => {
  const detailPage = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
  const customFields = readFileSync(new URL('./components/WorkflowCustomFields.vue', import.meta.url), 'utf8')
  assert.match(customFields, /defineEmits<\{\s*\(event: 'save-requested'\): void\s*\}>/)
  assert.match(customFields, /@click="emit\('save-requested'\)"/)
  assert.match(customFields, /:disabled="!dirty && !hasPendingProfileChanges"/)
  assert.match(detailPage, /:has-pending-profile-changes="profileDirty"/)
  assert.match(detailPage, /function onWorkflowFieldsSaveRequested\(\)\s*\{\s*void savePendingProjectChanges\(\)\s*\}/)
  assert.equal((detailPage.match(/@save-requested="onWorkflowFieldsSaveRequested"/g) || []).length, 2)
})

test('project parameter changes save custom fields even when the route component is reused', () => {
  const detailPage = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
  assert.match(detailPage, /onBeforeRouteUpdate\(async \(to, from\) => \{[\s\S]*?to\.params\.id !== from\.params\.id[\s\S]*?savePendingProjectChanges\(\)/)
})

test('reused project routes persist profile edits and load the newly selected project', () => {
  const detailPage = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
  const routeUpdate = detailPage.match(/onBeforeRouteUpdate\(async \(to, from\) => \{[\s\S]*?\n\}\)/)?.[0]
  const projectWatch = detailPage.match(/watch\(projectId, \(\) => \{[\s\S]*?\n\}\)/)?.[0]

  assert.ok(routeUpdate)
  assert.match(routeUpdate, /savePendingProjectChanges\(\)/)
  assert.ok(projectWatch)
  assert.match(projectWatch, /project\.value = null/)
  assert.match(projectWatch, /nodes\.value = \[\]/)
  assert.match(projectWatch, /loadData\(\)/)
  assert.match(detailPage, /async function savePendingProjectChanges\(\)[\s\S]*?profileDirty\.value[\s\S]*?savePendingWorkflowCustomFields\(\)/)
  const loadData = detailPage.match(/async function loadData\(\) \{[\s\S]*?\n\}/)?.[0]
  assert.ok(loadData)
  assert.match(loadData, /const requestProjectId = projectId\.value/)
  assert.match(loadData, /requestSequence !== projectLoadSequence \|\| requestProjectId !== projectId\.value/)
})

test('default-owner persistence stays scoped to the project that started the request', () => {
  const detailPage = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
  const persistOwners = detailPage.match(/async function persistDefaultNodeOwners\([\s\S]*?\n\}/)?.[0]

  assert.ok(persistOwners)
  assert.match(persistOwners, /const requestProjectId = project\.value\.id/)
  assert.match(persistOwners, /updateNodeOwner\(requestProjectId, assignment\.node\.id/)
  assert.match(persistOwners, /if \(project\.value\?\.id !== requestProjectId\) return/)
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

test('keeps v1 bound fields at the profile position and unbound fields after workbenches', () => {
  const node = {
    nodeKey: 'kickoff',
    components: ['requirement-scope', 'project-basic-info', 'solution-design'],
    projectBasicInfo: true,
    projectBasicInfoFields: [{ key: 'description', label: '项目描述', visible: true, required: true }],
    fields: [{ key: 'risk', label: '风险', type: 'TEXT', required: true, options: [] }],
  }

  assert.deepEqual(nodeWorkflowContentOrder(node), [
    'component:requirement-scope', 'fields', 'component:solution-design', 'legacy-custom-fields',
  ])
  assert.deepEqual(nodeWorkflowFields(node).map(({ key, binding, visible }) => ({ key, binding, visible })), [
    { key: 'project-description', binding: 'project.description', visible: true },
    { key: 'risk', binding: null, visible: true },
  ])
  assert.deepEqual(nodeWorkflowFields(node, 'fields').map((field) => field.key), ['project-description'])
  assert.deepEqual(nodeWorkflowFields(node, 'legacy-custom-fields').map((field) => field.key), ['risk'])
})

test('keeps legacy custom keys intact when a v1 runtime binding key collides', () => {
  const node = {
    nodeKey: 'kickoff',
    components: ['project-basic-info'],
    projectBasicInfo: true,
    projectBasicInfoFields: [{ key: 'description', label: '项目描述', visible: true, required: false }],
    fields: [{ key: 'project-description', label: '旧字段', type: 'TEXT', required: false, options: [] }],
  }
  const fields = nodeWorkflowFields(node)

  assert.deepEqual(fields.map(({ key, binding }) => ({ key, binding })), [
    { key: 'project-description-2', binding: 'project.description' },
    { key: 'project-description', binding: null },
  ])
  assert.deepEqual(fields[1].options, [])
  assert.deepEqual(nodeWorkflowFields(node, 'fields').map((field) => field.key), ['project-description-2'])
  assert.deepEqual(nodeWorkflowFields(node, 'legacy-custom-fields').map((field) => field.key), ['project-description'])
})

test('uses v2 content order and excludes hidden required bindings from completion checks', () => {
  const fields = [
    { key: 'hidden-description', label: '项目描述', type: 'TEXTAREA', required: true, options: [], visible: false, binding: 'project.description' },
    { key: 'manager', label: '经理', type: 'PERSON', required: true, options: [], visible: true, binding: 'project.projectManager' },
  ]
  const node = { contentOrder: ['component:requirement-scope', 'fields'], fields }

  assert.deepEqual(nodeWorkflowContentOrder(node), ['component:requirement-scope', 'fields'])
  assert.deepEqual(missingConfiguredProjectFields(fields, { description: '', projectManagerId: undefined }), ['projectManager'])
})

test('ordinary v2 definitions keep bound and unbound fields together in the fields slot', () => {
  const node = {
    contentOrder: ['fields'],
    fields: [
      { key: 'project-description', label: '项目描述', type: 'TEXTAREA', required: false, options: [], binding: 'project.description' },
      { key: 'risk', label: '风险', type: 'TEXT', required: false, options: [], binding: null },
    ],
  }

  assert.deepEqual(nodeWorkflowFields(node, 'fields').map((field) => field.key), ['project-description', 'risk'])
})

test('supplies empty values for each selectable and ranged control', () => {
  assert.equal(emptyWorkflowFieldValue('RADIO'), null)
  assert.deepEqual(emptyWorkflowFieldValue('PERSON_MULTI'), [])
  assert.deepEqual(emptyWorkflowFieldValue('DATE_RANGE'), [])
  assert.equal(isWorkflowFieldEmpty(emptyWorkflowFieldValue('DATE_RANGE')), true)
})

test('unified custom field grid renders bound slots and the new controls without persisting bindings', () => {
  const source = readFileSync(new URL('./components/WorkflowCustomFields.vue', import.meta.url), 'utf8')
  assert.match(source, /<slot v-if="field\.binding" name="bound-field" :field="field" \/>/)
  assert.match(source, /field\.type === 'RADIO'/)
  assert.match(source, /field\.type === 'PERSON_MULTI'/)
  assert.match(source, /field\.type === 'DATE_RANGE'/)
  assert.match(source, /filter\(\(field\) => !field\.binding\)/)
  const loadBlock = source.slice(source.indexOf('async function loadValues()'), source.indexOf('function markDirty()'))
  assert.match(loadBlock, /if \(!editableFields\.value\.length\) \{[\s\S]*?return/)
})

test('optional required fields can be saved as a draft and checked when completing', () => {
  const source = readFileSync(new URL('./components/WorkflowCustomFields.vue', import.meta.url), 'utf8')
  const saveBlock = source.slice(source.indexOf('async function save()'), source.indexOf('async function flushAutoSave()'))
  const completionBlock = source.slice(source.indexOf('async function flushAutoSave()'), source.indexOf('async function onFileSelected'))
  assert.doesNotMatch(saveBlock, /validateRequired\(\)/)
  assert.match(completionBlock, /if \(dirty\.value && !\(await save\(\)\)\) return false/)
  assert.ok(completionBlock.indexOf('return validateRequired()') > completionBlock.indexOf('save()'))
})

test('requirement refresh eligibility follows component identity on custom-key nodes', async () => {
  const { shouldRefreshRequirements } = await import('./workflow-config.mjs')
  assert.equal(typeof shouldRefreshRequirements, 'function')
  assert.equal(shouldRefreshRequirements({ nodeKey: 'custom-intake', components: ['requirement-scope'] }), true)
  assert.equal(shouldRefreshRequirements({ nodeKey: 'requirement', components: ['solution-design'] }), false)
  assert.equal(shouldRefreshRequirements({ nodeKey: 'requirement' }), true)

  const taskKanban = readFileSync(new URL('./components/TaskKanban.vue', import.meta.url), 'utf8')
  const refresh = taskKanban.slice(taskKanban.indexOf('async function refreshRequirements()'), taskKanban.indexOf('async function onWorkPanelChanged()'))
  assert.match(refresh, /shouldRefreshRequirements\(props\.node\)/)
})

test('removing an attachment preserves other unsaved node field values', async () => {
  const { removeWorkflowAttachmentState } = await import('./workflow-config.mjs')
  assert.equal(typeof removeWorkflowAttachmentState, 'function')
  const next = removeWorkflowAttachmentState(
    { brief: 'unsaved text', files: [11, 12], otherFiles: [21] },
    { files: [{ id: 12 }], otherFiles: [{ id: 21 }] },
    'files',
    11,
  )

  assert.deepEqual(next.values, { brief: 'unsaved text', files: [12], otherFiles: [21] })
  assert.deepEqual(next.attachments, { files: [{ id: 12 }], otherFiles: [{ id: 21 }] })

  const component = readFileSync(new URL('./components/WorkflowCustomFields.vue', import.meta.url), 'utf8')
  const deletion = component.slice(component.indexOf('function onDeleteAttachment'), component.indexOf('async function onDownload'))
  assert.match(deletion, /removeWorkflowAttachmentState/)
  assert.match(deletion, /const unsavedValues = \{ \.\.\.values\.value \}/)
  assert.ok(deletion.indexOf('await loadValues()') < deletion.indexOf('removeWorkflowAttachmentState'))
  assert.match(deletion, /dirty\.value = true/)
})
