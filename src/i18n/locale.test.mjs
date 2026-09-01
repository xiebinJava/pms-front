import assert from 'node:assert/strict'
import test from 'node:test'
import { createI18n } from 'vue-i18n'
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

test('email examples render without Vue-i18n linked-message compilation errors', () => {
  const messages = { 'zh-CN': zhCN, 'en-US': enUS }
  for (const locale of Object.keys(messages)) {
    const instance = createI18n({ legacy: false, locale, messages })
    const errors = []
    const originalError = console.error
    console.error = (...args) => errors.push(args)
    try {
      assert.match(instance.global.t('login.emailPlaceholder'), /name@example\.com/)
      assert.match(instance.global.t('admin.users.emailPlaceholder'), /name@example\.com/)
    } finally {
      console.error = originalError
    }
    assert.deepEqual(errors, [], `${locale} should not emit message compilation errors`)
  }
})
