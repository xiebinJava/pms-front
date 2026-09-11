import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
const picker = fs.readFileSync(new URL('./components/BusinessLineSelect.vue', import.meta.url), 'utf8')

test('selecting a business line does not assign the node owner', () => {
  assert.match(source, /BusinessLineSelect/)
  assert.match(source, /field\.key === 'businessLine'/)
  assert.match(source, /class="project-detail-root"/)
  assert.match(source, /businessLineDisplay/)
  assert.match(source, /getBusinessLineDisplay/)
  assert.doesNotMatch(source, /project\.orgUnitPath \|\| project\.orgUnitName/)
  assert.doesNotMatch(source, /a-cascader/)
  assert.doesNotMatch(source, /onBusinessLineChange/)
  assert.doesNotMatch(source, /onNodeOwnerChange\(leaderId\)/)
  assert.doesNotMatch(source, /autoAssignFailed/)
})

test('business line picker uses a trigger-width tree and selects on click', () => {
  assert.match(picker, /@mouseenter="onHover\(row\)"/)
  assert.match(picker, /@click="onSelect\(row\)"/)
  assert.match(picker, /getBusinessLineTreeRows/)
  assert.match(picker, /filterBusinessLineOptions/)
  assert.match(picker, /<Teleport to="body">/)
  assert.match(picker, /const width = Math.round\(rect.width\)/)
  assert.match(picker, /position: fixed/)
  assert.match(picker, /detail.searchBusinessLine/)
  assert.doesNotMatch(picker, /getBusinessLinePanelWidth/)
  assert.doesNotMatch(picker, /watch\(hoverPath/)
  assert.doesNotMatch(picker, /expand-trigger/)
})
