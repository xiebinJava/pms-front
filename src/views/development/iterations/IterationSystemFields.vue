<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getIterationProjectSystem } from '/@/api/iteration-plan'
import { getSystemPage, getSystemVersionPage, getSystemVersionDetail, type SystemDefinition, type SystemVersionRow } from '/@/api/system-version'
import { loadAllOptionPages, selectableIterationVersions } from './iteration-system.mjs'
import { useUserStore } from '/@/store/user'

const props = defineProps<{
  projectId?: number | null
  systemId?: number | null
  systemVersionId?: number | null
  disabled?: boolean
  compact?: boolean
  preserveExistingSystem?: boolean
}>()
const emit = defineEmits<{
  'update:systemId': [value: number | undefined]
  'update:systemVersionId': [value: number | null]
  'validity-change': [valid: boolean]
  change: []
}>()
const { t } = useI18n()
const userStore = useUserStore()
const canReadVersions = computed(() => userStore.can('system-version:read'))
const systems = ref<SystemDefinition[]>([])
const versions = ref<SystemVersionRow[]>([])
const inherited = ref<number | undefined>()
const inheritedLabel = ref('')
const loading = ref(false)
const versionLoading = ref(false)
const error = ref('')
const versionError = ref('')
let contextRequest = 0
let versionRequest = 0
const savedVersionId = props.systemVersionId
const systemOptions = computed(() => {
  const options = systems.value.map(system => ({ value: system.id, label: system.name }))
  if (props.systemId != null && !options.some(option => option.value === props.systemId)) {
    options.unshift({ value: props.systemId, label: inheritedLabel.value || t('common.unset') })
  }
  return options
})
const versionOptions = computed(() => !canReadVersions.value && props.systemVersionId != null
  ? [{ value: props.systemVersionId, label: `#${props.systemVersionId}` }] : versions.value
  .filter(version => selectableIterationVersions([version], props.systemId).length
    || version.id === savedVersionId && version.systemId === props.systemId)
  .map(version => ({ value: version.id, label: `${version.versionNo}${version.versionName ? ` · ${version.versionName}` : ''}` })))

watch(() => props.projectId, async projectId => {
  const request = ++contextRequest
  loading.value = true
  inherited.value = undefined
  inheritedLabel.value = ''
  error.value = ''
  try {
    const [options, context] = await Promise.all([
      canReadVersions.value ? loadAllOptionPages(page => getSystemPage({ currPage: page, pageSize: 100, status: 'ACTIVE' })) : Promise.resolve([]),
      projectId == null ? Promise.resolve(null) : getIterationProjectSystem(projectId),
    ])
    if (request !== contextRequest) return
    systems.value = options
    if (context?.systemId != null) {
      if (props.preserveExistingSystem && props.systemId != null && props.systemId !== context.systemId) {
        error.value = t('iterationPlanView.systemSourceConflict')
        return
      }
      inherited.value = context.systemId
      inheritedLabel.value = context.systemName || ''
      if (props.systemId !== context.systemId) {
        emit('update:systemVersionId', null)
        emit('update:systemId', context.systemId)
      }
    }
  } catch (reason) {
    if (request === contextRequest) error.value = reason instanceof Error ? reason.message : t('iterationPlanView.systemLoadFailed')
  } finally { if (request === contextRequest) loading.value = false }
}, { immediate: true })

watch(() => props.systemId, async systemId => {
  const request = ++versionRequest
  versions.value = []
  versionError.value = ''
  versionLoading.value = systemId != null
  if (!canReadVersions.value) { versionLoading.value = false; return }
  if (systemId == null) return
  try {
    const rows = await loadAllOptionPages(page => getSystemVersionPage({ currPage: page, pageSize: 100, systemId }))
    if (savedVersionId != null && !rows.some(version => version.id === savedVersionId)) {
      const saved = await getSystemVersionDetail(savedVersionId)
      if (saved.systemId === systemId) rows.push(saved)
    }
    if (request === versionRequest) versions.value = rows
  } catch (reason) {
    if (request === versionRequest) versionError.value = reason instanceof Error ? reason.message : t('iterationPlanView.systemVersionLoadFailed')
  } finally { if (request === versionRequest) versionLoading.value = false }
}, { immediate: true })

watch([() => props.systemId, loading, versionLoading, error, versionError], () => {
  emit('validity-change', props.systemId != null && !loading.value && !versionLoading.value && !error.value && !versionError.value)
}, { immediate: true })

function changeSystem(value?: number) {
  emit('update:systemVersionId', null)
  emit('update:systemId', value)
  emit('change')
}
function changeVersion(value?: number) {
  emit('update:systemVersionId', value ?? null)
  emit('change')
}
</script>

<template>
  <div class="iteration-system-fields" :class="{ 'iteration-system-fields--compact': compact }">
    <label class="iteration-system-fields__field">
      <span class="iteration-system-fields__visually-hidden">{{ t('iterationPlanView.createSystem') }} <span class="iteration-system-fields__required">*</span></span>
      <a-select :value="systemId ?? undefined" :options="systemOptions" :loading="loading"
        :disabled="disabled || loading || inherited != null || !!error"
        :aria-label="t('iterationPlanView.createSystem')" :placeholder="t('iterationPlanView.createSystemPlaceholder')"
        show-search option-filter-prop="label" @change="changeSystem" />
    </label>
    <p v-if="inherited != null" class="iteration-system-fields__hint">{{ t('iterationPlanView.systemInherited') }}</p>
    <label class="iteration-system-fields__field">
      <span class="iteration-system-fields__visually-hidden">{{ t('iterationPlanView.createSystemVersion') }}</span>
      <a-select :value="systemVersionId ?? undefined" :options="versionOptions" :loading="versionLoading"
        :disabled="disabled || !canReadVersions || systemId == null || loading || versionLoading || !!error || !!versionError"
        :aria-label="t('iterationPlanView.createSystemVersion')" :placeholder="t('iterationPlanView.createSystemVersionPlaceholder')"
        allow-clear show-search option-filter-prop="label" @change="changeVersion" />
    </label>
    <p v-if="!canReadVersions" class="iteration-system-fields__hint">{{ t('iterationPlanView.systemVersionPermissionHint') }}</p>
    <p v-else-if="!compact" class="iteration-system-fields__hint">{{ t('iterationPlanView.systemVersionHint') }}</p>
    <a-alert v-if="error || versionError" type="error" show-icon :message="error || versionError" />
  </div>
</template>

<style scoped>
.iteration-system-fields { display: grid; gap: 8px; margin-bottom: 24px; }
.iteration-system-fields__field { display: grid; gap: 8px; color: var(--pms-text); font-size: var(--pms-font-size-body, 14px); }
.iteration-system-fields__field :deep(.ant-select) { width: 100%; min-width: 0; }
.iteration-system-fields__required { color: var(--pms-danger, #ff4d4f); }
.iteration-system-fields__hint { margin: 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact, 12px); }
.iteration-system-fields--compact {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: end;
  gap: 6px;
  margin-bottom: 0;
}
.iteration-system-fields--compact .iteration-system-fields__field { min-width: 0; gap: 0; }
.iteration-system-fields--compact .iteration-system-fields__visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.iteration-system-fields--compact .iteration-system-fields__hint { display: none; }
</style>
