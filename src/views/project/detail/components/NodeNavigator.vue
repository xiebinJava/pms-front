<script setup lang="ts">
import { ArrowRightOutlined, CheckOutlined } from '@ant-design/icons-vue'
import type { ProjectNode } from '/@/types/domain'
import { formatDate } from '/@/utils/format'
import { getFlowNodeState } from '../workflow'

defineProps<{ nodes: ProjectNode[]; activeId: number }>()
const emit = defineEmits<{ (e: 'select', node: ProjectNode): void }>()
</script>

<template>
  <div class="flow-navigator" :aria-label="$t('detail.flow')">
    <div v-if="nodes.length === 0" class="flow-empty">{{ $t('detail.flowEmpty') }}</div>
    <div v-else class="flow-track">
      <template v-for="(node, index) in nodes" :key="node.id">
        <div class="flow-track__item">
          <button
            type="button"
            class="flow-node"
            :class="[
              `flow-node--${getFlowNodeState(node.status).tone}`,
              { 'flow-node--selected': node.id === activeId },
            ]"
            :disabled="!getFlowNodeState(node.status).canSelect"
            @click="getFlowNodeState(node.status).canSelect && emit('select', node)"
          >
            <span class="flow-node__dot">
              <CheckOutlined v-if="node.status === 2" />
              <span v-else class="flow-node__dot-core" />
            </span>
            <span class="flow-node__content">
              <span class="flow-node__name">{{ node.name }}</span>
              <span class="flow-node__meta">
                <span class="node-owner">
                  <span>{{ $t('detail.nodeCardOwner') }}</span>
                  <strong>{{ node.ownerName || $t('detail.unassigned') }}</strong>
                </span>
                <span class="node-deadline">
                  <span>{{ $t('detail.nodeCardDeadline') }}</span>
                  <strong>{{ node.endDate ? formatDate(node.endDate) : $t('detail.notSet') }}</strong>
                </span>
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
</template>

<style scoped>
.flow-navigator {
  overflow-x: auto;
  padding: 10px 4px 16px;
  scrollbar-width: thin;
}

.flow-track {
  display: flex;
  align-items: center;
  min-width: max-content;
  padding: 12px 8px 8px;
}

.flow-node {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-width: 230px;
  padding: 10px 14px 10px 11px;
  color: var(--pms-text);
  text-align: left;
  background: var(--pms-surface);
  border: 1px solid var(--pms-border-strong);
  border-radius: var(--pms-radius);
  cursor: pointer;
  transition: border-color var(--pms-motion-fast) ease, box-shadow var(--pms-motion-fast) ease, transform var(--pms-motion-fast) ease;
}

.flow-node:hover:not(:disabled) {
  border-color: var(--pms-primary);
  box-shadow: var(--pms-shadow-interactive);
  transform: translateY(-1px);
}

.flow-node:disabled {
  color: var(--pms-text-faint);
  cursor: not-allowed;
  background: var(--pms-surface-muted);
  border-color: var(--pms-border);
}

.flow-node--selected {
  border-color: var(--pms-primary);
  box-shadow: 0 0 0 3px rgb(22 119 255 / 12%);
}

.flow-node--completed .flow-node__dot {
  color: var(--pms-success);
  background: var(--pms-success-soft);
  border-color: color-mix(in srgb, var(--pms-success) 30%, var(--pms-border));
}

.flow-node--active .flow-node__dot {
  background: var(--pms-surface);
  border-color: var(--pms-status-active);
}

.flow-node--locked .flow-node__dot {
  color: var(--pms-status-neutral);
  background: var(--pms-surface);
  border-color: var(--pms-status-neutral);
}

.flow-node--terminated .flow-node__dot {
  color: #fff;
  background: var(--pms-danger);
  border-color: var(--pms-danger);
}

.flow-node--terminated .flow-node__dot-core {
  background: var(--pms-danger);
}

.flow-node__dot {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: var(--pms-primary);
  font-size: var(--pms-font-size-caption);
  border: 2px solid var(--pms-primary);
  border-radius: 50%;
}

.flow-node__dot-core {
  width: 7px;
  height: 7px;
  background: var(--pms-status-neutral);
  border-radius: 50%;
}

.flow-node--active .flow-node__dot-core {
  background: var(--pms-status-active);
}

.flow-node__content {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.flow-node__name {
  max-width: 210px;
  overflow: hidden;
  color: var(--pms-text);
  font-size: var(--pms-font-size-body);
  font-weight: 500;
  line-height: var(--pms-line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-node__meta { display: grid; gap: 3px; margin-top: 5px; color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); line-height: var(--pms-line-height-tight); }
.node-owner, .node-deadline { display: flex; min-width: 0; gap: 4px; }
.node-owner > span, .node-deadline > span { flex: 0 0 auto; }
.node-owner strong, .node-deadline strong { overflow: hidden; color: var(--pms-text-muted); font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.flow-node:disabled .node-owner strong, .flow-node:disabled .node-deadline strong { color: var(--pms-text-faint); }

.flow-connector {
  display: inline-flex;
  align-items: center;
  width: 52px;
  color: var(--pms-text-faint);
}

.flow-connector__line {
  flex: 1;
  height: 1px;
  background: var(--pms-border);
}

.flow-connector__arrow {
  font-size: var(--pms-font-size-compact);
}

.flow-empty {
  padding: 32px;
  color: var(--pms-text-faint);
  font-size: var(--pms-font-size-compact);
  text-align: center;
  background: var(--pms-surface-muted);
  border-radius: var(--pms-radius);
}
</style>
