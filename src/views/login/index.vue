<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LockOutlined, UserOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { useUserStore } from '/@/store/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const form = reactive({ username: 'admin', password: 'admin123' })
const loading = ref(false)

async function onFinish() {
  loading.value = true
  try {
    await userStore.login(form.username, form.password)
    message.success('登录成功')
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="h-full min-h-screen flex items-center justify-center bg-gradient-to-br from-[#eef4ff] to-[#f7f9fc]">
    <a-card class="w-[360px] shadow-lg" :bordered="false">
      <div class="flex flex-col items-center mb-6">
        <div class="w-12 h-12 rounded-xl bg-[#378eef] text-white flex items-center justify-center text-2xl font-bold mb-3">P</div>
        <h1 class="text-[18px] font-semibold m-0 text-[#18212e]">PMS 项目管理系统</h1>
        <p class="text-[12px] text-[#8895a7] mt-1 m-0">开源项目管理系统</p>
      </div>

      <a-form layout="vertical" :model="form" @finish="onFinish">
        <a-form-item name="username" :rules="[{ required: true, message: '请输入用户名' }]">
          <a-input v-model:value="form.username" placeholder="用户名" size="large">
            <template #prefix><UserOutlined /></template>
          </a-input>
        </a-form-item>
        <a-form-item name="password" :rules="[{ required: true, message: '请输入密码' }]">
          <a-input-password v-model:value="form.password" placeholder="密码" size="large">
            <template #prefix><LockOutlined /></template>
          </a-input-password>
        </a-form-item>
        <a-button type="primary" html-type="submit" block size="large" :loading="loading">登 录</a-button>
      </a-form>

      <p class="text-[12px] text-[#8895a7] text-center mt-4 mb-0">默认账号 admin / admin123</p>
    </a-card>
  </div>
</template>
