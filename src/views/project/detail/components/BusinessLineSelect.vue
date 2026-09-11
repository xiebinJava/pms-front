<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CloseOutlined, DownOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons-vue'
import {
  filterBusinessLineOptions,
  getBusinessLineLabels,
  getBusinessLineTreeRows,
} from '../workflow'
import type { BusinessLineOption, BusinessLineTreeRow } from '../workflow'

const props = withDefaults(defineProps<{
  modelValue?: number[]
  options?: BusinessLineOption[]
  placeholder?: string
  disabled?: boolean
  allowClear?: boolean
}>(), {
  modelValue: () => [],
  options: () => [],
  placeholder: '',
  disabled: false,
  allowClear: true,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: number[] | undefined): void
}>()

const { t } = useI18n()
const open = ref(false)
const keyword = ref('')
const hoverPath = ref<number[]>([])
const rootRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const searchRef = ref<HTMLInputElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})

const selectedPath = computed(() => (props.modelValue?.length ? props.modelValue : []))
const selectedLabel = computed(() => getBusinessLineLabels(props.options, selectedPath.value).join(' / '))
const filteredOptions = computed(() => filterBusinessLineOptions(props.options, keyword.value))
const rows = computed(() => getBusinessLineTreeRows(filteredOptions.value, hoverPath.value, Boolean(keyword.value.trim())))
const canClear = computed(() => props.allowClear && !props.disabled && selectedPath.value.length > 0)
const emptyText = computed(() => (
  keyword.value.trim() ? t('detail.noMatchingBusinessLine') : t('detail.selectBusinessLine')
))

function updateDropdownPosition() {
  const trigger = rootRef.value?.querySelector('.business-line-select__trigger') as HTMLElement | null
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  const width = Math.round(rect.width)
  const height = dropdownRef.value?.offsetHeight || 280
  let left = rect.left
  if (left + width > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - 8 - width)
  }
  let top = rect.bottom + 4
  if (top + height > window.innerHeight - 8 && rect.top > height + 8) {
    top = rect.top - 4 - height
  }
  dropdownStyle.value = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    width: `${width}px`,
  }
}

function openMenu() {
  if (props.disabled) return
  keyword.value = ''
  hoverPath.value = [...selectedPath.value]
  updateDropdownPosition()
  open.value = true
  void nextTick(() => {
    updateDropdownPosition()
    searchRef.value?.focus()
    dropdownRef.value?.querySelector('.business-line-select__option--selected')?.scrollIntoView({ block: 'nearest' })
  })
}

function closeMenu() {
  open.value = false
  keyword.value = ''
}

function toggleMenu() {
  if (open.value) closeMenu()
  else openMenu()
}

function onHover(row: BusinessLineTreeRow) {
  if (keyword.value.trim()) return
  hoverPath.value = row.path
}

function onSelect(row: BusinessLineTreeRow) {
  hoverPath.value = row.path
  emit('update:modelValue', row.path)
  closeMenu()
}

function onClear(event: Event) {
  event.stopPropagation()
  emit('update:modelValue', undefined)
  hoverPath.value = []
  closeMenu()
}

function isSelected(row: BusinessLineTreeRow) {
  const current = selectedPath.value
  return current.length === row.path.length && current.every((id, index) => id === row.path[index])
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!open.value) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (rootRef.value?.contains(target) || dropdownRef.value?.contains(target)) return
  closeMenu()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', updateDropdownPosition)
  window.removeEventListener('scroll', updateDropdownPosition, true)
})

watch(() => props.disabled, (disabled) => {
  if (disabled) closeMenu()
})

watch(open, (isOpen) => {
  if (isOpen) {
    window.addEventListener('resize', updateDropdownPosition)
    window.addEventListener('scroll', updateDropdownPosition, true)
    return
  }
  window.removeEventListener('resize', updateDropdownPosition)
  window.removeEventListener('scroll', updateDropdownPosition, true)
})
</script>

<template>
  <div ref="rootRef" class="business-line-select" :class="{ 'business-line-select--open': open, 'business-line-select--disabled': disabled }">
    <button
      type="button"
      class="business-line-select__trigger"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggleMenu"
    >
      <span v-if="selectedLabel" class="business-line-select__value" :title="selectedLabel">{{ selectedLabel }}</span>
      <span v-else class="business-line-select__placeholder">{{ placeholder }}</span>
      <span class="business-line-select__suffix">
        <CloseOutlined v-if="canClear" class="business-line-select__clear" @click="onClear" />
        <DownOutlined class="business-line-select__arrow" />
      </span>
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        ref="dropdownRef"
        class="business-line-select-dropdown"
        :style="dropdownStyle"
      >
        <label class="business-line-select__search">
          <SearchOutlined class="business-line-select__search-icon" />
          <input
            ref="searchRef"
            v-model="keyword"
            type="search"
            class="business-line-select__search-input"
            :placeholder="t('detail.searchBusinessLine')"
            :aria-label="t('detail.searchBusinessLine')"
          >
        </label>
        <ul v-if="rows.length" class="business-line-select__tree" role="listbox">
          <li
            v-for="row in rows"
            :key="row.path.join('-')"
            class="business-line-select__option"
            :class="{
              'business-line-select__option--active': hoverPath[hoverPath.length - 1] === row.value && hoverPath.length === row.path.length,
              'business-line-select__option--selected': isSelected(row),
              'business-line-select__option--branch': row.hasChildren,
              'business-line-select__option--expanded': row.expanded,
            }"
            :style="{ paddingLeft: `${10 + row.depth * 16}px` }"
            role="option"
            :aria-selected="isSelected(row)"
            @mouseenter="onHover(row)"
            @click="onSelect(row)"
          >
            <span class="business-line-select__option-toggle" aria-hidden="true">
              <RightOutlined v-if="row.hasChildren" />
            </span>
            <span class="business-line-select__option-label">{{ row.label }}</span>
          </li>
        </ul>
        <p v-else class="business-line-select__empty">{{ emptyText }}</p>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.business-line-select { position: relative; width: 100%; }
.business-line-select__trigger {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 36px;
  padding: 4px 11px;
  color: var(--pms-text);
  text-align: left;
  background: var(--pms-surface);
  border: 1px solid var(--pms-border);
  border-radius: 6px;
  cursor: pointer;
}
.business-line-select--open .business-line-select__trigger,
.business-line-select__trigger:hover:not(:disabled) { border-color: var(--pms-primary); }
.business-line-select__trigger:disabled { color: var(--pms-text-faint); background: var(--pms-surface-muted); cursor: not-allowed; }
.business-line-select__value,
.business-line-select__placeholder { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.business-line-select__placeholder { color: var(--pms-text-faint); }
.business-line-select__suffix { display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; color: var(--pms-text-faint); }
.business-line-select__clear { font-size: 10px; cursor: pointer; }
.business-line-select__clear:hover { color: var(--pms-text); }
</style>

<style>
.business-line-select-dropdown {
  position: fixed;
  z-index: 1050;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  max-height: 320px;
  overflow: hidden;
  background: var(--pms-surface, #fff);
  border: 1px solid var(--pms-border, #e5eaf2);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(23 36 64 / 12%);
}
.business-line-select__search {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  margin: 8px 8px 0;
  padding: 0 8px;
  color: var(--pms-text-faint, #8997aa);
  background: var(--pms-surface-muted, #f8faff);
  border: 1px solid var(--pms-border, #e5eaf2);
  border-radius: 6px;
}
.business-line-select__search-icon { font-size: 12px; }
.business-line-select__search-input {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0;
  color: var(--pms-text, #17243b);
  background: transparent;
  border: 0;
  outline: none;
}
.business-line-select__search-input::-webkit-search-cancel-button { display: none; }
.business-line-select__tree {
  flex: 1 1 auto;
  min-height: 0;
  margin: 0;
  padding: 6px;
  overflow: auto;
  list-style: none;
}
.business-line-select__option {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding-right: 8px;
  color: var(--pms-text, #17243b);
  border-radius: 6px;
  cursor: pointer;
}
.business-line-select__option:hover,
.business-line-select__option--active { background: var(--pms-surface-muted, #f8faff); }
.business-line-select__option--selected { color: var(--pms-primary, #1769e0); font-weight: 650; }
.business-line-select__option-toggle {
  display: inline-flex;
  flex: 0 0 12px;
  align-items: center;
  justify-content: center;
  width: 12px;
  color: var(--pms-text-faint, #8997aa);
  font-size: 10px;
}
.business-line-select__option--expanded .business-line-select__option-toggle { transform: rotate(90deg); }
.business-line-select__option-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.business-line-select__empty {
  margin: 0;
  padding: 18px 12px;
  color: var(--pms-text-faint, #8997aa);
  text-align: center;
}
</style>
