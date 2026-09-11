<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { theme } from 'ant-design-vue'
import { useLocaleStore } from '/@/store/locale'
import { designTokens } from './styles/design-system'
import './styles/pms-theme.css'

const route = useRoute()
const { t, locale } = useI18n()
const localeStore = useLocaleStore()

const themeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: designTokens.primary,
    colorInfo: designTokens.primary,
    colorLink: designTokens.primary,
    colorSuccess: designTokens.success,
    colorError: designTokens.danger,
    colorWarning: designTokens.warning,
    colorTextBase: designTokens.text,
    colorText: designTokens.text,
    colorTextSecondary: designTokens.textMuted,
    colorTextTertiary: designTokens.textFaint,
    colorTextQuaternary: '#B6C0CC',
    colorBorder: designTokens.border,
    colorBorderSecondary: designTokens.border,
    colorBgLayout: designTokens.background,
    colorBgContainer: designTokens.surface,
    colorFillAlter: designTokens.surfaceMuted,
    borderRadius: designTokens.radius,
    borderRadiusSM: designTokens.radius,
    controlHeight: 36,
    fontSize: designTokens.fontSize.body,
  },
}

const antdLocale = computed(() => localeStore.antdLocale)

watch(
  [() => route.meta.titleKey, locale],
  () => {
    const titleKey = route.meta.titleKey
    document.title = titleKey ? `${t(titleKey)} · ${t('app.titleSuffix')}` : t('app.name')
  },
  { immediate: true },
)
</script>

<template>
  <a-config-provider :theme="themeConfig" :locale="antdLocale">
    <router-view />
  </a-config-provider>
</template>
