import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const section = fs.readFileSync(new URL('./detail/TopicStorySection.vue', import.meta.url), 'utf8')

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
