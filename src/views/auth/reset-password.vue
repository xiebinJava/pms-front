<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import LocaleSwitch from '/@/components/LocaleSwitch.vue'
import { confirmPasswordReset } from '/@/api/auth'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const loading = ref(false)
const form = reactive({ password: '', confirm: '' })

async function submit() {
  if (form.password.length < 12 || form.password !== form.confirm) {
    message.error(t('auth.passwordMismatch'))
    return
  }
  loading.value = true
  try {
    await confirmPasswordReset(String(route.query.token || ''), form.password)
    message.success(t('auth.resetSuccess'))
    router.replace('/login')
  } catch (error) {
    message.error((error as Error).message || t('auth.resetFailed'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="pms-auth-page reset-page">
    <div class="pms-auth-locale">
      <LocaleSwitch />
    </div>
    <div class="pms-auth-card reset-card">
      <h1>{{ $t('auth.resetTitle') }}</h1>
      <p>{{ $t('auth.resetHint') }}</p>
      <a-form layout="vertical" @finish="submit">
        <a-form-item :label="$t('auth.newPassword')"><a-input-password v-model:value="form.password" size="large" /></a-form-item>
        <a-form-item :label="$t('auth.confirmPassword')"><a-input-password v-model:value="form.confirm" size="large" /></a-form-item>
        <a-button class="pms-primary-button" html-type="submit" block :loading="loading">{{ $t('auth.resetSubmit') }}</a-button>
      </a-form>
    </div>
  </div>
</template>

<style scoped>
.reset-card { width: min(420px, 100%); }
h1 { margin: 0 0 6px; font-size: 22px; font-weight: 720; color: var(--pms-text); }
p { margin: 0 0 24px; color: var(--pms-text-muted); font-size: 13px; line-height: 1.6; }
</style>
