<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LockOutlined, UserOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { useUserStore } from '/@/store/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const form = reactive({ username: '', password: '' })
const loading = ref(false)

async function onFinish() {
  loading.value = true
  try {
    await userStore.login(form.username, form.password)
    message.success('登录成功')
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch (error) {
    message.error((error as Error)?.message || '登录失败，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="pms-auth-page pms-login-page">
    <div class="pms-auth-card pms-login-card">
      <div class="pms-login-heading">
        <div class="pms-login-logo">P</div>
        <h1>PMS 项目管理系统</h1>
        <p>软件研发项目全流程管理</p>
      </div>

      <a-form layout="vertical" :model="form" @finish="onFinish">
        <a-form-item name="username" :rules="[{ required: true, message: '请输入英文名' }]">
          <a-input v-model:value="form.username" placeholder="英文名（如 Brad.Xie）" size="large">
            <template #prefix><UserOutlined class="pms-login-icon" /></template>
          </a-input>
        </a-form-item>
        <a-form-item name="password" :rules="[{ required: true, message: '请输入密码' }]">
          <a-input-password v-model:value="form.password" placeholder="密码" size="large">
            <template #prefix><LockOutlined class="pms-login-icon" /></template>
          </a-input-password>
        </a-form-item>
        <a-button
          type="primary"
          html-type="submit"
          block
          size="large"
          :loading="loading"
          class="pms-primary-button pms-login-submit"
        >
          登 录
        </a-button>
      </a-form>

      <p class="pms-login-hint">请输入管理员邀请的英文名，英文名不区分大小写</p>
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
.pms-login-hint { margin: 16px 0 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); text-align: center; }

@media (max-width: 480px) {
  .pms-login-page { padding: 16px; }
  .pms-login-card { padding: 24px 20px; }
}
</style>
