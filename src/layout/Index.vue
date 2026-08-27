<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LogoutOutlined, ProjectOutlined, SettingOutlined, TeamOutlined, ApartmentOutlined, SafetyCertificateOutlined, AuditOutlined, DashboardOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '/@/store/user'
import { message } from 'ant-design-vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

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

function handleMenuClick({ key }: { key: string }) {
  const target = menuRoutes[key]
  if (target && target !== route.path) router.push(target)
}

function logout() {
  userStore.logout()
  message.success('已退出登录')
  router.push('/login')
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
  <a-layout class="pms-shell">
    <a-layout-sider width="236" theme="light" class="pms-sider">
      <div class="pms-brand">
        <div class="pms-brand__logo">P</div>
        <div class="pms-brand__copy">
          <strong>PMS</strong>
          <span>Project Management</span>
        </div>
      </div>
      <a-menu v-model:selectedKeys="selectedKeys" mode="inline" class="pms-nav" @click="handleMenuClick">
        <a-menu-item key="dashboard">
          <DashboardOutlined />
          <span>工作台</span>
        </a-menu-item>
        <a-menu-item key="projects">
          <ProjectOutlined />
          <span>项目管理</span>
        </a-menu-item>
        <a-sub-menu v-if="canConfig" key="configuration">
          <template #title><SettingOutlined /><span>配置管理</span></template>
          <a-menu-item v-if="can('admin:user:read')" key="admin-users"><TeamOutlined /><span>人员与权限</span></a-menu-item>
          <a-menu-item v-if="can('admin:org:read')" key="admin-org"><ApartmentOutlined /><span>组织架构</span></a-menu-item>
          <a-menu-item v-if="can('admin:role:read')" key="admin-roles"><SafetyCertificateOutlined /><span>角色管理</span></a-menu-item>
          <a-menu-item v-if="can('admin:import:write')" key="admin-import"><ApartmentOutlined /><span>批量导入</span></a-menu-item>
          <a-menu-item v-if="can('admin:audit:read')" key="admin-audit"><AuditOutlined /><span>审计日志</span></a-menu-item>
        </a-sub-menu>
      </a-menu>
    </a-layout-sider>

    <a-layout>
      <a-layout-header class="pms-topbar">
        <span class="pms-topbar__title">{{ route.meta.title }}</span>
        <a-dropdown>
          <a class="pms-user-menu">
            <a-avatar size="small" class="pms-user-menu__avatar">
              {{ (userStore.user?.nickname || userStore.user?.username || 'U').charAt(0) }}
            </a-avatar>
            <span>{{ userStore.displayName }}</span>
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

      <a-layout-content class="pms-content">
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<style scoped>
.pms-shell {
  min-height: 100vh;
  background: var(--pms-bg);
}

.pms-sider {
  overflow: hidden;
  background: var(--pms-surface) !important;
  border-right: 1px solid var(--pms-border);
}

.pms-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  height: var(--pms-topbar-height);
  padding: 0 20px;
  border-bottom: 1px solid var(--pms-border);
}

.pms-brand__logo {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  color: #fff;
  background: var(--pms-primary);
  border-radius: 6px;
  font-size: 14px;
  font-weight: 750;
}

.pms-brand__copy {
  display: grid;
  line-height: 1.1;
}

.pms-brand__copy strong {
  color: var(--pms-text);
  font-size: var(--pms-font-size-body);
  font-weight: 720;
}

.pms-brand__copy span {
  margin-top: 4px;
  color: var(--pms-text-faint);
  font-size: 10px;
}

.pms-nav {
  border-inline-end: 0 !important;
  padding: 12px 10px;
}

.pms-nav :deep(.ant-menu-item) {
  height: 38px;
  margin: 3px 0;
  color: var(--pms-text-muted);
  border-radius: var(--pms-radius-sm);
  font-size: var(--pms-font-size-nav);
}

.pms-nav :deep(.ant-menu-submenu-title) {
  font-size: var(--pms-font-size-nav);
}

.pms-nav :deep(.ant-menu-item-selected) {
  color: var(--pms-primary);
  background: var(--pms-primary-soft);
  font-weight: 650;
}

.pms-nav :deep(.ant-menu-item-selected::after) {
  display: none;
}

.pms-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--pms-topbar-height);
  padding: 0 24px;
  background: var(--pms-surface) !important;
  border-bottom: 1px solid var(--pms-border);
}

.pms-topbar__title {
  color: var(--pms-text-muted);
  font-size: var(--pms-font-size-compact);
}

.pms-user-menu {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: var(--pms-text);
  font-size: var(--pms-font-size-body);
}

.pms-user-menu__avatar {
  background: var(--pms-primary) !important;
}

.pms-content {
  min-height: calc(100vh - var(--pms-topbar-height));
  padding: 24px;
  background: var(--pms-bg);
}

@media (max-width: 760px) {
  :deep(.ant-layout-sider) {
    display: none;
  }

  :deep(.ant-layout-header) {
    padding: 0 16px !important;
  }

  .pms-content {
    padding: 12px !important;
  }
}
</style>
