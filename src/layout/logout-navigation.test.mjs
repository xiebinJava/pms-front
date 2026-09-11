import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('./Index.vue', import.meta.url), 'utf8')

test('falls back to a full-page login navigation when client routing cannot load login', () => {
  assert.match(source, /router\.replace\(['"]\/login['"]\)\.catch\(/)
  assert.match(source, /window\.location\.replace\(['"]\/login['"]\)/)
})
