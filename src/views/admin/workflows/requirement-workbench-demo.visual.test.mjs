import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const viewSource = fs.readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
const demoSource = fs.readFileSync(new URL('./RequirementWorkbenchDemo.vue', import.meta.url), 'utf8')

test('workflow admin exposes the editable requirement workbench demo', () => {
  assert.match(viewSource, /import RequirementWorkbenchDemo from '\/\@\/views\/admin\/workflows\/RequirementWorkbenchDemo\.vue'/)
  assert.match(viewSource, /requirementWorkbenchDemoOpen/)
  assert.match(viewSource, /<RequirementWorkbenchDemo[\s\S]*:nodes="definition\.nodes"/)
})

test('requirement workbench demo keeps the original node/detail/workbench structure', () => {
  assert.match(viewSource, /title="需求流程工作台 Demo"/)
  assert.match(demoSource, /当前内容只保存为 Demo 草稿，不会修改正式流程模板/)
  assert.match(demoSource, /需求录入/)
  assert.match(demoSource, /需求上线/)
  assert.match(demoSource, /节点填写内容/)
  assert.match(demoSource, /业务工作台/)
  assert.match(demoSource, /新增活动/)
  assert.match(demoSource, /节点任务/)
})

test('requirement clarification demo mirrors the runtime detail fields', () => {
  assert.match(demoSource, /需求背景及目标/)
  assert.match(demoSource, /需求验收标准/)
  assert.match(demoSource, /澄清结论/)
  assert.match(demoSource, /已澄清，可进入下一节点/)
  assert.match(demoSource, /const isClarificationNode = computed/)
  assert.match(demoSource, /v-if="!isClarificationNode && !isIntegrationNode && !isSchedulingNode" class="demo-workbench-card"/)
})

test('requirement integration demo mirrors the conditional integration fields', () => {
  assert.match(demoSource, /是否整合需求/)
  assert.match(demoSource, /radioField\('should-integrate'/)
  assert.match(demoSource, /multiSelectField\('requirement-ids'/)
  assert.match(demoSource, /确认需求规格/)
  assert.match(demoSource, /\['项目', '专题', '故事'\]/)
  assert.match(demoSource, /const isIntegrationNode = computed/)
  assert.match(demoSource, /showIntegrationRequirements/)
  assert.match(demoSource, /field\.key !== 'requirement-ids'/)
})
