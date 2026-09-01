import { createI18n } from 'vue-i18n'
import enUS from '/@/locales/en-US'
import zhCN, { type MessageSchema } from '/@/locales/zh-CN'
import type { AppLocale } from './locale'

export { LOCALE_STORAGE_KEY, SUPPORT_LOCALES, isAppLocale, localeToHtmlLang, resolveLocale } from './locale'
export type { AppLocale } from './locale'

export const i18n = createI18n<[MessageSchema], AppLocale>({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
})

export function t(key: string, values?: Record<string, unknown>) {
  return i18n.global.t(key, values as Record<string, string>)
}
