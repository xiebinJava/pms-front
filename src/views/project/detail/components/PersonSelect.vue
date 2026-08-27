<script setup lang="ts">
import { computed } from 'vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import { formatPersonLabel, getSinglePersonSelection, normalizePersonDisplayLabel } from '../workflow'
import type { PersonOption } from '../workflow'

const props = withDefaults(defineProps<{
  modelValue?: number | number[] | null
  options: PersonOption[]
  multiple?: boolean
  placeholder?: string
  loading?: boolean
  remoteSearch?: boolean
  maxTagCount?: number | 'responsive'
  disabled?: boolean
}>(), {
  multiple: false,
  placeholder: '请选择人员',
  loading: false,
  remoteSearch: false,
  maxTagCount: 2,
  disabled: false,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: number | number[] | undefined): void
  (event: 'change', value: number | number[] | undefined): void
  (event: 'search', value: string): void
}>()

const selectedValues = computed<number[]>(() => {
  if (Array.isArray(props.modelValue)) return props.modelValue
  return props.modelValue == null ? [] : [props.modelValue]
})

function findOption(value: number | string): PersonOption | undefined {
  return props.options.find((option) => option.value === Number(value))
}

function getLabel(value: number | string, label?: string): string {
  return normalizePersonDisplayLabel(label || findOption(value)?.label)
    || formatPersonLabel({ id: Number(value) })
}

function getAvatar(value: number | string): string | undefined {
  return findOption(value)?.avatar
}

function getInitials(label: string): string {
  return label.replace(/\s*(?:\([^)]*\)|（[^）]*）)\s*$/, '').slice(0, 2) || '?'
}

function onChange(values: number[]) {
  const nextValue = props.multiple ? values : getSinglePersonSelection(values)
  emit('update:modelValue', nextValue)
  emit('change', nextValue)
}
</script>

<template>
  <a-select
    :value="selectedValues"
    class="person-select"
    :options="options"
    :loading="loading"
    mode="multiple"
    :max-tag-count="multiple ? maxTagCount : undefined"
    show-search
    :filter-option="remoteSearch ? false : true"
    option-filter-prop="label"
    :placeholder="placeholder"
    :disabled="disabled"
    @change="onChange"
    @search="(value: string) => emit('search', value)"
  >
    <template #option="{ value, label }">
      <span class="person-select__option">
        <a-avatar :src="getAvatar(value)" :size="20">{{ getInitials(String(label)) }}</a-avatar>
        <span>{{ getLabel(value, label) }}</span>
      </span>
    </template>
    <template #tagRender="{ value, label, closable, onClose }">
      <span class="person-select__chip">
        <a-avatar :src="getAvatar(value)" :size="18">{{ getInitials(getLabel(value, label)) }}</a-avatar>
        <span class="person-select__chip-label">{{ getLabel(value, label) }}</span>
        <CloseOutlined v-if="closable" class="person-select__chip-close" @click.stop="onClose" />
      </span>
    </template>
  </a-select>
</template>

<style scoped>
.person-select { width: 100%; }
.person-select :deep(.ant-select-selector) { min-height: 36px; align-items: center; }
.person-select :deep(.ant-select-selection-overflow) { column-gap: 4px; row-gap: 4px; }
.person-select :deep(.ant-select-selection-item) { margin-inline-end: 0; }
.person-select__option, .person-select__chip { display: inline-flex; align-items: center; gap: 7px; }
.person-select__chip { max-width: 100%; padding: 2px 6px 2px 3px; color: var(--pms-text); background: var(--pms-surface-strong); border: 1px solid var(--pms-border); border-radius: 5px; }
.person-select__chip-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.person-select__chip-close { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); cursor: pointer; }
</style>
