<script setup lang="ts">
import { useLocaleStore } from '/@/store/locale'
import type { AppLocale } from '/@/i18n'

const localeStore = useLocaleStore()

function choose(locale: AppLocale) {
  localeStore.setLocale(locale)
}
</script>

<template>
  <div class="pms-locale-switch" role="group" :aria-label="$t('locale.switch')">
    <button
      type="button"
      :class="{ 'is-active': localeStore.locale === 'zh-CN' }"
      :aria-pressed="localeStore.locale === 'zh-CN'"
      @click="choose('zh-CN')"
    >
      {{ $t('locale.zh') }}
    </button>
    <button
      type="button"
      :class="{ 'is-active': localeStore.locale === 'en-US' }"
      :aria-pressed="localeStore.locale === 'en-US'"
      @click="choose('en-US')"
    >
      {{ $t('locale.en') }}
    </button>
  </div>
</template>
