<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { LockOutlined, MailOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import LocaleSwitch from '/@/components/LocaleSwitch.vue'
import { listAuthProviders, startOidc } from '/@/api/auth'
import { apiErrorMessage } from '/@/plugins/http'
import { ldapEnabled, localPasswordEnabled, oidcProvider, rememberOidcRedirect } from '/@/auth/sso'
import type { AuthProvider } from '/@/auth/sso'
import { useUserStore } from '/@/store/user'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const userStore = useUserStore()

const form = reactive({ email: '', password: '' })
const loading = ref(false)
const ssoLoading = ref(false)
const providers = ref<AuthProvider[]>([])
const emailRules = computed(() => [{ required: true, type: 'email' as const, message: t('login.emailRequired') }])
const passwordRules = computed(() => [{ required: true, message: t('login.passwordRequired') }])
const showLocal = computed(() => localPasswordEnabled(providers.value))
const showLdap = computed(() => ldapEnabled(providers.value))
const oidc = computed(() => oidcProvider(providers.value))

onMounted(async () => {
  try {
    providers.value = await listAuthProviders()
  } catch {
    providers.value = []
  }
})

async function completeLogin(action: () => Promise<void>) {
  loading.value = true
  try {
    await action()
    message.success(t('login.success'))
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch (error) {
    message.error(apiErrorMessage(error, t('login.failed')))
  } finally {
    loading.value = false
  }
}

async function onFinish() {
  if (showLocal.value) {
    await completeLogin(() => userStore.login(form.email, form.password))
    return
  }
  if (showLdap.value) {
    await completeLogin(() => userStore.loginLdap(form.email, form.password))
  }
}

async function onLdap() {
  await completeLogin(() => userStore.loginLdap(form.email, form.password))
}

async function onOidc() {
  ssoLoading.value = true
  try {
    rememberOidcRedirect((route.query.redirect as string) || '/')
    const start = await startOidc()
    window.location.assign(start.authorizationUrl)
  } catch (error) {
    message.error((error as Error)?.message || t('login.oidcFailed'))
    ssoLoading.value = false
  }
}
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
        <p>{{ $t('login.subtitle') }}</p>
      </div>

      <a-form v-if="showLocal || showLdap" layout="vertical" :model="form" @finish="onFinish">
        <a-form-item name="email" :rules="emailRules">
          <a-input v-model:value="form.email" :placeholder="$t('login.emailPlaceholder')" size="large">
            <template #prefix><MailOutlined class="pms-login-icon" /></template>
          </a-input>
        </a-form-item>
        <a-form-item name="password" :rules="passwordRules">
          <a-input-password v-model:value="form.password" :placeholder="$t('login.passwordPlaceholder')" size="large">
            <template #prefix><LockOutlined class="pms-login-icon" /></template>
          </a-input-password>
        </a-form-item>
        <a-button
          v-if="showLocal"
          type="primary"
          html-type="submit"
          block
          size="large"
          :loading="loading"
          class="pms-primary-button pms-login-submit"
        >
          {{ $t('login.submit') }}
        </a-button>
        <a-button
          v-if="showLdap && showLocal"
          type="default"
          html-type="button"
          block
          size="large"
          :loading="loading"
          class="pms-login-secondary"
          @click="onLdap"
        >
          {{ $t('login.ldap', { name: providers.find((item) => item.type === 'ldap')?.displayName || 'Directory' }) }}
        </a-button>
      </a-form>

      <a-button
        v-if="oidc"
        :type="showLocal || showLdap ? 'default' : 'primary'"
        block
        size="large"
        :loading="ssoLoading"
        class="pms-login-secondary"
        @click="onOidc"
      >
        {{ $t('login.oidc', { name: oidc.displayName || 'SSO' }) }}
      </a-button>

      <p class="pms-login-hint">{{ $t('login.hint') }}</p>
    </div>
  </div>
</template>

<style scoped>
.pms-login-card {
  position: relative;
  width: min(400px, 100%);
}

.pms-login-heading {
  display: flex;
  align-items: center;
  flex-direction: column;
  margin-bottom: 28px;
}

.pms-login-logo {
  display: grid;
  width: 44px;
  height: 44px;
  margin-bottom: 14px;
  place-items: center;
  color: #fff;
  background: var(--pms-primary);
  border-radius: 8px;
  font-size: var(--pms-font-size-title);
  font-weight: 750;
}

.pms-login-heading h1 {
  margin: 0;
  color: var(--pms-text);
  font-size: var(--pms-font-size-title);
  font-weight: 720;
}

.pms-login-heading p {
  margin: 5px 0 0;
  color: var(--pms-text-faint);
  font-size: var(--pms-font-size-compact);
}

.pms-login-icon { color: var(--pms-text-faint); }
.pms-login-submit { height: 42px; border-radius: 6px !important; font-weight: 650; }
.pms-login-secondary { height: 42px; margin-top: 12px; border-radius: 6px !important; font-weight: 650; }
.pms-login-hint { margin: 16px 0 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); text-align: center; }

@media (max-width: 480px) {
  .pms-login-page { padding: 16px; }
  .pms-login-card { padding: 24px 20px; }
}
</style>
