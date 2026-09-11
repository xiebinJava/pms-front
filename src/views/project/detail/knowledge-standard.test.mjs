import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import path from 'node:path'

import {
  getKnowledgeActionSummary,
  getKnowledgeAssetSummary,
  getKnowledgeStatusLabel,
} from './knowledge-standard.ts'

test('summarizes knowledge assets and improvement actions', () => {
  assert.deepEqual(getKnowledgeAssetSummary([
    { name: '启动模板', status: 'UPDATED' },
    { name: '发布清单', status: 'REVIEW' },
    { name: '改造案例', status: 'RETAINED' },
  ]), { total: 3, ready: 2 })

  assert.deepEqual(getKnowledgeActionSummary([
    { title: '前置评审', status: 'DONE' },
    { title: '更新清单', status: 'IN_PROGRESS' },
    { title: '建立检索', status: 'NOT_STARTED' },
  ]), { total: 3, completed: 1 })
})

test('maps knowledge action statuses to stable display labels', () => {
  assert.equal(getKnowledgeStatusLabel('DONE'), '已完成')
  assert.equal(getKnowledgeStatusLabel('IN_PROGRESS'), '进行中')
  assert.equal(getKnowledgeStatusLabel('NOT_STARTED'), '待开始')
})

test('mounts the knowledge workbench only for the knowledge node and keeps archive out', () => {
  const detail = fs.readFileSync(path.join(import.meta.dirname, 'index.vue'), 'utf8')
  const workbench = fs.readFileSync(path.join(import.meta.dirname, 'components/KnowledgeStandardWorkbench.vue'), 'utf8')
  const api = fs.readFileSync(path.join(import.meta.dirname, '../../../api/node-knowledge-standard.ts'), 'utf8')

  assert.match(detail, /KnowledgeStandardWorkbench/)
  assert.match(detail, /activeNode\.nodeKey === 'knowledge'/)
  assert.match(workbench, /标准与知识资产/)
  assert.match(workbench, /改进行动清单/)
  assert.match(workbench, /@focusout="handleWorkbenchFocusOut"/)
  assert.match(workbench, /target\.matches\('input, textarea, \[role="combobox"\]'\)/)
  assert.doesNotMatch(workbench, /@blur="scheduleAutoSave"/)
  assert.match(workbench, /新增改进行动/)
  assert.match(workbench, /DeleteOutlined/)
  const actionsTable = workbench.slice(workbench.indexOf('knowledge-standard-table--actions'), workbench.indexOf('a-modal'))
  assert.match(actionsTable, /action\.title/)
  assert.doesNotMatch(actionsTable, /行动说明（可选）/)
  assert.doesNotMatch(actionsTable, /v-model:value="action\.note"/)
  assert.match(workbench, /draftAction\.note/)
  assert.doesNotMatch(workbench, /来源节点|例如：发布决策与运营交接/)
  assert.doesNotMatch(workbench, /文档归档与发布|archiveSection|文档归档/)
  assert.match(api, /knowledge-standard/)
})
