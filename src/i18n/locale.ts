export const SUPPORT_LOCALES = ['zh-CN', 'en-US'] as const
export type AppLocale = (typeof SUPPORT_LOCALES)[number]
export const LOCALE_STORAGE_KEY = 'pms.locale'

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === 'zh-CN' || value === 'en-US'
}

export function resolveLocale(stored: string | null | undefined, browserLanguage = ''): AppLocale {
  if (isAppLocale(stored)) return stored
  return browserLanguage.toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN'
}

export function localeToHtmlLang(locale: AppLocale): string {
  return locale === 'en-US' ? 'en' : 'zh-CN'
}
