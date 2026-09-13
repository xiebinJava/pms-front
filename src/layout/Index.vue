<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { BellOutlined, BookOutlined, CloudUploadOutlined, DashboardOutlined, DownOutlined, ExperimentOutlined, LogoutOutlined, MenuOutlined, ProjectOutlined, SearchOutlined, SettingOutlined, TeamOutlined, ApartmentOutlined, SafetyCertificateOutlined, AuditOutlined, MessageOutlined, NodeIndexOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '/@/store/user'
import LocaleSwitch from '/@/components/LocaleSwitch.vue'
import { message } from 'ant-design-vue'
import { getNotifications, getUnreadNotificationCount, markAllNotificationsRead, markNotificationRead } from '/@/api/notification'
import { searchWorkspace } from '/@/api/search'
import { formatDateTime } from '/@/utils/format'
import type { SearchResult, UserNotification } from '/@/types/domain'
import { canSearch, firstSearchHit, NOTIFICATIONS_CHANGED_EVENT, notificationRoute, searchHitRoute } from './chrome'
import { notificationTypeClass, notificationTypeKey } from '/@/views/notifications/notification-center'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const userStore = useUserStore()
const passwordOpen = ref(false)
const passwordLoading = ref(false)
const navOpen = ref(false)
// Keep both workspace groups visible by default; users can collapse either group
// without losing the active route or its permission-filtered child links.
const projectNavOpen = ref(true)
const configNavOpen = ref(true)
const docsNavOpen = ref(true)
const passwordForm = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const searchQuery = ref('')
const searchOpen = ref(false)
const searchLoading = ref(false)
const searchResult = ref<SearchResult>({ projects: [], tasks: [], comments: [] })
const notifyOpen = ref(false)
const notifyLoading = ref(false)
const notifications = ref<UserNotification[]>([])
const unreadCount = ref(0)
let searchTimer: ReturnType<typeof setTimeout> | null = null
let unreadTimer: ReturnType<typeof setInterval> | null = null

const emptySearch = (): SearchResult => ({ projects: [], tasks: [], comments: [] })
const can = (permission: string) => userStore.can(permission)
const searchHasHits = computed(() => Boolean(
  searchResult.value.projects.length
  || searchResult.value.tasks.length
  || searchResult.value.comments.length,
))
const canReadProjects = computed(() => can('project:read'))

const selectedKeys = computed(() => {
  if (route.path.startsWith('/dashboard')) return ['dashboard']
  if (route.path.startsWith('/feedback')) return ['feedback']
  if (route.path.startsWith('/manual/business-rules')) return ['manual-business-rules']
  if (route.path.startsWith('/manual/design-system')) return ['manual-design-system']
  if (route.path.startsWith('/manual')) return ['manual']
  if (route.path.startsWith('/projects/dashboard')) return ['project-dashboard']
  if (route.path.startsWith('/projects')) return ['projects']
  if (route.path.startsWith('/admin/users')) return ['admin-users']
  if (route.path.startsWith('/admin/org')) return ['admin-org']
  if (route.path.startsWith('/admin/roles')) return ['admin-roles']
  if (route.path.startsWith('/admin/audit')) return ['admin-audit']
  if (route.path.startsWith('/admin/import')) return ['admin-import']
  if (route.path.startsWith('/admin/workflows')) return ['admin-workflows']
  return []
})

const canConfig = computed(() => ['admin:user:read', 'admin:org:read', 'admin:role:read', 'admin:audit:read', 'admin:import:write', 'admin:workflow:read'].some(can))

const menuRoutes: Record<string, string> = {
  dashboard: '/dashboard',
  manual: '/manual#quick-start',
  'manual-business-rules': '/manual/business-rules#identity',
  'manual-design-system': '/manual/design-system#principles',
  'project-dashboard': '/projects/dashboard',
  projects: '/projects',
  feedback: '/feedback',
  'admin-users': '/admin/users',
  'admin-org': '/admin/org',
  'admin-roles': '/admin/roles',
  'admin-import': '/admin/import',
  'admin-workflows': '/admin/workflows',
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
  message.success(t('layout.logoutSuccess'))
  await router.replace('/login').catch(() => {
    // If the login chunk cannot be loaded, force a fresh document navigation
    // so the browser still leaves the authenticated application shell.
    window.location.replace('/login')
  })
}

async function submitPasswordChange() {
  if (passwordForm.newPassword.length < 12 || passwordForm.newPassword !== passwordForm.confirmPassword) {
    message.error(t('layout.passwordMismatch'))
    return
  }
  passwordLoading.value = true
  try {
    await userStore.changePassword(passwordForm.currentPassword, passwordForm.newPassword)
    passwordOpen.value = false
    Object.assign(passwordForm, { currentPassword: '', newPassword: '', confirmPassword: '' })
    message.success(t('layout.passwordUpdated'))
    router.push('/login')
  } finally {
    passwordLoading.value = false
  }
}

function onSearchBlur() {
  window.setTimeout(() => { searchOpen.value = false }, 180)
}

function onSearchInput(value: string) {
  searchQuery.value = value
  searchOpen.value = true
  if (searchTimer) clearTimeout(searchTimer)
  if (!canSearch(value)) {
    searchResult.value = emptySearch()
    return
  }
  searchTimer = setTimeout(() => { void runSearch(value) }, 300)
}

async function runSearch(value: string) {
  if (!canSearch(value)) return
  searchLoading.value = true
  try {
    searchResult.value = await searchWorkspace(value.trim())
  } catch {
    searchResult.value = emptySearch()
  } finally {
    searchLoading.value = false
  }
}

function openSearchHit(hit: ReturnType<typeof firstSearchHit>) {
  if (!hit) return
  searchOpen.value = false
  const target = searchHitRoute(hit)
  void router.push(target)
}

function onSearchEnter() {
  openSearchHit(firstSearchHit(searchResult.value))
}

async function refreshUnreadCount() {
  if (!canReadProjects.value) return
  try {
    const payload = await getUnreadNotificationCount()
    unreadCount.value = payload.unreadCount || 0
  } catch {
    unreadCount.value = 0
  }
}

async function loadNotifications() {
  if (!canReadProjects.value) return
  notifyLoading.value = true
  try {
    notifications.value = await getNotifications()
    await refreshUnreadCount()
  } catch {
    notifications.value = []
  } finally {
    notifyLoading.value = false
  }
}

function onNotifyOpenChange(open: boolean) {
  notifyOpen.value = open
  if (open) void loadNotifications()
}

function openNotificationCenter() {
  notifyOpen.value = false
  void router.push('/notifications')
}

async function openNotification(item: UserNotification) {
  notifyOpen.value = false
  if (!item.readAt) {
    try {
      await markNotificationRead(item.id)
      item.readAt = new Date().toISOString()
      await refreshUnreadCount()
    } catch { /* keep the list usable even if the mark-read call fails */ }
  }
  const target = notificationRoute(item)
  if (target) void router.push(target)
}

async function onMarkAllRead() {
  await markAllNotificationsRead()
  notifications.value = notifications.value.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() }))
  await refreshUnreadCount()
}

function onNotificationsChanged() {
  void refreshUnreadCount()
}

onMounted(async () => {
  window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onNotificationsChanged)
  if (userStore.token && !userStore.user) {
    try {
      await userStore.fetchMe()
    } catch {
      userStore.logout()
    }
  }
  if (canReadProjects.value) {
    void refreshUnreadCount()
    unreadTimer = setInterval(() => { void refreshUnreadCount() }, 60_000)
  }
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
  if (unreadTimer) clearInterval(unreadTimer)
  window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onNotificationsChanged)
})

</script>

<template>
  <div class="pms-shell">
    <a class="pms-skip-link" href="#pms-main-content">{{ $t('nav.skipToContent') }}</a>
    <header class="pms-topbar">
      <div class="pms-topbar__left">
        <button class="pms-mobile-menu" type="button" :aria-label="$t('nav.toggle')" @click="navOpen = !navOpen">
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
      <div class="pms-topbar__center" :class="{ 'pms-topbar__center--search': canReadProjects }">
        <div v-if="canReadProjects" class="pms-global-search">
          <a-input
            :value="searchQuery"
            class="pms-filter-control"
            allow-clear
            :placeholder="$t('layout.searchPlaceholder')"
            @update:value="onSearchInput"
            @focus="searchOpen = true"
            @press-enter="onSearchEnter"
            @blur="onSearchBlur"
          >
            <template #prefix><SearchOutlined /></template>
          </a-input>
          <div v-if="searchOpen && canSearch(searchQuery)" class="pms-search-panel">
            <a-spin :spinning="searchLoading">
              <p v-if="!searchHasHits && !searchLoading" class="pms-search-panel__empty">{{ $t('layout.searchEmpty') }}</p>
              <template v-else>
                <section v-if="searchResult.projects.length">
                  <h3>{{ $t('layout.searchProjects') }}</h3>
                  <button v-for="hit in searchResult.projects" :key="`p-${hit.id}`" type="button" @mousedown.prevent="openSearchHit(hit)">
                    <strong>{{ hit.title }}</strong>
                    <small>{{ hit.snippet }}</small>
                  </button>
                </section>
                <section v-if="searchResult.tasks.length">
                  <h3>{{ $t('layout.searchTasks') }}</h3>
                  <button v-for="hit in searchResult.tasks" :key="`t-${hit.id}`" type="button" @mousedown.prevent="openSearchHit(hit)">
                    <strong>{{ hit.title }}</strong>
                    <small>{{ hit.projectName }}</small>
                  </button>
                </section>
                <section v-if="searchResult.comments.length">
                  <h3>{{ $t('layout.searchComments') }}</h3>
                  <button v-for="hit in searchResult.comments" :key="`c-${hit.id}`" type="button" @mousedown.prevent="openSearchHit(hit)">
                    <strong>{{ hit.projectName }}</strong>
                    <small>{{ hit.snippet }}</small>
                  </button>
                </section>
              </template>
            </a-spin>
          </div>
        </div>
      </div>
      <div class="pms-topbar__right">
        <LocaleSwitch />
        <a-dropdown v-if="canReadProjects" :open="notifyOpen" trigger="click" @openChange="onNotifyOpenChange">
          <button class="pms-notify-bell" type="button" :aria-label="$t('layout.notifications')">
            <a-badge :count="unreadCount" :overflow-count="99">
              <BellOutlined />
            </a-badge>
          </button>
          <template #overlay>
            <div class="pms-notify-panel">
              <div class="pms-notify-panel__head">
                <strong>{{ $t('layout.notifications') }}</strong>
                <button v-if="unreadCount" type="button" @click="onMarkAllRead">{{ $t('layout.markAllRead') }}</button>
              </div>
              <a-spin :spinning="notifyLoading">
                <p v-if="!notifications.length && !notifyLoading" class="pms-notify-panel__empty">{{ $t('layout.notifyEmpty') }}</p>
                <button
                  v-for="item in notifications"
                  :key="item.id"
                  type="button"
                  class="pms-notify-item"
                  :class="{ 'pms-notify-item--unread': !item.readAt }"
                  @click="openNotification(item)"
                >
                  <span class="pms-notify-item__type" :class="notificationTypeClass(item.type)">
                    {{ $t(notificationTypeKey(item.type)) }}
                  </span>
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.content }}</span>
                  <small>{{ formatDateTime(item.createdAt) }}</small>
                </button>
              </a-spin>
              <button class="pms-notify-view-all" type="button" @click="openNotificationCenter">
                {{ $t('layout.viewAllNotifications') }}
              </button>
            </div>
          </template>
        </a-dropdown>
        <a-dropdown>
          <button class="pms-user-menu" type="button">
            <a-avatar size="small" class="pms-user-menu__avatar">
              {{ (userStore.displayName || 'U').charAt(0) }}
            </a-avatar>
            <span>{{ userStore.displayName }}</span>
          </button>
          <template #overlay>
            <a-menu>
              <a-menu-item key="change-password" @click="passwordOpen = true">
                {{ $t('layout.changePassword') }}
              </a-menu-item>
              <a-menu-item key="logout" @click="logout">
                <LogoutOutlined />
                {{ $t('layout.logout') }}
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </header>

    <div class="pms-shell-body">
      <aside class="pms-sidebar" :class="{ 'pms-sidebar--open': navOpen }">
        <nav class="pms-nav" :aria-label="$t('nav.primary')" @click="handleMenuClick">
          <div class="pms-nav-list">
            <div class="pms-nav-group">
              <button class="pms-nav-link" :class="{ 'pms-nav-link--active': selectedKeys.includes('dashboard') }" :aria-current="selectedKeys.includes('dashboard') ? 'page' : undefined" type="button" @click.stop="handleMenuClick({ key: 'dashboard' })">
                <DashboardOutlined /><span>{{ $t('nav.dashboard') }}</span>
              </button>
            </div>
            <div class="pms-nav-group pms-nav-group--projects">
              <button class="pms-nav-section-label" :class="{ 'pms-nav-section-label--active': selectedKeys.includes('projects') }" type="button" aria-controls="pms-project-subnav" :aria-expanded="projectNavOpen" @click.stop="projectNavOpen = !projectNavOpen">
                <ExperimentOutlined /><span>{{ $t('nav.rdManagement') }}</span><DownOutlined class="pms-nav-section-label__arrow" :class="{ 'pms-nav-section-label__arrow--collapsed': !projectNavOpen }" />
              </button>
              <div v-if="projectNavOpen" id="pms-project-subnav" class="pms-nav-subnav">
                <button v-if="canReadProjects" class="pms-nav-link" :class="{ 'pms-nav-link--active': selectedKeys.includes('project-dashboard') }" :aria-current="selectedKeys.includes('project-dashboard') ? 'page' : undefined" type="button" @click.stop="handleMenuClick({ key: 'project-dashboard' })">
                  <DashboardOutlined /><span>{{ $t('nav.projectDashboard') }}</span>
                </button>
                <button class="pms-nav-link" :class="{ 'pms-nav-link--active': selectedKeys.includes('projects') }" :aria-current="selectedKeys.includes('projects') ? 'page' : undefined" type="button" :aria-label="$t('nav.projectsTab')" @click.stop="handleMenuClick({ key: 'projects' })">
                  <ProjectOutlined /><span>{{ $t('nav.projects') }}</span>
                </button>
              </div>
            </div>
            <div v-if="canConfig" class="pms-nav-group pms-nav-group--configuration">
              <button class="pms-nav-section-label" :class="{ 'pms-nav-section-label--active': selectedKeys.some(key => key.startsWith('admin-')) }" type="button" aria-controls="pms-config-subnav" :aria-expanded="configNavOpen" @click.stop="configNavOpen = !configNavOpen">
                <SettingOutlined /><span>{{ $t('nav.configuration') }}</span><DownOutlined class="pms-nav-section-label__arrow" :class="{ 'pms-nav-section-label__arrow--collapsed': !configNavOpen }" />
              </button>
              <div v-if="configNavOpen" id="pms-config-subnav" class="pms-nav-subnav">
                    <button v-if="can('admin:user:read')" class="pms-nav-link" :class="{ 'pms-nav-link--active': selectedKeys.includes('admin-users') }" :aria-current="selectedKeys.includes('admin-users') ? 'page' : undefined" type="button" @click.stop="handleMenuClick({ key: 'admin-users' })">
                  <TeamOutlined /><span>{{ $t('nav.users') }}</span>
                </button>
                    <button v-if="can('admin:org:read')" class="pms-nav-link" :class="{ 'pms-nav-link--active': selectedKeys.includes('admin-org') }" :aria-current="selectedKeys.includes('admin-org') ? 'page' : undefined" type="button" @click.stop="handleMenuClick({ key: 'admin-org' })">
                  <ApartmentOutlined /><span>{{ $t('nav.org') }}</span>
                </button>
                    <button v-if="can('admin:role:read')" class="pms-nav-link" :class="{ 'pms-nav-link--active': selectedKeys.includes('admin-roles') }" :aria-current="selectedKeys.includes('admin-roles') ? 'page' : undefined" type="button" @click.stop="handleMenuClick({ key: 'admin-roles' })">
                  <SafetyCertificateOutlined /><span>{{ $t('nav.roles') }}</span>
                </button>
                <button v-if="can('admin:import:write')" class="pms-nav-link" :class="{ 'pms-nav-link--active': selectedKeys.includes('admin-import') }" :aria-current="selectedKeys.includes('admin-import') ? 'page' : undefined" type="button" @click.stop="handleMenuClick({ key: 'admin-import' })">
                  <CloudUploadOutlined /><span>{{ $t('nav.import') }}</span>
                </button>
                <button v-if="can('admin:workflow:read')" class="pms-nav-link" :class="{ 'pms-nav-link--active': selectedKeys.includes('admin-workflows') }" :aria-current="selectedKeys.includes('admin-workflows') ? 'page' : undefined" type="button" @click.stop="handleMenuClick({ key: 'admin-workflows' })">
                  <NodeIndexOutlined /><span>{{ $t('nav.workflows') }}</span>
                </button>
                <button v-if="can('admin:audit:read')" class="pms-nav-link" :class="{ 'pms-nav-link--active': selectedKeys.includes('admin-audit') }" :aria-current="selectedKeys.includes('admin-audit') ? 'page' : undefined" type="button" @click.stop="handleMenuClick({ key: 'admin-audit' })">
                  <AuditOutlined /><span>{{ $t('nav.audit') }}</span>
                </button>
              </div>
            </div>
            <div v-if="can('feedback:read') || can('feedback:write')" class="pms-nav-group pms-nav-group--feedback">
                  <button class="pms-nav-link" :class="{ 'pms-nav-link--active': selectedKeys.includes('feedback') }" :aria-current="selectedKeys.includes('feedback') ? 'page' : undefined" type="button" @click.stop="handleMenuClick({ key: 'feedback' })">
                <MessageOutlined /><span>{{ $t('nav.feedback') }}</span>
              </button>
            </div>
            <div class="pms-nav-group pms-nav-group--docs">
              <button class="pms-nav-section-label" :class="{ 'pms-nav-section-label--active': selectedKeys.some(key => key.startsWith('manual')) }" type="button" aria-controls="pms-docs-subnav" :aria-expanded="docsNavOpen" @click.stop="docsNavOpen = !docsNavOpen">
                <BookOutlined /><span>{{ $t('nav.docs') }}</span><DownOutlined class="pms-nav-section-label__arrow" :class="{ 'pms-nav-section-label__arrow--collapsed': !docsNavOpen }" />
              </button>
              <div v-if="docsNavOpen" id="pms-docs-subnav" class="pms-nav-subnav">
                    <button class="pms-nav-link" :class="{ 'pms-nav-link--active': selectedKeys.includes('manual') }" :aria-current="selectedKeys.includes('manual') ? 'page' : undefined" type="button" @click.stop="handleMenuClick({ key: 'manual' })">
                  <BookOutlined /><span>{{ $t('nav.manual') }}</span>
                </button>
                    <button class="pms-nav-link" :class="{ 'pms-nav-link--active': selectedKeys.includes('manual-business-rules') }" :aria-current="selectedKeys.includes('manual-business-rules') ? 'page' : undefined" type="button" @click.stop="handleMenuClick({ key: 'manual-business-rules' })">
                  <AuditOutlined /><span>{{ $t('nav.businessRules') }}</span>
                </button>
                    <button class="pms-nav-link" :class="{ 'pms-nav-link--active': selectedKeys.includes('manual-design-system') }" :aria-current="selectedKeys.includes('manual-design-system') ? 'page' : undefined" type="button" @click.stop="handleMenuClick({ key: 'manual-design-system' })">
                  <SettingOutlined /><span>{{ $t('nav.designSystem') }}</span>
                </button>
              </div>
            </div>
          </div>
        </nav>
      </aside>
      <button v-if="navOpen" class="pms-sidebar-scrim" type="button" :aria-label="$t('nav.close')" @click="navOpen = false" />
      <main id="pms-main-content" class="pms-main-content">
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </main>
    </div>

    <a-modal v-model:open="passwordOpen" wrap-class-name="pms-modal" :title="$t('layout.changePassword')" :ok-text="$t('common.save')" :cancel-text="$t('common.cancel')" :confirm-loading="passwordLoading" @ok="submitPasswordChange">
      <a-form layout="vertical">
        <a-form-item :label="$t('layout.currentPassword')"><a-input-password v-model:value="passwordForm.currentPassword" /></a-form-item>
        <a-form-item :label="$t('layout.newPassword')"><a-input-password v-model:value="passwordForm.newPassword" /></a-form-item>
        <a-form-item :label="$t('layout.confirmPassword')"><a-input-password v-model:value="passwordForm.confirmPassword" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
