<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LogoutOutlined, ProjectOutlined, UserOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '/@/store/user'
import { message } from 'ant-design-vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const selectedKeys = computed(() => {
  if (route.path.startsWith('/projects')) return ['projects']
  return []
})

function logout() {
  userStore.logout()
  message.success('已退出登录')
  router.push('/login')
}
</script>

<template>
  <a-layout style="min-height: 100vh">
    <a-layout-sider width="208" theme="light" style="border-right: 1px solid var(--pms-border)">
      <div class="flex items-center gap-2 h-[56px] px-4 border-b border-[#f0f0f0]">
        <div class="w-7 h-7 rounded bg-[#378eef] text-white flex items-center justify-center font-bold">P</div>
        <span class="text-[15px] font-semibold text-[#18212e]">PMS</span>
      </div>
      <a-menu v-model:selectedKeys="selectedKeys" mode="inline" style="border-inline-end: none">
        <a-menu-item key="projects">
          <ProjectOutlined />
          <span>项目管理</span>
        </a-menu-item>
      </a-menu>
    </a-layout-sider>

    <a-layout>
      <a-layout-header class="!bg-white !px-6 h-[56px] flex items-center justify-between border-b border-[#f0f0f0]">
        <span class="text-[14px] text-[#5d6b7e]">{{ route.meta.title }}</span>
        <a-dropdown>
          <a class="flex items-center gap-2 text-[#18212e]">
            <a-avatar size="small" icon="user" style="background-color: #378eef" />
            <span>{{ userStore.user?.nickname || userStore.user?.username || '未登录' }}</span>
          </a>
          <template #overlay>
            <a-menu>
              <a-menu-item key="logout" @click="logout">
                <LogoutOutlined />
                退出登录
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </a-layout-header>

      <a-layout-content class="p-5">
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>
