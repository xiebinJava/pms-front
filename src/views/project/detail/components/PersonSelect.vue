<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CloseOutlined } from '@ant-design/icons-vue'
import { searchUsers } from '/@/api/user'
import { useUserStore } from '/@/store/user'
import {
  formatPersonLabel,
  getSinglePersonSelection,
  isSelectableAccount,
  listPersonSelectOptions,
  normalizePersonDisplayLabel,
  NOTE_ASSIGNED_PROJECT_MEMBER,
  REMEMBER_PERSON_OPTION,
  pickFallbackPeople,
  readRecentPeople,
  rememberRecentPeople,
  RECENT_PERSON_LIMIT,
} from '../workflow'
import type { PersonOption } from '../workflow'
import type { User } from '/@/types/domain'

const props = withDefaults(defineProps<{
  modelValue?: number | number[] | null
  options?: PersonOption[]
  multiple?: boolean
  placeholder?: string
  loading?: boolean
  remoteSearch?: boolean
  maxTagCount?: number | 'responsive'
  disabled?: boolean
  allowClear?: boolean
}>(), {
  options: () => [],
  multiple: false,
  placeholder: '',
  loading: false,
  remoteSearch: true,
  maxTagCount: 2,
  disabled: false,
  allowClear: false,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: number | number[] | undefined): void
  (event: 'change', value: number | number[] | undefined): void
  (event: 'search', value: string): void
}>()

const { t } = useI18n()
const userStore = useUserStore()
const searching = ref(false)
const searchKeyword = ref('')
const extraOptions = ref<PersonOption[]>([])
const rememberedOptions = ref<PersonOption[]>([])
const recentOptions = ref<PersonOption[]>([])
const fallbackPool = ref<PersonOption[]>([])
const openOptions = ref<PersonOption[]>([])
const noteAssigned = inject<(() => void) | undefined>(NOTE_ASSIGNED_PROJECT_MEMBER, undefined)
const rememberPersonOption = inject<((option: PersonOption) => void) | undefined>(REMEMBER_PERSON_OPTION, undefined)
const resolvedPlaceholder = computed(() => props.placeholder || t('detail.selectPerson'))
const emptyText = computed(() => (
  searchKeyword.value.trim() ? t('detail.noMatchingPerson') : t('detail.searchPersonHint')
))
const labelOptions = computed(() => {
  const optionMap = new Map<number, PersonOption>()
  rememberedOptions.value.forEach((option) => optionMap.set(option.value, option))
  recentOptions.value.forEach((option) => optionMap.set(option.value, option))
  openOptions.value.forEach((option) => optionMap.set(option.value, option))
  fallbackPool.value.forEach((option) => optionMap.set(option.value, option))
  props.options.forEach((option) => optionMap.set(option.value, option))
  extraOptions.value.forEach((option) => optionMap.set(option.value, option))
  return Array.from(optionMap.values())
})
const selectedValues = computed<number[]>(() => {
  if (Array.isArray(props.modelValue)) return props.modelValue
  return props.modelValue == null ? [] : [props.modelValue]
})
const dropdownOptions = computed(() => {
  const listed = listPersonSelectOptions({
    keyword: searchKeyword.value,
    recent: openOptions.value,
    fallback: fallbackPool.value,
    searchResults: extraOptions.value,
  })
  const optionMap = new Map<number, PersonOption>()
  selectedValues.value.forEach((value) => {
    const option = labelOptions.value.find((item) => item.value === value)
    if (option) optionMap.set(option.value, option)
  })
  listed.forEach((option) => optionMap.set(option.value, option))
  return Array.from(optionMap.values())
})

let searchToken = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined
let fallbackPoolPromise: Promise<PersonOption[]> | null = null

function getLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function currentUserId() {
  return userStore.user?.id
}

function toOption(user: User): PersonOption {
  return { value: user.id, label: formatPersonLabel(user), avatar: user.avatar }
}

function rememberSelected(values: number[]) {
  const optionMap = new Map<number, PersonOption>()
  labelOptions.value.forEach((option) => optionMap.set(option.value, option))
  rememberedOptions.value = values
    .map((value) => optionMap.get(value))
    .filter((option): option is PersonOption => option != null)
}

function findOption(value: number | string): PersonOption | undefined {
  return labelOptions.value.find((option) => option.value === Number(value))
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

function loadRecentPeople() {
  recentOptions.value = readRecentPeople(getLocalStorage(), currentUserId())
}

function refreshOpenOptions() {
  openOptions.value = pickFallbackPeople(recentOptions.value, fallbackPool.value)
}

async function ensureFallbackPool() {
  if (fallbackPool.value.length) return fallbackPool.value
  if (!props.remoteSearch) return []
  if (!fallbackPoolPromise) {
    fallbackPoolPromise = searchUsers('')
      .then((users) => {
        fallbackPool.value = users
          .filter((user) => isSelectableAccount(user.status))
          .map(toOption)
        return fallbackPool.value
      })
      .catch(() => {
        fallbackPoolPromise = null
        return fallbackPool.value
      })
  }
  return fallbackPoolPromise
}

async function fillOpenOptions() {
  refreshOpenOptions()
  if (openOptions.value.length >= RECENT_PERSON_LIMIT || !props.remoteSearch) return
  const token = ++searchToken
  searching.value = true
  try {
    await ensureFallbackPool()
    if (token !== searchToken) return
    refreshOpenOptions()
  } finally {
    if (token === searchToken) searching.value = false
  }
}

function persistRecentPeople(values: number[]) {
  const last = values.at(-1)
  const ordered = last == null ? values : [last, ...values.filter((value) => value !== last)]
  recentOptions.value = rememberRecentPeople(
    ordered.map((value) => findOption(value)),
    getLocalStorage(),
    currentUserId(),
  )
}

function resetSearch() {
  searchKeyword.value = ''
  extraOptions.value = []
  searchToken += 1
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = undefined
  }
  searching.value = false
}

async function runSearch(keyword: string) {
  if (!props.remoteSearch || !keyword.trim()) return
  const token = ++searchToken
  searching.value = true
  try {
    const users = await searchUsers(keyword.trim())
    if (token !== searchToken) return
    extraOptions.value = users
      .filter((user) => isSelectableAccount(user.status))
      .map(toOption)
    rememberSelected(selectedValues.value)
  } catch {
    if (token !== searchToken) return
  } finally {
    if (token === searchToken) searching.value = false
  }
}

function searchPeople(keyword = '') {
  searchKeyword.value = keyword
  emit('search', keyword)
  if (searchTimer) clearTimeout(searchTimer)
  if (!keyword.trim()) {
    extraOptions.value = []
    searching.value = false
    return
  }
  searchTimer = setTimeout(() => {
    searchTimer = undefined
    void runSearch(keyword)
  }, 250)
}

function onOpenChange(open: boolean) {
  if (open) {
    resetSearch()
    loadRecentPeople()
    void fillOpenOptions()
    return
  }
  resetSearch()
}

function onChange(values: number[]) {
  if (!props.multiple && !props.allowClear && values.length === 0 && selectedValues.value.length) return
  const nextValue = props.multiple ? values : getSinglePersonSelection(values)
  const nextValues = Array.isArray(nextValue) ? nextValue : nextValue == null ? [] : [nextValue]
  rememberSelected(nextValues)
  persistRecentPeople(nextValues)
  const selectedOption = typeof nextValue === 'number' ? findOption(nextValue) : undefined
  if (selectedOption) rememberPersonOption?.(selectedOption)
  resetSearch()
  emit('update:modelValue', nextValue)
  emit('change', nextValue)
  if (!props.multiple) noteAssigned?.()
}

watch(selectedValues, (values) => rememberSelected(values), { immediate: true })

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
  searchToken += 1
})
</script>

<template>
  <a-select
    :value="selectedValues"
    class="person-select"
    :class="{ 'person-select--multiple': multiple }"
    :options="dropdownOptions"
    :loading="loading || searching"
    mode="multiple"
    :max-tag-count="multiple ? maxTagCount : undefined"
    show-search
    :search-value="searchKeyword || undefined"
    :filter-option="false"
    option-filter-prop="label"
    :placeholder="resolvedPlaceholder"
    :not-found-content="emptyText"
    :disabled="disabled"
    :allow-clear="allowClear"
    @change="onChange"
    @search="searchPeople"
    @dropdownVisibleChange="onOpenChange"
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
        <CloseOutlined v-if="closable && (multiple || allowClear)" class="person-select__chip-close" @click.stop="onClose" />
      </span>
    </template>
  </a-select>
</template>

<style scoped>
.person-select { width: 100%; min-width: 0; }
.person-select :deep(.ant-select-selector) {
  min-height: 36px;
  max-height: 36px;
  overflow: hidden;
  align-items: center;
}
.person-select :deep(.ant-select-selection-overflow) {
  flex-wrap: nowrap;
  overflow: hidden;
  column-gap: 4px;
}
.person-select :deep(.ant-select-selection-overflow-item:not(.ant-select-selection-overflow-item-suffix)) {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
}
.person-select:not(.person-select--multiple) :deep(.ant-select-selection-overflow-item-suffix) {
  flex: 0 0 0;
  min-width: 0;
  overflow: hidden;
}
.person-select:not(.person-select--multiple).ant-select-open :deep(.ant-select-selection-overflow-item-suffix) {
  flex: 0 1 72px;
  min-width: 8px;
  overflow: visible;
}
.person-select :deep(.ant-select-selection-item) { margin-inline-end: 0; max-width: 100%; }
.person-select__option, .person-select__chip { display: inline-flex; align-items: center; min-width: 0; gap: 7px; }
.person-select__chip { max-width: 100%; padding: 2px 6px 2px 3px; color: var(--pms-text); background: var(--pms-surface-strong); border: 1px solid var(--pms-border); border-radius: 5px; }
.person-select__chip-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.person-select__chip-close { flex: 0 0 auto; color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); cursor: pointer; }
</style>
