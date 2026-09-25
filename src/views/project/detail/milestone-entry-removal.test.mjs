import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('project collaboration no longer exposes the legacy milestone entry point', () => {
  const source = fs.readFileSync(path.join(import.meta.dirname, 'index.vue'), 'utf8')

  assert.doesNotMatch(source, /import Milestones from|<Milestones/)
  assert.doesNotMatch(source, /focusMilestoneId|route\.query\.milestone|key="milestones"/)
  assert.match(source, /const activeSection = ref\('gantt'\)/)
})
