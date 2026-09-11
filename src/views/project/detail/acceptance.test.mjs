import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { isAcceptanceComplete } from './acceptance.ts'

test('requires every acceptance item to pass', () => {
  const base = {
    result: 'PASS',
    residualItems: '',
    items: [{ result: 'PASS' }, { result: 'PASS' }],
  }

  assert.equal(isAcceptanceComplete(base), true)
  assert.equal(isAcceptanceComplete({ ...base, items: [{ result: 'PASS' }, { result: 'PENDING' }] }), false)
  assert.equal(isAcceptanceComplete({ ...base, result: 'CONDITIONAL_PASS', residualItems: '' }), false)
  assert.equal(isAcceptanceComplete({ ...base, result: 'CONDITIONAL_PASS', residualItems: '上线后观察' }), true)
})

test('mounts the acceptance workbench without a separate reopen endpoint', () => {
  const detailRoot = path.resolve(import.meta.dirname)
  const page = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')
  const api = fs.readFileSync(path.join(detailRoot, '../../../api/node-acceptance.ts'), 'utf8')
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/AcceptanceWorkbench.vue'), 'utf8')
  assert.match(page, /AcceptanceWorkbench/)
  assert.match(page, /activeNode\.nodeKey === 'acceptance'/)
  assert.match(api, /acceptance/)
  assert.match(api, /confirmNodeAcceptance/)
  assert.doesNotMatch(api, /reopenNodeAcceptance|\/reopen/)
  assert.doesNotMatch(workbench, /reopenNodeAcceptance|onReopen|reopening|ReloadOutlined/)
  assert.match(workbench, /detail\.acceptance\.linkDefect/)
  assert.match(workbench, /detail\.acceptance\.createDefect/)
  assert.match(workbench, /acceptance-tooltip-trigger/)
  assert.doesNotMatch(workbench, /关闭缺陷|解决缺陷|修改缺陷状态|resolveDefect|updateDefectStatus/)
})

test('keeps acceptance inputs visible while warning about a changed requirement baseline', () => {
  const detailRoot = path.resolve(import.meta.dirname)
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/AcceptanceWorkbench.vue'), 'utf8')

  assert.match(workbench, /v-if="!loadError && state\.sourceBaselineChanged"/)
  assert.match(workbench, /v-if="!loadError && loading"/)
  assert.match(workbench, /v-if="!loadError && !loading"/)
})

test('saves the acceptance workbench after an editable control loses focus', () => {
  const detailRoot = path.resolve(import.meta.dirname)
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/AcceptanceWorkbench.vue'), 'utf8')
  assert.match(workbench, /@focusout="handleWorkbenchFocusOut"/)
  assert.match(workbench, /target\.matches\('input, textarea, \[role="combobox"\]'\)/)
  assert.doesNotMatch(workbench, /watch\(state,/)
  assert.doesNotMatch(workbench, /!saving\.value/)
})

test('does not render a separate acceptance checklist footer', () => {
  const detailRoot = path.resolve(import.meta.dirname)
  const workbench = fs.readFileSync(path.join(detailRoot, 'components/AcceptanceWorkbench.vue'), 'utf8')

  assert.doesNotMatch(workbench, /<div class="acceptance-footer">/)
})
