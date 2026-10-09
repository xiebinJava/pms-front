<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SourceRequirementSummary } from '/@/types/domain'

const props = withDefaults(defineProps<{
  items?: SourceRequirementSummary[]
  compact?: boolean
  label?: string
}>(), {
  items: () => [],
  compact: false,
})

const emit = defineEmits<{
  open: [id: number]
}>()

const { t } = useI18n()
const displayItems = computed(() => (props.items || []).filter((item) => item?.id != null))
const labelText = computed(() => props.label || t('developmentDetail.sourceRequirement'))

function openRequirement(item: SourceRequirementSummary) {
  emit('open', item.id)
}
</script>

<template>
  <div
    v-if="displayItems.length"
    class="source-requirement-list"
    :class="{ 'source-requirement-list--compact': compact }"
  >
    <span class="source-requirement-list__label">{{ labelText }}：</span>
    <div class="source-requirement-list__items">
      <button
        v-for="(item, index) in displayItems"
        :key="item.id"
        type="button"
        class="source-requirement-list__item"
        :title="item.title"
        @click.stop="openRequirement(item)"
      >
        <span v-if="displayItems.length > 1" class="source-requirement-list__index">{{ index + 1 }}</span>
        <span class="source-requirement-list__title">{{ item.title }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.source-requirement-list { display: flex; align-items: flex-start; min-width: 0; gap: 8px; }
.source-requirement-list__label { flex: 0 0 auto; color: var(--pms-text-faint); }
.source-requirement-list__items { display: flex; flex: 1 1 auto; flex-direction: column; min-width: 0; gap: 3px; max-height: 116px; overflow-y: auto; }
.source-requirement-list__item { display: flex; align-items: baseline; min-width: 0; gap: 5px; padding: 0; border: 0; background: transparent; color: var(--pms-primary); font: inherit; line-height: 1.45; text-align: left; cursor: pointer; }
.source-requirement-list__item:hover { text-decoration: underline; }
.source-requirement-list__index { flex: 0 0 auto; color: var(--pms-text-faint); font-size: 11px; }
.source-requirement-list__title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.source-requirement-list--compact { width: min(100%, 280px); }
.source-requirement-list--compact .source-requirement-list__items { max-height: 72px; }
@media (max-width: 640px) {
  .source-requirement-list { width: 100%; white-space: normal; }
  .source-requirement-list__title { white-space: normal; overflow-wrap: anywhere; }
}
</style>
