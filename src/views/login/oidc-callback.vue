<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import LocaleSwitch from '/@/components/LocaleSwitch.vue'
import { consumeOidcRedirect, oidcCallbackParams } from '/@/auth/sso'
import { useUserStore } from '/@/store/user'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const userStore = useUserStore()
const pending = ref(true)

onMounted(async () => {
  const params = oidcCallbackParams(route.query)
  if (params.error || !params.code || !params.state) {
    message.error(t('login.oidcFailed'))
    pending.value = false
    await router.replace('/login')
    return
  }
  try {
    await userStore.loginOidc(params.code, params.state)
    message.success(t('login.success'))
    await router.replace(consumeOidcRedirect())
  } catch (error) {
    message.error((error as Error)?.message || t('login.oidcFailed'))
    pending.value = false
    await router.replace('/login')
  }
})
</script>

<template>
  <div class="pms-auth-page pms-login-page">
    <div class="pms-auth-locale">
      <LocaleSwitch />
    </div>
    <div class="pms-auth-card pms-login-card">
      <div class="pms-login-heading">
        <div class="pms-login-logo">P</div>
        <h1>{{ $t('login.title') }}</h1>
        <p>{{ pending ? $t('login.oidcPending') : $t('login.oidcFailed') }}</p>
      </div>
      <a-button type="primary" class="pms-primary-button pms-login-submit" block disabled :loading="pending">
        {{ $t('login.oidcPending') }}
      </a-button>
    </div>
  </div>
</template>

<style scoped>
.pms-login-card { width: min(400px, 100%); }
.pms-login-heading { display: flex; flex-direction: column; align-items: center; margin-bottom: 28px; }
.pms-login-logo {
  display: grid; width: 44px; height: 44px; margin-bottom: 14px; place-items: center;
  color: #fff; background: var(--pms-primary); border-radius: 8px; font-weight: 750;
}
.pms-login-heading h1 { margin: 0; color: var(--pms-text); font-size: var(--pms-font-size-title); font-weight: 720; }
.pms-login-heading p { margin: 5px 0 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.pms-login-submit { height: 42px; border-radius: 6px !important; font-weight: 650; }
</style>
