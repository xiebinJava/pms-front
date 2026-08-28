<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LogoutOutlined, ProjectOutlined, SettingOutlined, TeamOutlined, ApartmentOutlined, SafetyCertificateOutlined, AuditOutlined, DashboardOutlined, MenuOutlined, DownOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '/@/store/user'
import { message } from 'ant-design-vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const passwordOpen = ref(false)
const passwordLoading = ref(false)
const navOpen = ref(false)
const passwordForm = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })

const selectedKeys = computed(() => {
  if (route.path.startsWith('/projects')) return ['projects']
  if (route.path.startsWith('/admin/users')) return ['admin-users']
  if (route.path.startsWith('/admin/org')) return ['admin-org']
  if (route.path.startsWith('/admin/roles')) return ['admin-roles']
  if (route.path.startsWith('/admin/audit')) return ['admin-audit']
  if (route.path.startsWith('/admin/import')) return ['admin-import']
  return []
})

const can = (permission: string) => userStore.can(permission)
const canConfig = computed(() => ['admin:user:read', 'admin:org:read', 'admin:role:read', 'admin:audit:read', 'admin:import:write'].some(can))

const menuRoutes: Record<string, string> = {
  dashboard: '/projects',
  projects: '/projects',
  'admin-users': '/admin/users',
  'admin-org': '/admin/org',
  'admin-roles': '/admin/roles',
  'admin-import': '/admin/import',
  'admin-audit': '/admin/audit',
}

function handleMenuClick(payload: { key?: string } | string | Event) {
  const key = typeof payload === 'string'
    ? payload
    : ('key' in payload && typeof payload.key === 'string' ? payload.key : undefined)
  if (!key) return
  const target = menuRoutes[key]
  if (target && target !== route.path) router.push(target)
  navOpen.value = false
}

async function logout() {
  await userStore.logout()
  message.success('已退出登录')
  router.push('/login')
}

async function submitPasswordChange() {
  if (passwordForm.newPassword.length < 12 || passwordForm.newPassword !== passwordForm.confirmPassword) {
    message.error('请确认两次密码一致，且新密码至少 12 位')
    return
  }
  passwordLoading.value = true
  try {
    await userStore.changePassword(passwordForm.currentPassword, passwordForm.newPassword)
    passwordOpen.value = false
    Object.assign(passwordForm, { currentPassword: '', newPassword: '', confirmPassword: '' })
    message.success('密码已更新，请重新登录')
    router.push('/login')
  } finally {
    passwordLoading.value = false
  }
}

onMounted(async () => {
  if (userStore.token && !userStore.user) {
    try {
      await userStore.fetchMe()
    } catch {
      userStore.logout()
    }
  }
})
</script>

<template>
  <div class="pms-shell">
    <header class="pms-topbar">
      <div class="pms-topbar__left">
        <button class="pms-mobile-menu" type="button" aria-label="切换导航" @click="navOpen = !navOpen">
          <MenuOutlined />
        </button>
        <div class="pms-brand">
          <div class="pms-brand__logo">P</div>
          <div class="pms-brand__copy">
            <strong>PMS</strong>
            <span>Project Management</span>
          </div>
        </div>
      </div>
      <span class="pms-topbar__title">{{ route.meta.title }}</span>
      <a-dropdown>
        <button class="pms-user-menu" type="button">
          <a-avatar size="small" class="pms-user-menu__avatar">
            {{ (userStore.user?.nickname || userStore.user?.username || 'U').charAt(0) }}
          </a-avatar>
          <span>{{ userStore.displayName }}</span>
        </button>
        <template #overlay>
          <a-menu>
            <a-menu-item key="change-password" @click="passwordOpen = true">
              修改密码
            </a-menu-item>
            <a-menu-item key="logout" @click="logout">
              <LogoutOutlined />
              退出登录
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </header>

    <div class="pms-shell-body">
      <aside class="pms-sidebar" :class="{ 'pms-sidebar--open': navOpen }">
        <nav class="pms-nav" @click="handleMenuClick">
          <div class="pms-nav-list">
          <div class="pms-nav-group">
            <button class="pms-nav-link" :class="{ 'pms-nav-link--active': selectedKeys.includes('dashboard') }" type="button" @click.stop="handleMenuClick({ key: 'dashboard' })">
              <DashboardOutlined /><span>工作台</span>
            </button>
            <button class="pms-nav-link" :class="{ 'pms-nav-link--active': selectedKeys.includes('projects') }" type="button" @click.stop="handleMenuClick({ key: 'projects' })">
              <ProjectOutlined /><span>项目管理</span>
            </button>
          </div>
          <div v-if="canConfig" class="pms-nav-group pms-nav-group--configuration">
            <div class="pms-nav-section-label"><SettingOutlined /><span>配置管理</span><DownOutlined class="pms-nav-section-label__arrow" /></div>
            <div class="pms-nav-subnav">
              <button v-if="can('admin:user:read')" class="pms-nav-link" :class="{ 'pms-nav-link--active': selectedKeys.includes('admin-users') }" type="button" @click.stop="handleMenuClick({ key: 'admin-users' })">
                <TeamOutlined /><span>人员与权限</span>
              </button>
              <button v-if="can('admin:org:read')" class="pms-nav-link" :class="{ 'pms-nav-link--active': selectedKeys.includes('admin-org') }" type="button" @click.stop="handleMenuClick({ key: 'admin-org' })">
                <ApartmentOutlined /><span>组织架构</span>
              </button>
              <button v-if="can('admin:role:read')" class="pms-nav-link" :class="{ 'pms-nav-link--active': selectedKeys.includes('admin-roles') }" type="button" @click.stop="handleMenuClick({ key: 'admin-roles' })">
                <SafetyCertificateOutlined /><span>角色管理</span>
              </button>
              <button v-if="can('admin:import:write')" class="pms-nav-link" :class="{ 'pms-nav-link--active': selectedKeys.includes('admin-import') }" type="button" @click.stop="handleMenuClick({ key: 'admin-import' })">
                <ApartmentOutlined /><span>批量导入</span>
              </button>
              <button v-if="can('admin:audit:read')" class="pms-nav-link" :class="{ 'pms-nav-link--active': selectedKeys.includes('admin-audit') }" type="button" @click.stop="handleMenuClick({ key: 'admin-audit' })">
                <AuditOutlined /><span>审计日志</span>
              </button>
            </div>
          </div>
          </div>
        </nav>
      </aside>
      <button v-if="navOpen" class="pms-sidebar-scrim" type="button" aria-label="关闭导航" @click="navOpen = false" />
      <main class="pms-main-content">
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </main>
    </div>

    <a-modal v-model:open="passwordOpen" wrap-class-name="pms-modal" title="修改密码" ok-text="保存" cancel-text="取消" :confirm-loading="passwordLoading" @ok="submitPasswordChange">
      <a-form layout="vertical">
        <a-form-item label="当前密码"><a-input-password v-model:value="passwordForm.currentPassword" /></a-form-item>
        <a-form-item label="新密码"><a-input-password v-model:value="passwordForm.newPassword" /></a-form-item>
        <a-form-item label="确认新密码"><a-input-password v-model:value="passwordForm.confirmPassword" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
