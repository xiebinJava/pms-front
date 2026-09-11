import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('./index.vue', import.meta.url), 'utf8')

test('import page exposes upload, preview, completion steps and error download', () => {
  assert.match(source, /<a-steps :current="step"/)
  assert.match(source, /previewImport/)
  assert.match(source, /downloadErrors/)
  assert.match(source, /import-errors\.csv/)
  assert.match(source, /admin\.import\.done/)
})

test('import page resets the file input so the same file can be retried', () => {
  assert.match(source, /input\.value = ''/)
  assert.match(source, /watch\(type, /)
})
