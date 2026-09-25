<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
import {
  getNotificationPage,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '/@/api/notification'
import type { UserNotification } from '/@/types/domain'
import { formatDateTime } from '/@/utils/format'
import { notificationRoute, notifyNotificationsChanged } from '/@/layout/chrome'
import {
  notificationQuery,
  notificationTypeClass,
  notificationTypeKey,
  type NotificationFilter,
} from './notification-center'

const { t } = useI18n()
const router = useRouter()
const filter = ref<NotificationFilter>('all')
const page = ref(1)
const pageSize = 20
const total = ref(0)
const unreadCount = ref(0)
const records = ref<UserNotification[]>([])
const loading = ref(false)
const markingAll = ref(false)
const errorMessage = ref('')

const filters = computed(() => [
  { key: 'all' as const, label: t('notifications.filters.all') },
  { key: 'unread' as const, label: t('notifications.filters.unread') },
  { key: 'due-soon' as const, label: t('notifications.filters.dueSoon') },
  { key: 'overdue' as const, label: t('notifications.filters.overdue') },
])
const hasUnread = computed(() => unreadCount.value > 0)

function errorText(error: unknown) {
  return error instanceof Error && error.message ? error.message : t('notifications.loadFailed')
}

async function refreshUnreadCount() {
  try {
    const payload = await getUnreadNotificationCount()
    unreadCount.value = payload.unreadCount || 0
  } catch {
    unreadCount.value = 0
  }
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const payload = await getNotificationPage(notificationQuery(filter.value, page.value, pageSize))
    records.value = payload.list || []
    total.value = payload.total || 0
  } catch (error) {
    errorMessage.value = errorText(error)
  } finally {
    await refreshUnreadCount()
    loading.value = false
  }
}

function changeFilter(nextFilter: NotificationFilter) {
  if (filter.value === nextFilter) return
  filter.value = nextFilter
  page.value = 1
  void load()
}

function changePage(nextPage: number) {
  page.value = nextPage
  void load()
}

async function markAllRead() {
  if (!hasUnread.value || markingAll.value) return
  markingAll.value = true
  try {
    await markAllNotificationsRead()
    await load()
    notifyNotificationsChanged()
    message.success(t('notifications.markAllSuccess'))
  } catch (error) {
    message.error(errorText(error))
  } finally {
    markingAll.value = false
  }
}

async function openNotification(item: UserNotification) {
  if (!item.readAt) {
    try {
      await markNotificationRead(item.id)
      item.readAt = new Date().toISOString()
      if (filter.value === 'unread') {
        await load()
      } else {
        await refreshUnreadCount()
      }
      notifyNotificationsChanged()
    } catch { /* Navigation remains available when marking read fails. */ }
  }
  const target = notificationRoute(item)
  if (target) {
    void router.push(target)
  } else {
    message.info(t('notifications.noTarget'))
  }
}

onMounted(load)
</script>

<template>
  <div class="notifications-page pms-page-stack">
    <PmsPageHeader :title="$t('notifications.pageTitle')" :description="$t('notifications.pageDescription')">
      <template #actions>
        <a-button class="pms-secondary-button" :loading="markingAll" :disabled="!hasUnread" @click="markAllRead">
          {{ $t('notifications.markAllRead') }}
        </a-button>
      </template>
    </PmsPageHeader>

    <section class="notifications-panel pms-panel" aria-labelledby="notifications-filter-title">
      <div class="notifications-toolbar">
        <div>
          <h2 id="notifications-filter-title">{{ $t('notifications.filterTitle') }}</h2>
          <p>{{ $t('notifications.filterHint') }}</p>
        </div>
        <div class="notifications-filters" role="tablist" :aria-label="$t('notifications.filterTitle')">
          <button
            v-for="item in filters"
            :key="item.key"
            type="button"
            role="tab"
            :aria-selected="filter === item.key"
            :class="{ 'notifications-filter--active': filter === item.key }"
            @click="changeFilter(item.key)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <a-alert
        v-if="errorMessage"
        type="error"
        show-icon
        :message="$t('notifications.loadUnavailable')"
        :description="errorMessage"
      >
        <template #action>
          <a-button size="small" @click="load">{{ $t('common.retry') }}</a-button>
        </template>
      </a-alert>

      <div v-if="loading && !records.length" class="notifications-state">
        <a-spin :tip="$t('notifications.loading')" />
      </div>
      <a-empty v-else-if="!records.length" class="notifications-state" :description="$t('notifications.empty')" />
      <div v-else class="notifications-list" :aria-busy="loading">
        <button
          v-for="item in records"
          :key="item.id"
          type="button"
          class="notifications-item"
          :class="{ 'notifications-item--unread': !item.readAt }"
          @click="openNotification(item)"
        >
          <span class="notifications-item__type" :class="notificationTypeClass(item.type)">
            {{ $t(notificationTypeKey(item.type)) }}
          </span>
          <span class="notifications-item__body">
            <strong>{{ item.title }}</strong>
            <span v-if="item.content">{{ item.content }}</span>
          </span>
          <time class="notifications-item__time">{{ formatDateTime(item.createdAt) }}</time>
          <span v-if="!item.readAt" class="notifications-item__unread">{{ $t('notifications.unread') }}</span>
        </button>
      </div>

      <div v-if="total" class="notifications-pagination">
        <a-pagination
          :current="page"
          :page-size="pageSize"
          :total="total"
          :show-size-changer="false"
          show-less-items
          @change="changePage"
        />
      </div>
    </section>
  </div>
</template>
