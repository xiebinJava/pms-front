import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const root = new URL('../../', import.meta.url)
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8')

test('研发管理 exposes independent topic and story list routes', () => {
  const router = read('router/index.ts')
  const layout = read('layout/Index.vue')
  assert.match(router, /path:\s*'development\/topics'/)
  assert.match(router, /path:\s*'development\/stories'/)
  assert.match(layout, /'development-topics':\s*'\/development\/topics'/)
  assert.match(layout, /'development-stories':\s*'\/development\/stories'/)
  assert.match(layout, /\$t\('nav\.topics'\)/)
  assert.match(layout, /\$t\('nav\.stories'\)/)
})

test('development list page renders the project-style aggregate table and routes to its source node', () => {
  const source = read('views/development/DevelopmentListPage.vue')
  const api = read('api/development-item.ts')
  assert.match(source, /getDevelopmentTopicPage|getDevelopmentStoryPage/)
  assert.match(source, /a-table/)
  assert.match(source, /分页|pagination/)
  assert.match(source, /router\.push\(\{ path: `\/projects\/\$\{record\.projectId\}`/)
  assert.match(source, /query:\s*\{ node: String\(record\.nodeId\) \}/)
  assert.match(api, /\/development\/topics\/page/)
  assert.match(api, /\/development\/stories\/page/)
})

test('topic and story rows keep the project and owner visible while opening the source node from the project link', () => {
  const source = read('views/development/DevelopmentListPage.vue')
  assert.match(source, /record\.projectName/)
  assert.match(source, /record\.ownerName/)
  assert.match(source, /record\.status/)
  assert.match(source, /function openSource\(record: DevelopmentRow\)/)
  assert.match(source, /query:\s*\{ node: String\(record\.nodeId\) \}/)
  assert.doesNotMatch(source, /record\.nodeName/)
})

test('development list follows the project workbench page pattern', () => {
  const source = read('views/development/DevelopmentListPage.vue')
  assert.match(source, /:eyebrow="t\('developmentList\.eyebrow'\)"/)
  assert.match(source, /pagination\.total/)
  assert.match(source, /#emptyText/)
  assert.match(source, /development-list-page__table-scroll/)
  assert.doesNotMatch(source, /development-list-page__view-switch|onViewChange/)
  assert.match(source, /t\('common\.refresh'\)/)
})

test('development list uses translated state text and responsive filter geometry', () => {
  const source = read('views/development/DevelopmentListPage.vue')
  const zh = read('locales/zh-CN.ts')
  assert.match(source, /statusLabel/)
  assert.match(source, /development-list-page__search/)
  assert.match(source, /development-list-page__status-select/)
  assert.match(source, /developmentList\.emptyTitle/)
  assert.doesNotMatch(source, /record\.testStatus \|\| ''/)
  assert.match(zh, /developmentList:\s*\{[\s\S]*eyebrow:/)
  assert.match(zh, /developmentList:\s*\{[\s\S]*emptyTitle:/)
})

test('development filter controls use a flex row with explicit spacing and alignment', () => {
  const source = read('views/development/DevelopmentListPage.vue')
  assert.match(source, /\.pms-table-toolbar__filters\s*\{[^}]*display:\s*flex/)
  assert.match(source, /\.pms-table-toolbar__filters\s*\{[^}]*align-items:\s*center/)
  assert.match(source, /\.pms-table-toolbar__filters\s*\{[^}]*gap:\s*8px/)
})

test('topic and story lists omit redundant identifiers, icons, subtitles, and topic build columns', () => {
  const source = read('views/development/DevelopmentListPage.vue')
  assert.doesNotMatch(source, /FolderOpenOutlined|FileTextOutlined/)
  assert.doesNotMatch(source, /#\{\{\s*record\.id\s*\}\}/)
  assert.doesNotMatch(source, /record\.projectCode\s*\|\|\s*''\}\s*·/)
  assert.doesNotMatch(source, /developmentList\.workflow\.\$\{record\.workflowStatus\}/)
  assert.doesNotMatch(source, /developmentProgress,\s*\{ progress: record\.developmentProgress \}/)
  assert.doesNotMatch(source, /developmentList\.build/)
  assert.match(source, /developmentList\.storyCount/)
})

test('topic actions are detail, edit, and delete; deleted topics can be restored and stories stay detail-only', () => {
  const source = read('views/development/DevelopmentListPage.vue')
  assert.match(source, /DevelopmentTopicEditModal/)
  assert.match(source, /editTopic\(/)
  assert.match(source, /deleteTopic\(/)
  assert.match(source, /restoreTopic\(/)
  assert.match(source, /deletedScope/)
  assert.match(source, /t\('common\.detail'\)/)
  assert.match(source, /v-if="isTopic\(record\)"/)
})

test('topic list passes deleted scope and exposes typed edit, soft-delete, restore, and paged project APIs', () => {
  const source = read('views/development/DevelopmentListPage.vue')
  const api = read('api/development-item.ts')
  assert.match(source, /deleted:\s*deletedScope\.value/)
  assert.match(api, /deleted\?:\s*boolean/)
  assert.match(api, /http\.put\(`\/development\/topics\/\$\{id\}`/)
  assert.match(api, /http\.delete\(`\/development\/topics\/\$\{id\}`/)
  assert.match(api, /http\.post\(`\/development\/topics\/\$\{id\}\/restore`/)
  assert.match(api, /\/development\/topics\/projects\/page/)
  assert.match(source, /deleteDevelopmentTopic/)
  assert.match(source, /restoreDevelopmentTopic/)
})

test('topic editor keeps project binding only, preserves an ineligible current project, and explains rebinding effects', () => {
  const source = read('views/development/DevelopmentTopicEditModal.vue')
  const zh = read('locales/zh-CN.ts')
  assert.match(source, /getDevelopmentTopicProjectOptions/)
  assert.match(source, /currPage:\s*requestedPage/)
  assert.match(source, /pageSize:\s*projectPageSize/)
  assert.match(source, /disabled:\s*option\.projectId === current\?\.projectId/)
  assert.match(source, /if \(topic\) await updateDevelopmentTopic\(topic\.id, payload\)/)
  assert.doesNotMatch(source, /nodeId:\s*form\.|节点\s*<a-select/)
  assert.match(source, /requestSequence !== projectRequestSequence/)
  assert.match(source, /topicRebindHint/)
  assert.match(zh, /topicRebindHint:.*专题流程模板指定的项目节点.*里程碑关联及迭代关联会清除/)
})

test('topic mutations confirm soft deletion and reload the previous page when the last row disappears', () => {
  const source = read('views/development/DevelopmentListPage.vue')
  const zh = read('locales/zh-CN.ts')
  assert.match(source, /Modal\.confirm\(/)
  assert.match(source, /deleteTopicContent/)
  assert.match(source, /record\.storyCount/)
  assert.match(source, /await deleteDevelopmentTopic\(record\.id\)/)
  assert.match(source, /await restoreDevelopmentTopic\(record\.id\)/)
  assert.match(source, /pagination\.current -= 1/)
  assert.match(zh, /deleteTopicContent:.*\{title\}.*\{count\}.*隐藏，不会物理删除/)
})

test('topic list always exposes create action while deleted scope keeps row mutations restricted', () => {
  const page = read('views/development/DevelopmentListPage.vue')
  const modal = read('views/development/DevelopmentTopicEditModal.vue')
  const zh = read('locales/zh-CN.ts')
  assert.match(page, /<a-button[^>]*type="primary"[^>]*@click="isTopics \? createTopic\(\) : createStory\(\)"/)
  assert.doesNotMatch(page, /<a-button[^>]*v-if="!deletedScope"[^>]*@click="isTopics \? createTopic\(\) : createStory\(\)"/)
  assert.match(page, /developmentList\.createTopic/)
  assert.match(page, /developmentList\.createStory/)
  assert.match(page, /function createTopic\(/)
  assert.match(modal, /createDevelopmentTopic\(/)
  assert.match(modal, /if \(topic\) await updateDevelopmentTopic\(topic\.id, payload\)/)
  assert.match(modal, /else await createDevelopmentTopic\(payload\)/)
  assert.match(modal, /:title="t\(props\.topic\s*\?\s*'developmentList\.editTopicTitle'\s*:\s*'developmentList\.createTopicTitle'\)"/)
  assert.match(zh, /createTopic:\s*'创建专题'/)
})

test('topic creation uses a dedicated API call to the topic collection endpoint', () => {
  const api = read('api/development-item.ts')
  assert.match(api, /export function createDevelopmentTopic\(/)
  assert.match(api, /http\.post\('\/development\/topics',\s*payload\)/)
})

test('topic form retains a selected eligible project while the user searches other options', () => {
  const source = read('views/development/DevelopmentTopicEditModal.vue')
  assert.match(source, /selectedEligibleProjectId/)
  assert.match(source, /projectChanged\.value\).*selectedEligibleProjectId\.value !== form\.projectId/)
})

test('topic form allows an independent topic while owner selection remains company-wide', () => {
  const source = read('views/development/DevelopmentTopicEditModal.vue')
  const projectField = source.indexOf(`<a-form-item :label="t('developmentList.topicProject')">`)
  const ownerField = source.indexOf(`<a-form-item :label="t('developmentList.topicOwner')">`)
  assert.ok(projectField >= 0 && ownerField > projectField)
  assert.doesNotMatch(source, /:disabled="form\.projectId == null \|\| membersLoading"/)
  assert.doesNotMatch(source, /developmentList\.topicOwnerNeedsProject/)
  assert.match(source, /projectId: form\.projectId \?\? null/)
})

test('topic editor exposes a selectable workflow template and refreshes eligible projects for it', () => {
  const source = read('views/development/DevelopmentTopicEditModal.vue')
  const api = read('api/development-item.ts')
  assert.match(source, /getDevelopmentWorkflowTemplateOptions/)
  assert.match(source, /templateVersionId/)
  assert.match(source, /developmentList\.topicWorkflowTemplate/)
  assert.match(api, /templateVersionId\?: number/)
})

test('development list uses a grouped toolbar, responsive table shell, and accessible row actions', () => {
  const source = read('views/development/DevelopmentListPage.vue')
  assert.match(source, /pms-table-toolbar/)
  assert.match(source, /pms-project-table-scroll/)
  assert.match(source, /role="group"[^>]*:aria-label="t\('common\.actions'\)"/)
  assert.match(source, /pms-project-row-actions/)
})

test('development lists reuse the project list visual contracts without a second color system', () => {
  const source = read('views/development/DevelopmentListPage.vue')
  assert.match(source, /pms-project-view-switch/)
  assert.match(source, /pms-project-table-scroll/)
  assert.match(source, /pms-project-button--secondary/)
  assert.match(source, /pms-project-row-actions/)
  assert.doesNotMatch(source, /development-list-page__toolbar/)
  assert.doesNotMatch(source, /development-list-page__table-heading/)
  assert.doesNotMatch(source, /development-list-page__actions|development-list-page__action--primary/)
})

test('development aggregate tables use one horizontal scroll owner', () => {
  const source = read('views/development/DevelopmentListPage.vue')
  assert.match(source, /class="pms-table-scroll pms-project-table-scroll development-list-page__table-scroll"/)
  assert.doesNotMatch(source, /<a-table[^>]*:scroll=/)
})
