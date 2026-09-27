<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { approveCliAuthorization } from '/@/api/cli-auth'
import { apiErrorMessage } from '/@/plugins/http'
import { useUserStore } from '/@/store/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)
const ready = ref(false)
const error = ref('')

const params = computed(() => ({
  clientId: typeof route.query.client_id === 'string' ? route.query.client_id : '',
  redirectUri: typeof route.query.redirect_uri === 'string' ? route.query.redirect_uri : '',
  state: typeof route.query.state === 'string' ? route.query.state : '',
  codeChallenge: typeof route.query.code_challenge === 'string' ? route.query.code_challenge : '',
  codeChallengeMethod: typeof route.query.code_challenge_method === 'string' ? route.query.code_challenge_method : '',
}))

const validRequest = computed(() => params.value.clientId === 'pms-cli'
  && !!params.value.redirectUri
  && !!params.value.state
  && !!params.value.codeChallenge
  && params.value.codeChallengeMethod === 'S256')

onMounted(async () => {
  if (!validRequest.value) {
    error.value = 'CLI 授权请求无效，请重新执行登录命令。'
    return
  }
  if (!userStore.isLogin) {
    try {
      await userStore.restore()
    } catch {
      await router.replace({ path: '/login', query: { redirect: route.fullPath } })
      return
    }
  }
  ready.value = true
})

async function approve() {
  if (!validRequest.value || !ready.value) return
  loading.value = true
  try {
    const result = await approveCliAuthorization({
      clientId: params.value.clientId,
      redirectUri: params.value.redirectUri,
      state: params.value.state,
      codeChallenge: params.value.codeChallenge,
      codeChallengeMethod: 'S256',
    })
    const callback = new URL(result.redirectUri)
    callback.searchParams.set('code', result.authorizationCode)
    callback.searchParams.set('state', result.state)
    window.location.assign(callback.toString())
  } catch (cause) {
    error.value = apiErrorMessage(cause, 'CLI 授权失败')
  } finally {
    loading.value = false
  }
}

function cancel() {
  window.close()
  router.replace('/dashboard')
}
</script>

<template>
  <div class="pms-auth-page pms-cli-authorize-page">
    <div class="pms-auth-card pms-cli-authorize-card">
      <div class="pms-cli-authorize-logo">P</div>
      <h1>允许 PMS CLI 登录</h1>
      <p v-if="userStore.user" class="pms-cli-authorize-account">当前账号：{{ userStore.displayName }}</p>
      <p class="pms-cli-authorize-copy">命令行工具将以当前 PMS 用户身份访问你有权限的数据和操作。</p>
      <a-alert v-if="error" type="error" show-icon :message="error" />
      <div class="pms-cli-authorize-actions">
        <a-button @click="cancel">取消</a-button>
        <a-button type="primary" class="pms-primary-button" :loading="loading" :disabled="!ready || !!error" @click="approve">
          同意并继续
        </a-button>
      </div>
      <p class="pms-cli-authorize-hint">不会向命令行传递你的密码，也不会把密码保存到本地。</p>
    </div>
  </div>
</template>

<style scoped>
.pms-cli-authorize-page { padding: 24px; }
.pms-cli-authorize-card { width: min(460px, 100%); }
.pms-cli-authorize-logo {
  display: grid; width: 48px; height: 48px; margin: 0 auto 18px; place-items: center;
  color: #fff; background: var(--pms-primary); border-radius: 10px; font-size: 24px; font-weight: 750;
}
.pms-cli-authorize-card h1 { margin: 0; color: var(--pms-text); font-size: 22px; text-align: center; }
.pms-cli-authorize-account { margin: 10px 0 0; color: var(--pms-primary); text-align: center; }
.pms-cli-authorize-copy { margin: 20px 0; color: var(--pms-text-secondary); line-height: 1.7; }
.pms-cli-authorize-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
.pms-cli-authorize-hint { margin: 18px 0 0; color: var(--pms-text-faint); font-size: 12px; }
</style>
