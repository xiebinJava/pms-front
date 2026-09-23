import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
const zhLocale = fs.readFileSync(new URL('../../../locales/zh-CN.ts', import.meta.url), 'utf8')
const enLocale = fs.readFileSync(new URL('../../../locales/en-US.ts', import.meta.url), 'utf8')
const projectLocale = zhLocale + enLocale
const workflowTypes = fs.readFileSync(new URL('../../../types/workflow.ts', import.meta.url), 'utf8')

test('workflow admin labels the selector as a process-type filter', () => {
  assert.match(source, /\$t\('admin\.workflow\.processTypes'\)/)
  assert.match(source, /\$t\('admin\.workflow\.addProcessType'\)/)
  assert.match(zhLocale, /processTypes:\s*'流程类型'/)
  assert.match(zhLocale, /addProcessType:\s*'新增流程类型'/)
  assert.match(zhLocale, /description:\s*'按流程类型维护流程模板。/)
  assert.match(enLocale, /processTypes:\s*'Process types'/)
  assert.match(enLocale, /addProcessType:\s*'Add process type'/)
})

test('project creation copy remains project-type-specific', () => {
  assert.match(projectLocale, /projectType:\s*'项目类型'/)
  assert.match(projectLocale, /projectType:\s*'Project type'/)
})

test('workflow type exposes project-creation scope as optional API metadata', () => {
  assert.match(workflowTypes, /projectCreationEnabled\?: boolean/)
})
