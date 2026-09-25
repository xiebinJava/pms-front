import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import path from 'node:path'

test('node completion copy does not announce the next node unlocking', () => {
  const localeFiles = [
    path.resolve(import.meta.dirname, '../../../locales/zh-CN.ts'),
    path.resolve(import.meta.dirname, '../../../locales/en-US.ts'),
  ]

  for (const filename of localeFiles) {
    const source = fs.readFileSync(filename, 'utf8')
    const completeContent = source.match(/completeContent: ['\"]([^'\"]+)/)?.[1] || ''
    const completeSuccess = source.match(/completeSuccess: ['\"]([^'\"]+)/)?.[1] || ''

    assert.doesNotMatch(`${completeContent} ${completeSuccess}`, /下一节点|解锁|next node|unlock/i)
  }
})
