<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import LocaleSwitch from '/@/components/LocaleSwitch.vue'
import { confirmPasswordReset } from '/@/api/auth'

import { useUserStore } from '/@/store/user'

const props = defineProps<{ firstLogin?: boolean }>()
const store = useUserStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const loading = ref(false)
const form = reactive({ current: '', password: '', confirm: '' })
const passwordRules = computed(() => [
  { required: true, message: t('auth.passwordMismatch') },
  { min: 12, message: t('auth.passwordMismatch') },
])
const confirmRules = computed(() => [
  { required: true, message: t('auth.passwordMismatch') },
  {
    validator: async (_rule: unknown, value: string) => {
      if (value !== form.password) return Promise.reject(t('auth.passwordMismatch'))
    },
  },
])

async function signOut() {
  await store.logout()
  await router.replace('/login')
}

async function submit() {
  if (form.password.length < 12 || form.password !== form.confirm) {
    message.error(t('auth.passwordMismatch'))
    return
  }
  loading.value = true
  try {
    if (props.firstLogin) {
      await store.changePassword(form.current, form.password)
    } else {
      await confirmPasswordReset(String(route.query.token || ''), form.password)
    }
    message.success(t('auth.resetSuccess'))
    router.replace('/login')
  } catch (error) {
    message.error((error as Error).message || t(props.firstLogin ? 'auth.changeFailed' : 'auth.resetFailed'))
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
      <h1>{{ $t(firstLogin ? 'auth.firstPasswordTitle' : 'auth.resetTitle') }}</h1>
      <p>{{ $t(firstLogin ? 'auth.firstPasswordHint' : 'auth.resetHint') }}</p>
      <a-form layout="vertical" :model="form" @finish="submit">
        <a-form-item v-if="firstLogin" :label="$t('layout.currentPassword')" name="current" :rules="[{ required: true, message: $t('layout.currentPassword') }]">
          <a-input-password v-model:value="form.current" size="large" autocomplete="current-password" />
        </a-form-item>
        <a-form-item :label="$t('auth.newPassword')" name="password" :rules="passwordRules">
          <a-input-password v-model:value="form.password" size="large" autocomplete="new-password" />
        </a-form-item>
        <a-form-item :label="$t('auth.confirmPassword')" name="confirm" :rules="confirmRules">
          <a-input-password v-model:value="form.confirm" size="large" autocomplete="new-password" />
        </a-form-item>
        <a-button class="pms-primary-button" html-type="submit" block :loading="loading">{{ $t(firstLogin ? 'layout.changePassword' : 'auth.resetSubmit') }}</a-button>
        <a-button v-if="firstLogin" type="link" block @click="signOut">{{ $t('layout.logout') }}</a-button>
      </a-form>
    </div>
  </div>
</template>

<style scoped>
.reset-card { width: min(420px, 100%); }
h1 { margin: 0 0 6px; font-size: 22px; font-weight: 720; color: var(--pms-text); }
p { margin: 0 0 24px; color: var(--pms-text-muted); font-size: 13px; line-height: 1.6; }
</style>
