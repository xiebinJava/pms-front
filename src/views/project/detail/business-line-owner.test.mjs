import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('./index.vue', import.meta.url), 'utf8')

test('selecting a business line triggers automatic owner assignment', () => {
  assert.match(source, /@change="onBusinessLineChange"/)
  assert.match(source, /findOrgUnitById\(orgTree\.value, orgUnitId\)/)
  assert.match(source, /onNodeOwnerChange\(leaderId\)/)
})

test('business line leaders are added to the project before assigning the node owner', () => {
  assert.match(source, /addMember\(projectId\.value, \{ userId: leaderId \}\)/)
  assert.match(source, /profileForm\.memberIds = members\.value\.map/)
})
