<script setup lang="ts">
import { theme } from 'ant-design-vue'
import { designTokens } from './styles/design-system'
import './styles/fs-insight.css'

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
</script>

<template>
  <a-config-provider :theme="themeConfig">
    <router-view />
  </a-config-provider>
</template>
