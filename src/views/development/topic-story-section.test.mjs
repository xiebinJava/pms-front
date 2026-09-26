import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const section = fs.readFileSync(new URL('./detail/TopicStorySection.vue', import.meta.url), 'utf8')
const detailPage = fs.readFileSync(new URL('./detail/DevelopmentItemDetailPage.vue', import.meta.url), 'utf8')
const listPage = fs.readFileSync(new URL('./DevelopmentListPage.vue', import.meta.url), 'utf8')
const apiSource = fs.readFileSync(new URL('../../api/development-item.ts', import.meta.url), 'utf8')

test('topic detail loads and refreshes stories through the topic-scoped endpoint', () => {
  assert.match(section, /getDevelopmentTopicStories\(props\.topicId\)/)
  assert.match(section, /onMounted\(\(\) => \{ void load\(\) \}\)/)
  assert.match(section, /watch\(\(\) => props\.topicId, \(\) => \{ void load\(\) \}\)/)
})

test('topic story section creates stories with the current topic and keeps the list independent of project-node fields', () => {
  assert.match(section, /<DevelopmentStoryEditModal v-model:open="editorOpen" :story="null" :initial-topic-id="topicId"/)
  assert.match(section, /@saved="load"/)
  assert.match(section, /developmentList\.createStory/)
  assert.doesNotMatch(section, /projectId|nodeId/)
})

test('topic and story list/detail surfaces show only their direct source requirement', () => {
  assert.match(apiSource, /sourceRequirement\?: SourceRequirementSummary/)
  assert.match(listPage, /record\.sourceRequirement/)
  assert.match(listPage, /openRequirement\(record\.sourceRequirement\.id\)/)
  assert.match(detailPage, /detail\.sourceRequirement/)
  assert.match(detailPage, /openSourceRequirement/)
  assert.doesNotMatch(detailPage, /sourceRequirement\.sourceRequirement/)
})
