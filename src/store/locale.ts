import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/en'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import enUS from 'ant-design-vue/es/locale/en_US'
import { i18n, LOCALE_STORAGE_KEY, localeToHtmlLang, resolveLocale, type AppLocale } from '/@/i18n'

export const useLocaleStore = defineStore('locale', {
  state: () => ({
    locale: 'zh-CN' as AppLocale,
  }),
  getters: {
    antdLocale: (state) => (state.locale === 'en-US' ? enUS : zhCN),
  },
  actions: {
    initFromStorage() {
      const stored = typeof localStorage === 'undefined' ? null : localStorage.getItem(LOCALE_STORAGE_KEY)
      const browser = typeof navigator === 'undefined' ? '' : navigator.language
      this.setLocale(resolveLocale(stored, browser))
    },
    setLocale(locale: AppLocale) {
      this.locale = locale
      const current = i18n.global.locale as unknown as { value: AppLocale }
      current.value = locale
      dayjs.locale(locale === 'en-US' ? 'en' : 'zh-cn')
      if (typeof document !== 'undefined') {
        document.documentElement.lang = localeToHtmlLang(locale)
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCALE_STORAGE_KEY, locale)
      }
    },
  },
})
