import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const componentSource = fs.readFileSync(new URL('./RequirementNodeWorkbenchComponent.vue', import.meta.url), 'utf8')
const detailSource = fs.readFileSync(new URL('./DevelopmentItemDetailPage.vue', import.meta.url), 'utf8')
const previewSource = fs.readFileSync(new URL('../../../components/workflow/WorkflowWorkbenchPreview.vue', import.meta.url), 'utf8')

test('acceptance replaces activities with two autosaving sections and a matching template preview', () => {
  const runtime = componentSource.split('<template v-else-if="isAcceptance">')[1]?.split('<template v-else>')[0]
  const preview = previewSource.split('<template v-else-if="isRequirementNodeWorkbench && isRequirementAcceptance">')[1]?.split('<template v-else-if="isRequirementNodeWorkbench">')[0]
  assert.ok(runtime)
  assert.ok(preview)
  for (const source of [runtime, preview]) {
    assert.match(source, /业务确认结果/)
    assert.match(source, /记录遗留问题/)
    assert.doesNotMatch(source, /本节点活动|节点工作台/)
  }
  assert.equal((runtime.match(/<a-textarea/g) || []).length, 2)
  assert.equal((runtime.match(/<a-select/g) || []).length, 1)
  assert.equal((runtime.match(/@blur="commit"/g) || []).length, 2)
  assert.match(runtime, /@change="commit"/)
  assert.match(runtime, /:disabled="disabled"/)
  assert.match(runtime, /新增问题/)
  assert.match(runtime, /v-for="\(issue, index\) in acceptance.residualIssues"/)
  assert.match(runtime, /a-popconfirm/)
})

test('requirement node workbench renders the persisted node activities and purpose', () => {
  assert.match(componentSource, /componentConfig/)
  assert.match(componentSource, /activities/)
  assert.match(componentSource, /purpose/)
  assert.match(componentSource, /requirement-node-workbench/)
})

test('requirement clarification renders system selection, two text inputs, and one conclusion select', () => {
  assert.match(componentSource, /需求背景及目标/)
  assert.match(componentSource, /需求验收标准/)
  assert.match(componentSource, /澄清结论/)
  assert.match(componentSource, /所属系统/)
  assert.match(componentSource, /getSystemPage/)
  assert.match(componentSource, /systemId/)
  assert.match(componentSource, /receivingCategory/)
  assert.match(componentSource, /systemFieldVisible/)
  assert.match(componentSource, /visibleWhenCategory\?/)
  assert.match(detailSource, /requirementReceivingCategory/)
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
