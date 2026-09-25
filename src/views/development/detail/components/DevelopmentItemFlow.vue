<script setup lang="ts">
import { ArrowRightOutlined, CheckOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import type { DevelopmentItemWorkflowNode } from '/@/types/domain'
import { formatDate } from '/@/utils/format'

defineProps<{
  nodes: DevelopmentItemWorkflowNode[]
  selectedNodeId?: number
}>()

const emit = defineEmits<{ select: [nodeId: number] }>()
const { t } = useI18n()

function statusKey(status: number) {
  if (status === 2) return 'completed'
  if (status === 1) return 'active'
  return 'locked'
}
</script>

<template>
  <section class="flow-card pms-detail-panel pms-section-panel card-surface" :aria-label="t('developmentDetail.flowTitle')">
    <div class="section-title-row pms-section-heading">
      <div>
        <h2>{{ t('developmentDetail.flowTitle') }}</h2>
        <p>{{ t('developmentDetail.flowHint') }}</p>
      </div>
      <span class="flow-count">{{ nodes.length }} {{ t('developmentDetail.nodeUnit') }}</span>
    </div>
    <div class="flow-navigator" :aria-label="t('developmentDetail.flowTitle')">
      <div class="flow-track">
        <template v-for="(node, index) in nodes" :key="node.id">
          <div class="flow-track__item">
            <button
              type="button"
              class="flow-node"
              :class="[`flow-node--${statusKey(node.status)}`, { 'flow-node--selected': selectedNodeId === node.id }]"
              :aria-current="selectedNodeId === node.id ? 'step' : undefined"
              :aria-label="`${node.name} · ${t(`developmentDetail.nodeStatus.${statusKey(node.status)}`)}`"
              @click="emit('select', node.id)"
            >
              <span class="flow-node__dot">
                <CheckOutlined v-if="node.status === 2" />
                <span v-else class="flow-node__dot-core" />
              </span>
              <span class="flow-node__content">
                <span class="flow-node__name">{{ node.name }}</span>
                <span class="flow-node__meta">
                  <span class="node-owner"><span>{{ t('developmentDetail.nodeOwner') }}</span><strong>{{ node.ownerName || t('common.unset') }}</strong></span>
                  <span class="node-deadline"><span>{{ t('developmentDetail.nodeSchedule') }}</span><strong>{{ node.endDate ? formatDate(node.endDate) : '—' }}</strong></span>
                </span>
              </span>
            </button>
            <span v-if="index < nodes.length - 1" class="flow-connector" aria-hidden="true">
              <span class="flow-connector__line" />
              <ArrowRightOutlined class="flow-connector__arrow" />
            </span>
          </div>
        </template>
      </div>
    </div>
    <div v-if="nodes.length > 1" class="flow-navigator__hint" role="note">{{ t('developmentDetail.flowScrollHint') }}</div>
  </section>
</template>

<style scoped>
.flow-card { min-width: 0; }
.section-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.section-title-row h2 { margin: 0; color: var(--pms-text); font-size: 16px; font-weight: 730; line-height: var(--pms-line-height-tight); }
.section-title-row p { margin: 5px 0 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.flow-count { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 5px; padding: 5px 9px; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); background: var(--pms-surface-muted); border-radius: 6px; }
.flow-navigator { overflow-x: auto; padding: 4px 0 13px; scrollbar-width: thin; }
.flow-navigator__hint { display: flex; justify-content: flex-end; padding: 0 8px; color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.flow-track { display: flex; align-items: center; min-width: max-content; padding: 10px 4px 5px; }
.flow-track__item { display: inline-flex; align-items: center; }
.flow-node { display: inline-flex; align-items: center; gap: 9px; min-width: 148px; padding: 10px 14px 10px 11px; color: var(--pms-text); text-align: left; background: var(--pms-surface); border: 1px solid var(--pms-border-strong); border-radius: 7px; box-shadow: var(--pms-shadow-sm); cursor: pointer; transition: border-color var(--pms-motion-fast) ease, box-shadow var(--pms-motion-fast) ease, transform var(--pms-motion-fast) ease; }
.flow-node:hover { border-color: var(--pms-primary); box-shadow: var(--pms-shadow-interactive); transform: translateY(-1px); }
.flow-node--selected { border-color: var(--pms-primary); background: var(--pms-primary-soft); box-shadow: 0 0 0 3px var(--pms-primary-soft), var(--pms-shadow-sm); }
.flow-node--completed .flow-node__dot { color: var(--pms-success); background: var(--pms-success-soft); border-color: color-mix(in srgb, var(--pms-success) 30%, var(--pms-border)); }
.flow-node--active .flow-node__dot { background: var(--pms-surface); border-color: var(--pms-status-active); }
.flow-node--locked { background: var(--pms-surface-muted); border-color: var(--pms-border); }
.flow-node--locked .flow-node__dot { color: var(--pms-status-neutral); background: var(--pms-surface); border-color: var(--pms-status-neutral); }
.flow-node__dot { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 18px; height: 18px; color: var(--pms-primary); font-size: var(--pms-font-size-caption); border: 2px solid var(--pms-primary); border-radius: 50%; }
.flow-node__dot-core { width: 7px; height: 7px; background: var(--pms-status-neutral); border-radius: 50%; }
.flow-node--active .flow-node__dot-core { background: var(--pms-status-active); }
.flow-node__content { display: flex; flex-direction: column; min-width: 0; gap: 1px; }
.flow-node__name { max-width: 210px; overflow: hidden; color: var(--pms-text); font-size: var(--pms-font-size-body); font-weight: 500; line-height: var(--pms-line-height-tight); text-overflow: ellipsis; white-space: nowrap; }
.flow-node__meta { display: grid; gap: 3px; margin-top: 5px; color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); line-height: var(--pms-line-height-tight); }
.node-owner,.node-deadline { display: flex; min-width: 0; gap: 4px; }
.node-owner > span,.node-deadline > span { flex: 0 0 auto; }
.node-owner strong,.node-deadline strong { overflow: hidden; color: var(--pms-text-muted); font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.flow-connector { display: inline-flex; align-items: center; width: 45px; color: var(--pms-border-strong); }
.flow-connector__line { flex: 1; height: 1px; background: var(--pms-border-strong); }
.flow-connector__arrow { flex: 0 0 auto; margin-left: -3px; font-size: 10px; }
.flow-node:focus-visible { outline: 2px solid var(--pms-primary); outline-offset: 2px; }
@media (max-width: 640px) { .section-title-row { align-items: flex-start; flex-direction: column; } .flow-node { min-width: 190px; } .flow-connector { width: 30px; } }
</style>
