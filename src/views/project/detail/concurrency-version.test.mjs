import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const detailRoot = path.resolve(import.meta.dirname)
const frontRoot = path.resolve(detailRoot, '../../../..')

function read(relativePath) {
  return fs.readFileSync(path.join(frontRoot, relativePath), 'utf8')
}

test('editor APIs carry the latest entity version on writes', () => {
  assert.match(read('src/api/project.ts'), /version\??: number/)
  assert.match(read('src/api/task.ts'), /moveTask\(id: number, status: number, version: number\)/)
  assert.match(read('src/api/node.ts'), /version: number/)
  assert.match(read('src/types/domain.ts'), /interface Project[\s\S]*?version\??: number/)
  assert.match(read('src/types/domain.ts'), /interface Task[\s\S]*?version\??: number/)
  assert.match(read('src/types/domain.ts'), /interface ProjectNode[\s\S]*?version\??: number/)
})

test('project and task editors retain local edits when a save conflicts', () => {
  const projectDetail = read('src/views/project/detail/index.vue')
  const taskKanban = read('src/views/project/detail/components/TaskKanban.vue')

  assert.match(projectDetail, /version: project\.value!?\.version/)
  assert.match(projectDetail, /apiErrorMessage\(error/)
  assert.match(taskKanban, /version: modalState\.version/)
  assert.match(taskKanban, /apiErrorMessage\(error/)
})
