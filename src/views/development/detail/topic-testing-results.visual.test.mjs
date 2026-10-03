import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const workbench = fs.readFileSync(new URL('./TopicTestingResultsWorkbench.vue', import.meta.url), 'utf8')
const storyList = fs.readFileSync(new URL('./DevelopmentStoryListComponent.vue', import.meta.url), 'utf8')
const detail = fs.readFileSync(new URL('./DevelopmentItemDetailPage.vue', import.meta.url), 'utf8')
const preview = fs.readFileSync(new URL('../../../components/workflow/WorkflowWorkbenchPreview.vue', import.meta.url), 'utf8')
const designer = fs.readFileSync(new URL('../../../views/admin/workflows/index.vue', import.meta.url), 'utf8')

test('testing workbench renders build version, status, report link and issue rows', () => {
  assert.match(workbench, /topicTesting\.buildVersion/)
  assert.match(workbench, /topicTesting\.status/)
  assert.match(workbench, /topicTesting\.reportUrl/)
  assert.match(workbench, /topicTesting\.issues/)
  assert.match(workbench, /topicTesting\.addIssue/)
  assert.match(workbench, /topicTesting\.noIssues/)
  assert.match(workbench, /v-for="\(issue, index\) in state\.residualIssues"/)
  assert.match(workbench, /residualIssues\.length >= 100/)
  assert.match(workbench, /crypto\.randomUUID\(\)/)
})

test('testing workbench only accepts the four persisted statuses and commits on blur or change', () => {
  const statuses = workbench.match(/NOT_STARTED|IN_PROGRESS|PASSED|FAILED/g) || []
  assert.ok(statuses.length >= 4)
  assert.ok(new Set(statuses.filter(value => !value.includes('statuses'))).has('PASSED'))
  assert.match(workbench, /@change="update"/)
  assert.match(workbench, /@blur="commit"/)
  assert.match(workbench, /@change="commit"/)
  assert.match(workbench, /normalizeTopicTesting/)
  assert.match(workbench, /mergeTopicTesting/)
})

test('testing workbench disables every control when read-only or previewing', () => {
  assert.match(workbench, /readOnly = computed\(\(\) => props\.disabled \|\| props\.preview\)/)
  const disabledCount = (workbench.match(/:disabled="readOnly"/g) || []).length
  assert.ok(disabledCount >= 3, `expected at least 3 readOnly-disabled controls, got ${disabledCount}`)
  assert.match(workbench, /if \(readOnly\.value \|\| state\.residualIssues\.length >= 100\) return/)
  assert.match(workbench, /if \(readOnly\.value\) return/)
})

test('story list mounts the testing workbench only when the template enables it', () => {
  assert.match(storyList, /TopicTestingResultsWorkbench/)
  assert.match(storyList, /v-if="testingResultsEnabled"/)
  assert.match(storyList, /:model-value="modelValue"/)
  assert.match(storyList, /@update:model-value="emit\('update:modelValue', \$event\)"/)
  assert.match(storyList, /@commit="emit\('commit'\)"/)
  assert.match(storyList, /:disabled="!canEdit"/)
  assert.match(storyList, /if \(props\.preview\) return/)
  assert.match(storyList, /testingResultsEnabled \? 'developmentDetail\.topicTesting\.storyTitle' : 'developmentDetail\.storyListTitle'/)
})

test('detail page passes the runtime component config and the node form values into the story workbench', () => {
  assert.match(detail, /isTestingResultsEnabled\(selectedNode\.componentConfigs\?\.\[componentKey\]\)/)
  assert.match(detail, /:testing-results-enabled="isTestingResultsEnabled\(selectedNode\.componentConfigs\?\.\[componentKey\]\)"/)
  assert.match(detail, /:model-value="nodeForm\.fieldValues"/)
  assert.match(detail, /@update:model-value="onNodeFieldValuesChange"/)
  assert.match(detail, /@commit="saveNode"/)
})

test('template designer previews the story workbench with the testing toggle state', () => {
  assert.match(preview, /DevelopmentStoryListComponent/)
  assert.match(preview, /isTestingResultsEnabled\(componentConfig\)/)
  assert.match(preview, /:testing-results-enabled="isTestingResultsEnabled\(componentConfig\)"/)
  assert.match(preview, /:can-edit="false"/)
  assert.match(preview, /preview/)
  assert.match(preview, /\[.topic-research., .topic-design-review., .story-list.\].includes\(componentKey\)/)
})

test('template designer exposes the testing toggle only for topic story-list nodes', () => {
  assert.match(designer, /topic-testing-config/)
  assert.match(designer, /setTopicTestingEnabled\(checkboxChecked\(\$event\)\)/)
  assert.match(designer, /configureTopicTesting\(currentNode\.value, enabled\)/)
  assert.match(designer, /selectedType\?\.code === 'topic-management' && configuredComponents\.includes\(WorkflowRuntimeComponentKey\.STORY_LIST\)/)
  assert.match(designer, /isTestingResultsEnabled\(componentConfig\(WorkflowRuntimeComponentKey\.STORY_LIST\)\)/)
})