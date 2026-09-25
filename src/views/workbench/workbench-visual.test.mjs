import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
const styleSource = fs.readFileSync(new URL('../../styles/pms-theme.css', import.meta.url), 'utf8')

test('workbench exposes the agreed work sections and responsive layout hooks', () => {
  for (const key of ['workbench.pageTitle', 'workbench.overview', 'workbench.myTasks', 'workbench.projects', 'workbench.activity']) {
    assert.match(source, new RegExp(key.replace('.', '\\.')))
  }
  assert.match(source, /getWorkbench/)
  assert.match(source, /openTask/)
  assert.doesNotMatch(source, /getProjectPage/)
  assert.doesNotMatch(source, /Promise\.allSettled/)
  assert.match(source, /workbench-overview-grid/)
  assert.match(source, /workbench-content-grid/)
  assert.match(styleSource, /\.workbench-overview-grid\s*[,{]/)
  assert.match(styleSource, /@media \(max-width: 760px\)[\s\S]*\.workbench-content-grid/)
})

test('a workbench reload failure keeps already loaded cards', () => {
  assert.match(source, /catch \(error\) \{\s*errorMessage\.value = getErrorMessage/)
  assert.doesNotMatch(source, /catch \(error\) \{[\s\S]*projects\.value = \[\]/)
  assert.doesNotMatch(source, /catch \(error\) \{[\s\S]*myTasks\.value = \[\]/)
  assert.doesNotMatch(source, /catch \(error\) \{[\s\S]*summary\.value = emptySummary/)
})
