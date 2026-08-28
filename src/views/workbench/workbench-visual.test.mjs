import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
const styleSource = fs.readFileSync(new URL('../../styles/fs-insight.css', import.meta.url), 'utf8')

test('workbench exposes the agreed work sections and responsive layout hooks', () => {
  for (const label of ['我的工作', '工作概览', '我的任务', '项目进展', '最近动态']) {
    assert.match(source, new RegExp(label))
  }
  assert.match(source, /getProjectPage/)
  assert.match(source, /getTasks/)
  assert.match(source, /getComments/)
  assert.match(source, /workbench-overview-grid/)
  assert.match(source, /workbench-content-grid/)
  assert.match(styleSource, /\.workbench-overview-grid\s*\{/)
  assert.match(styleSource, /@media \(max-width: 760px\)[\s\S]*\.workbench-content-grid/)
})
