<script setup lang="ts">
import {
  ArrowRightOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ProjectOutlined,
} from '@ant-design/icons-vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ProjectActionItem } from '/@/types/domain'
import { attentionTone } from '/@/views/project/detail/project-attention.mjs'
import {
  emptyActionState,
  filterActionItems,
  type ActionCenterFilter,
} from './action-center.mjs'
import type { WorkbenchActionCenter } from './workbench'

const props = defineProps<{
  actionCenter?: WorkbenchActionCenter
  hasAssignedTasks: boolean
}>()

const emit = defineEmits<{
  action: [item: ProjectActionItem]
}>()

const { t } = useI18n()
const activeFilter = ref<ActionCenterFilter>('ALL')
const actionCenter = computed<WorkbenchActionCenter>(() => props.actionCenter || {
  totalCount: 0,
  criticalCount: 0,
  warningCount: 0,
  items: [],
})
const filteredItems = computed(() => filterActionItems(actionCenter.value.items, activeFilter.value))
const emptyState = computed(() => emptyActionState(activeFilter.value, {
  totalCount: actionCenter.value.totalCount,
  hasAssignedTasks: props.hasAssignedTasks,
}))
const filters = computed<Array<{ key: ActionCenterFilter; label: string }>>(() => [
  { key: 'ALL', label: t('workbench.actionAll') },
  { key: 'OVERDUE', label: t('workbench.actionOverdue') },
  { key: 'TODAY', label: t('workbench.actionToday') },
  { key: 'PROJECT', label: t('workbench.actionProject') },
  { key: 'SOON', label: t('workbench.actionSoon') },
])

function actionLabel(item: ProjectActionItem) {
  return item.canAct ? (item.actionLabel || t('workbench.actionHandle')) : t('workbench.actionView')
}

function actionGroupIcon(item: ProjectActionItem) {
  if (item.type === 'TASK_OVERDUE') return ExclamationCircleOutlined
  if (item.type === 'TASK_DUE_TODAY' || item.type === 'TASK_DUE_SOON') return CalendarOutlined
  return ProjectOutlined
}

function emitAction(item: ProjectActionItem) {
  emit('action', item)
}
</script>

<template>
  <section class="workbench-action-center workbench-panel pms-panel" aria-labelledby="workbench-action-title">
    <div class="workbench-panel__header workbench-action-center__header">
      <div>
        <h2 id="workbench-action-title">{{ $t('workbench.actionTitle') }}</h2>
        <p>{{ $t('workbench.actionHint') }}</p>
      </div>
      <div class="workbench-action-center__counts">
        <span class="is-critical">{{ actionCenter.criticalCount }}</span>
        <span>{{ actionCenter.warningCount }}</span>
      </div>
    </div>

    <div class="workbench-action-center__filters" role="tablist" :aria-label="$t('workbench.actionFilters')">
      <button
        v-for="filter in filters"
        :key="filter.key"
        type="button"
        role="tab"
        :aria-selected="activeFilter === filter.key"
        :class="{ 'is-active': activeFilter === filter.key }"
        @click="activeFilter = filter.key"
      >
        {{ filter.label }}
      </button>
    </div>

    <div v-if="filteredItems.length" class="workbench-action-center__list">
      <button
        v-for="item in filteredItems"
        :key="`${item.projectId}-${item.type}-${item.nodeId || 'project'}-${item.taskId || 'none'}`"
        type="button"
        class="workbench-action-item"
        :class="`is-${attentionTone(item.severity)}`"
        @click="emitAction(item)"
      >
        <span class="workbench-action-item__icon">
          <component :is="actionGroupIcon(item)" />
        </span>
        <span class="workbench-action-item__main">
          <strong>{{ item.title }}</strong>
          <small>
            {{ item.projectName }}
            <template v-if="item.nodeName"> · {{ item.nodeName }}</template>
            <template v-if="item.taskName"> · {{ item.taskName }}</template>
          </small>
        </span>
        <span class="workbench-action-item__meta">
          <span v-if="item.overdueDays">{{ $t('workbench.actionOverdueDays', { count: item.overdueDays }) }}</span>
          <span>{{ actionLabel(item) }}</span>
          <ArrowRightOutlined />
        </span>
      </button>
    </div>

    <div v-else class="workbench-action-center__empty">
      <CheckCircleOutlined />
      <span v-if="emptyState === 'NO_TASKS'">{{ $t('workbench.actionEmptyTasks') }}</span>
      <span v-else-if="emptyState === 'NO_PROJECT_ISSUES'">{{ $t('workbench.actionEmptyProject') }}</span>
      <span v-else>{{ $t('workbench.actionEmptyTime') }}</span>
    </div>
  </section>
</template>

<style scoped>
.workbench-action-center {
  margin-bottom: 18px;
}

.workbench-action-center__header {
  align-items: flex-start;
}

.workbench-action-center__counts {
  display: flex;
  gap: 8px;
  color: var(--pms-text-tertiary);
  font-size: 12px;
}

.workbench-action-center__counts span {
  min-width: 26px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--pms-surface-muted);
  text-align: center;
}

.workbench-action-center__counts .is-critical {
  color: var(--pms-danger);
  background: color-mix(in srgb, var(--pms-danger) 8%, var(--pms-surface));
}

.workbench-action-center__filters {
  display: flex;
  gap: 6px;
  margin: 12px 0 8px;
  overflow-x: auto;
}

.workbench-action-center__filters button {
  padding: 5px 11px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--pms-text-secondary);
  cursor: pointer;
  white-space: nowrap;
}

.workbench-action-center__filters button:hover,
.workbench-action-center__filters button.is-active {
  border-color: var(--pms-border);
  background: var(--pms-surface-muted);
  color: var(--pms-primary);
}

.workbench-action-center__list {
  display: grid;
  gap: 5px;
}

.workbench-action-item {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  padding: 10px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.workbench-action-item:hover {
  background: var(--pms-surface-muted);
}

.workbench-action-item__icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  border-radius: 8px;
  color: var(--pms-primary);
  background: var(--pms-primary-soft);
}

.workbench-action-item.is-critical .workbench-action-item__icon {
  color: var(--pms-danger);
  background: color-mix(in srgb, var(--pms-danger) 8%, var(--pms-surface));
}

.workbench-action-item__main {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
}

.workbench-action-item__main strong,
.workbench-action-item__main small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workbench-action-item__meta {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--pms-text-tertiary);
  font-size: 12px;
  white-space: nowrap;
}

.workbench-action-item.is-critical .workbench-action-item__meta span:first-child {
  color: var(--pms-danger);
}

.workbench-action-center__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 90px;
  color: var(--pms-success);
}

@media (max-width: 760px) {
  .workbench-action-item__meta span:not(:first-child),
  .workbench-action-item__meta .anticon {
    display: none;
  }
}
</style>
