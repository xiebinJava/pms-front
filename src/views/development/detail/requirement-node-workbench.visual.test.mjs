import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const componentSource = fs.readFileSync(new URL('./RequirementNodeWorkbenchComponent.vue', import.meta.url), 'utf8')
const detailSource = fs.readFileSync(new URL('./DevelopmentItemDetailPage.vue', import.meta.url), 'utf8')

test('requirement node workbench renders the persisted node activities and purpose', () => {
  assert.match(componentSource, /componentConfig/)
  assert.match(componentSource, /activities/)
  assert.match(componentSource, /purpose/)
  assert.match(componentSource, /requirement-node-workbench/)
})

test('requirement clarification renders only its two text inputs and one conclusion select', () => {
  assert.match(componentSource, /需求背景及目标/)
  assert.match(componentSource, /需求验收标准/)
  assert.match(componentSource, /澄清结论/)
  assert.match(componentSource, /isClarification/)
  assert.match(componentSource, /@update:value/)
  assert.match(componentSource, /@blur="commit"/)
  assert.match(componentSource, /@change="commit"/)
  assert.match(componentSource, /v-else>/)
})

test('requirement integration renders conditional multi-select and specification select', () => {
  assert.match(componentSource, /isRequirementIntegrationNode/)
  assert.match(componentSource, /data-testid="requirement-integration-fields"/)
  assert.match(componentSource, /是否整合需求/)
  assert.match(componentSource, /value="YES"/)
  assert.match(componentSource, /value="NO"/)
  assert.match(componentSource, /v-if="integration\.shouldIntegrate === 'YES'"/)
  assert.match(componentSource, /选择需求/)
  assert.match(componentSource, /mode="multiple"/)
  assert.match(componentSource, /确认需求规格/)
  assert.match(componentSource, /项目.*专题.*故事/)
})

test('requirement scheduling renders a target selector from the prior specification and an expected launch range', () => {
  assert.match(componentSource, /isRequirementSchedulingNode/)
  assert.match(componentSource, /data-testid="requirement-scheduling-fields"/)
  assert.match(componentSource, /targetSpecification/)
  assert.match(componentSource, /getRequirementExecutionTargetOptions/)
  assert.match(componentSource, /目标项目/)
  assert.match(componentSource, /目标专题/)
  assert.match(componentSource, /目标故事/)
  assert.match(componentSource, /期望上线时间/)
  assert.match(componentSource, /expectedLaunchStartDate/)
  assert.match(componentSource, /expectedLaunchEndDate/)
  assert.match(componentSource, /<a-range-picker[\s\S]*value-format="YYYY-MM-DD"/)
  assert.match(componentSource, /@calendar-change="updateExpectedLaunchDateDraft"/)
  assert.match(componentSource, /@open-change="commitExpectedLaunchDateOnClose"/)
  assert.match(componentSource, /schedulingDateDraftComplete/)
  assert.match(componentSource, /if \(!schedulingDateDraftComplete\.value \|\| !startDate \|\| !endDate\)/)
  assert.match(componentSource, /v-else>/)
})

test('requirement detail page mounts the node workbench runtime component', () => {
  assert.match(detailSource, /RequirementNodeWorkbenchComponent/)
  assert.match(detailSource, /REQUIREMENT_NODE_WORKBENCH/)
  assert.match(detailSource, /componentConfigs/)
  assert.match(detailSource, /:model-value="nodeForm.fieldValues"/)
  assert.match(detailSource, /:current-requirement-id="detail\.id"/)
  assert.match(detailSource, /target-specification/)
  assert.match(detailSource, /requirementSpecification/)
  assert.match(detailSource, /@commit="saveNode"/)
})
