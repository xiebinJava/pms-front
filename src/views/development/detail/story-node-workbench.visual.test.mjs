import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const workbench = fs.readFileSync(new URL('./StoryNodeWorkbenchComponent.vue', import.meta.url), 'utf8')
const testing = fs.readFileSync(new URL('./StoryTestingResultsWorkbench.vue', import.meta.url), 'utf8')
const detail = fs.readFileSync(new URL('./DevelopmentItemDetailPage.vue', import.meta.url), 'utf8')
const preview = fs.readFileSync(new URL('../../../components/workflow/WorkflowWorkbenchPreview.vue', import.meta.url), 'utf8')

test('story node workbench renders its configured variant, purpose and activities', () => {
  assert.match(workbench, /defineProps/)
  assert.match(workbench, /componentConfig/)
  assert.match(workbench, /STORY_WORKBENCH_FIELDS/)
  assert.match(workbench, /persisted\.value\.variant \|\| getStoryWorkbenchVariant/)
  assert.match(workbench, /purpose/)
  assert.match(workbench, /activities/)
  assert.match(workbench, /:data-variant="variant"/)
  assert.match(workbench, /normalizeStoryWorkbenchState/)
  assert.match(workbench, /mergeStoryWorkbenchState/)
})

test('story node workbench is read-only when disabled or previewing and commits on change', () => {
  assert.match(workbench, /readOnly = computed\(\(\) => props\.disabled \|\| props\.preview\)/)
  assert.match(workbench, /:disabled="readOnly"/)
  assert.match(workbench, /@blur="commit"/)
  assert.match(workbench, /@change="commit"/)
  assert.match(workbench, /a-date-picker/)
})

test('story testing workbench uses the story-testing store helpers', () => {
  assert.match(testing, /normalizeStoryTesting/)
  assert.match(testing, /mergeStoryTesting/)
  assert.match(testing, /storyTesting\.title/)
  assert.match(testing, /storyTesting\.addIssue/)
  assert.match(testing, /readOnly = computed/)
})

test('detail page mounts both story workbenches for story items', () => {
  assert.match(detail, /import StoryNodeWorkbenchComponent from '\.\/StoryNodeWorkbenchComponent\.vue'/)
  assert.match(detail, /import StoryTestingResultsWorkbench from '\.\/StoryTestingResultsWorkbench\.vue'/)
  assert.match(detail, /props\.itemType === 'story' && componentKey === WorkflowRuntimeComponentKey\.STORY_NODE_WORKBENCH/)
  assert.match(detail, /props\.itemType === 'story' && componentKey === WorkflowRuntimeComponentKey\.STORY_TESTING/)
  assert.match(detail, /:component-config="selectedNode\.componentConfigs\?\.\[componentKey\]"/)
})

test('template designer previews both story workbenches', () => {
  assert.match(preview, /StoryNodeWorkbenchComponent/)
  assert.match(preview, /StoryTestingResultsWorkbench/)
  assert.match(preview, /componentKey === 'story-node-workbench'/)
  assert.match(preview, /componentKey === 'story-testing'/)
  assert.match(preview, /'story-node-workbench', 'story-testing'/)
})
