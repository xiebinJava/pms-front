<script setup lang="ts">
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons-vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { attentionTone } from '../project-attention.mjs'
import type { ProjectActionItem, ProjectReadiness } from '/@/types/domain'

const props = defineProps<{
  readiness?: ProjectReadiness
}>()

const emit = defineEmits<{
  action: [item: ProjectActionItem]
}>()

const { t } = useI18n()
const modalOpen = ref(false)

const readiness = computed<ProjectReadiness>(() => props.readiness || {
  completedCount: 0,
  totalCount: 0,
  percent: 0,
  criticalCount: 0,
  warningCount: 0,
  items: [],
})
const nextAction = computed(() => readiness.value.nextAction || readiness.value.items[0])

function actionLabel(item: ProjectActionItem) {
  if (!item.canAct) return t('detail.attentionView')
  return item.actionLabel || t('detail.attentionAction')
}

function emitAction(item: ProjectActionItem) {
  modalOpen.value = false
  emit('action', item)
}
</script>

<template>
  <div class="project-readiness-summary" aria-label="项目推进摘要">
    <div class="project-readiness-summary__chips">
      <a-button
        v-if="readiness.criticalCount"
        type="text"
        class="project-readiness-summary__chip project-readiness-summary__chip--critical"
        @click="modalOpen = true"
      >
        <ExclamationCircleOutlined />
        <span>{{ $t('detail.attentionSummaryCritical') }} {{ readiness.criticalCount }}</span>
      </a-button>
      <a-button
        type="text"
        class="project-readiness-summary__chip project-readiness-summary__chip--warning"
        @click="modalOpen = true"
      >
        <span>{{ $t('detail.attentionSummaryWarning') }} {{ readiness.warningCount }}</span>
      </a-button>
      <a-button
        v-if="nextAction"
        type="link"
        class="project-readiness-summary__next-action"
        :title="nextAction.title"
        @click="emitAction(nextAction)"
      >
        <span class="project-readiness-summary__next-label">{{ $t('detail.attentionNextAction') }}：</span>
        <span class="project-readiness-summary__next-title">{{ nextAction.title }}</span>
        <ArrowRightOutlined />
      </a-button>
      <span v-if="!readiness.items.length" class="project-readiness-summary__clear">
        <CheckCircleOutlined /> {{ $t('detail.attentionAllClear') }}
      </span>
    </div>

    <a-modal
      v-model:open="modalOpen"
      class="project-readiness-modal"
      :title="$t('detail.attentionTitle')"
      :footer="null"
      width="640px"
    >
      <p class="project-readiness-modal__hint">{{ $t('detail.attentionHint') }}</p>
      <div class="project-readiness-summary__list">
        <button
          v-for="item in readiness.items"
          :key="`${item.type}-${item.nodeId || 'project'}-${item.taskId || 'none'}`"
          type="button"
          class="project-readiness-summary__item"
          :class="`is-${attentionTone(item.severity)}`"
          @click="emitAction(item)"
        >
          <span class="project-readiness-summary__item-dot" />
          <span class="project-readiness-summary__item-main">
            <strong>{{ item.nodeName || item.taskName || item.title }}</strong>
            <small>{{ item.title }}</small>
          </span>
          <span class="project-readiness-summary__item-meta">
            <span>{{ actionLabel(item) }}</span>
            <ArrowRightOutlined />
          </span>
        </button>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.project-readiness-summary {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
}

.project-readiness-summary__chips {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

.project-readiness-summary :deep(.ant-btn) {
  height: 24px;
  min-height: 24px;
  padding: 0 7px;
  font-size: 11px;
  line-height: 22px;
}

.project-readiness-summary__chip,
.project-readiness-summary__next-action {
  display: inline-flex;
  align-items: center;
  height: 24px;
  min-height: 24px;
  padding: 0 7px;
  border: 1px solid var(--pms-border);
  border-radius: 999px;
  font-size: 11px;
  line-height: 1.35;
}

.project-readiness-summary__chip {
  gap: 5px;
  color: var(--pms-text-muted);
  background: var(--pms-surface-muted);
}

.project-readiness-summary__chip--critical {
  color: var(--pms-danger);
  border-color: color-mix(in srgb, var(--pms-danger) 26%, var(--pms-border));
  background: color-mix(in srgb, var(--pms-danger) 5%, var(--pms-surface));
}

.project-readiness-summary__chip--warning {
  color: var(--pms-warning);
  border-color: color-mix(in srgb, var(--pms-warning) 28%, var(--pms-border));
  background: color-mix(in srgb, var(--pms-warning) 6%, var(--pms-surface));
}

.project-readiness-summary__next-action {
  max-width: min(360px, 100%);
  gap: 4px;
  overflow: hidden;
  color: var(--pms-text);
  border-color: color-mix(in srgb, var(--pms-primary) 22%, var(--pms-border));
  background: var(--pms-primary-soft);
}

.project-readiness-summary__next-action:hover {
  border-color: var(--pms-primary);
  background: color-mix(in srgb, var(--pms-primary) 10%, var(--pms-surface));
}

.project-readiness-summary__next-label {
  flex: 0 0 auto;
  color: var(--pms-text-muted);
}

.project-readiness-summary__next-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-readiness-summary__clear {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 24px;
  color: var(--pms-success);
  font-size: 11px;
}

.project-readiness-modal__hint {
  margin: -4px 0 14px;
  color: var(--pms-text-muted);
  font-size: 12px;
}

.project-readiness-summary__list {
  display: grid;
  gap: 6px;
}

.project-readiness-summary__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.project-readiness-summary__item:hover {
  background: var(--pms-surface-muted);
}

.project-readiness-summary__item-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--pms-warning);
}

.project-readiness-summary__item.is-critical .project-readiness-summary__item-dot {
  background: var(--pms-danger);
}

.project-readiness-summary__item.is-warning .project-readiness-summary__item-dot {
  background: var(--pms-status-active);
}

.project-readiness-summary__item.is-info .project-readiness-summary__item-dot {
  background: var(--pms-primary);
}

.project-readiness-summary__item-main {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
}

.project-readiness-summary__item-main strong,
.project-readiness-summary__item-main small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-readiness-summary__item-main strong {
  color: var(--pms-text);
  font-size: 13px;
}

.project-readiness-summary__item-main small {
  color: var(--pms-text-muted);
  font-size: 12px;
}

.project-readiness-summary__item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--pms-text-faint);
  font-size: 12px;
}

@media (max-width: 640px) {
  .project-readiness-summary__chips {
    align-items: flex-start;
  }

  .project-readiness-summary__next-action {
    max-width: 100%;
  }
}
</style>
