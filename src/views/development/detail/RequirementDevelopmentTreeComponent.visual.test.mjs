import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const componentSource = fs.readFileSync(new URL('./RequirementDevelopmentTreeComponent.vue', import.meta.url), 'utf8')
const detailSource = fs.readFileSync(new URL('./DevelopmentItemDetailPage.vue', import.meta.url), 'utf8')
const helperSource = fs.readFileSync(new URL('../../../components/workflow/requirement-node-workbench.mjs', import.meta.url), 'utf8')

test('requirement development renders a read-only target development tree', () => {
  assert.match(componentSource, /data-testid="requirement-development-tree"/)
  assert.doesNotMatch(componentSource, /需求开发情况/)
  assert.doesNotMatch(componentSource, /requirement-development-tree__header/)
  assert.match(componentSource, /getNodeDevelopmentControl/)
  assert.match(componentSource, /getDevelopmentTopicStories/)
  assert.match(componentSource, /getDevelopmentItemWorkflow/)
  assert.match(componentSource, /if \(status === 'COMPLETED'\) return 'DONE'/)
  assert.match(componentSource, /PROJECT:/)
  assert.match(componentSource, /TOPIC:/)
  assert.match(componentSource, /STORY:/)
  assert.match(componentSource, /专题/)
  assert.match(componentSource, /故事/)
  assert.match(componentSource, /开发中|已完成|未开始/)
  assert.match(componentSource, /@click\.stop="toggleTopic\(topic\)"/)
  assert.match(componentSource, /const showRoot = computed\(\(\) => isProject\.value \|\| isTopic\.value\)/)
  assert.match(componentSource, /v-if="isProject" class="requirement-development-tree__row requirement-development-tree__row--topic"/)
  assert.match(componentSource, /v-else-if="isTopic"/)
})

test('requirement development emits auto-complete only for a non-empty completed tree', () => {
  assert.match(componentSource, /const emit = defineEmits<\{ 'all-completed': \[\] \}>\(\)/)
  assert.match(componentSource, /const hasDescendantItems = computed\(\(\) => state\.value\.topics\.some\(\(topic\) => topic\.stories\.length > 0\) \|\| state\.value\.stories\.length > 0\)/)
  assert.match(componentSource, /const allStatusesCompleted = computed\(\(\) => hasDescendantItems\.value && state\.value\.status === 'DONE'\)/)
  assert.match(componentSource, /emit\('all-completed'\)/)
})

test('requirement detail passes the prior scheduling target to the development tree', () => {
  assert.match(detailSource, /requirementDevelopmentTarget/)
  assert.match(detailSource, /RequirementDevelopmentTreeComponent/)
  assert.match(detailSource, /:target-type="requirementDevelopmentTarget\?\.targetType"/)
  assert.match(detailSource, /:target-id="requirementDevelopmentTarget\?\.targetId"/)
  assert.match(detailSource, /@all-completed="autoCompleteDevelopmentNode"/)
  assert.match(detailSource, /async function autoCompleteDevelopmentNode\(\)/)
})

test('new requirement templates use the node workbench for the development node', () => {
  assert.doesNotMatch(helperSource, /name\.includes\('需求开发'\)\) return REQUIREMENT_EXECUTION_COMPONENT/)
  assert.match(helperSource, /name\.includes\('需求开发'\)\) return REQUIREMENT_NODE_WORKBENCH_COMPONENT/)
})
