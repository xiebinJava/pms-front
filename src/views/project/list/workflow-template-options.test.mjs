import test from 'node:test'
import assert from 'node:assert/strict'
import { getWorkflowTemplateVersionOptions } from './workflow-template-options.mjs'

test('offers every published version and marks the exact default version', () => {
  const options = getWorkflowTemplateVersionOptions([
    { id: 3, projectTypeId: 7, name: 'Standard', publishedVersions: [{ id: 31, versionNo: 1 }, { id: 32, versionNo: 2 }] },
    { id: 4, projectTypeId: 8, name: 'Other type', publishedVersions: [{ id: 41, versionNo: 1 }] },
  ], 7, 31)

  assert.deepEqual(options.map(({ id, templateName, versionNo, isDefault }) => ({ id, templateName, versionNo, isDefault })), [
    { id: 31, templateName: 'Standard', versionNo: 1, isDefault: true },
    { id: 32, templateName: 'Standard', versionNo: 2, isDefault: false },
  ])
})

test('treats missing published-version lists as an empty set', () => {
  assert.deepEqual(getWorkflowTemplateVersionOptions([{ id: 3, projectTypeId: 7, name: 'Draft' }], 7, undefined), [])
})
