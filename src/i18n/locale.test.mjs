import assert from 'node:assert/strict'
import test from 'node:test'
import { isAppLocale, localeToHtmlLang, resolveLocale } from './locale.ts'
import enUS from '../locales/en-US.ts'
import zhCN from '../locales/zh-CN.ts'

function flatten(value, prefix = '') {
  if (!value || typeof value !== 'object') return [prefix]
  return Object.entries(value).flatMap(([key, child]) => {
    const next = prefix ? `${prefix}.${key}` : key
    return typeof child === 'object' && child !== null ? flatten(child, next) : [next]
  })
}

test('zh-CN and en-US locale trees share the same keys', () => {
  assert.deepEqual(flatten(zhCN).sort(), flatten(enUS).sort())
})

test('resolveLocale prefers a stored choice then English browsers', () => {
  assert.equal(resolveLocale('en-US', 'zh-CN'), 'en-US')
  assert.equal(resolveLocale('zh-CN', 'en-US'), 'zh-CN')
  assert.equal(resolveLocale(null, 'en-GB'), 'en-US')
  assert.equal(resolveLocale(undefined, 'zh-CN'), 'zh-CN')
  assert.equal(isAppLocale('fr-FR'), false)
  assert.equal(localeToHtmlLang('en-US'), 'en')
})
