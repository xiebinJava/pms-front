import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const modal = fs.readFileSync(new URL('./DevelopmentStoryEditModal.vue', import.meta.url), 'utf8')
const api = fs.readFileSync(new URL('../../api/development-item.ts', import.meta.url), 'utf8')

test('story editor keeps topic optional and never accepts an independent project or node context', () => {
  assert.match(modal, /form\.topicId = story\?\.topicId \?\? props\.initialTopicId \?\? null/)
  assert.match(modal, /<a-form-item v-if="!lockTopic" :label="t\('developmentList\.storyTopic'\)">/)
  assert.doesNotMatch(modal, /<a-form-item v-else :label="t\('developmentList\.storyTopic'\)">/)
  assert.doesNotMatch(modal, /storyTopicLocked/)
  assert.match(modal, /const topicId = props\.lockTopic \? props\.initialTopicId \?\? props\.story\?\.topicId \?\? null : form\.topicId/)
  assert.match(modal, /topicId/)
  assert.match(modal, /<PersonSelect v-model="form\.ownerId"/)
  assert.doesNotMatch(modal, /projectId|nodeId/)
})

test('story editor uses the story collection API for independent and topic-bound stories', () => {
  assert.match(api, /export function createDevelopmentStory\([\s\S]*topicId: number \| null/)
  assert.match(api, /export function updateDevelopmentStory\([\s\S]*topicId: number \| null/)
  assert.match(api, /http\.post\('\/development\/stories', payload\)/)
  assert.match(api, /http\.put\(`\/development\/stories\/\$\{id\}`, payload\)/)
})

test('story editor exposes a selectable workflow template and submits its published version', () => {
  assert.match(modal, /getDevelopmentWorkflowTemplateOptions/)
  assert.match(modal, /templateVersionId/)
  assert.match(modal, /developmentList\.storyWorkflowTemplate/)
  assert.match(api, /templateVersionId\?: number/)
})
