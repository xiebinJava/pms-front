import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const root = new URL('../../', import.meta.url)
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8')

test('需求管理 exposes a protected list and detail route with navigation', () => {
  const router = read('router/index.ts')
  const layout = read('layout/Index.vue')
  assert.match(router, /path:\s*'development\/requirements'/)
  assert.match(router, /path:\s*'development\/requirements\/:id'/)
  assert.match(router, /itemType:\s*'requirement'/)
  assert.match(router, /permission:\s*'requirement:read'/)
  assert.match(layout, /'development-requirements':\s*'\/development\/requirements'/)
  assert.match(layout, /\$t\('nav\.requirements'\)/)
})

test('requirement mode reuses the shared list page with target filtering and three actions', () => {
  const page = read('views/development/DevelopmentListPage.vue')
  const api = read('api/development-item.ts')
  assert.match(page, /mode=requirements|DevelopmentListMode[^\n]*requirements/)
  assert.match(page, /getDevelopmentRequirementPage/)
  assert.match(page, /requirementTargetType/)
  assert.match(page, /DevelopmentRequirementEditModal/)
  assert.match(page, /editRequirement\(/)
  assert.match(page, /deleteRequirement\(/)
  assert.match(page, /const collection = isTopics\.value \? 'topics' : isRequirements\.value \? 'requirements' : 'stories'/)
  assert.match(api, /export function getDevelopmentRequirementPage\(/)
  assert.match(api, /http\.post\('\/development\/requirements\/page'/)
  assert.match(api, /export function createDevelopmentRequirement\(/)
  assert.match(api, /export function updateDevelopmentRequirement\(/)
  assert.match(api, /export function deleteDevelopmentRequirement\(/)
})

test('requirement basic editor never submits an execution target', () => {
  const modal = read('views/development/DevelopmentRequirementEditModal.vue')
  const api = read('api/development-item.ts')
  assert.match(modal, /PersonSelect/)
  assert.match(modal, /requirementTemplates/)
  assert.match(modal, /templateVersionId/)
  assert.doesNotMatch(modal, /executionTargetType|executionTargetId|targetType|targetId/)
  assert.doesNotMatch(api, /createDevelopmentRequirement[\s\S]*executionTargetType/)
})

test('requirement workflow navigation uses its own detail path and preserves the shared mutation API', () => {
  const api = read('api/development-item.ts')
  const domain = read('types/domain.ts')
  assert.match(api, /itemType === 'topic' \? 'topics' : itemType === 'story' \? 'stories' : 'requirements'/)
  assert.match(api, /itemType === 'requirement' \? `\/development\/requirements\/\$\{itemId\}/)
  assert.match(domain, /DevelopmentItemType = 'topic' \| 'story' \| 'requirement'/)
  assert.match(domain, /executionTarget\??:/)
})
