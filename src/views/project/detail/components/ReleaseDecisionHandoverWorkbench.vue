<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import { apiErrorMessage } from '/@/plugins/http'
import { getNodeRelease, saveNodeRelease } from '/@/api/node-release'
import type { NodeRelease, NodeReleaseDecisionResult, NodeReleaseType, NodeReleaseUpdate } from '/@/types/domain'
import { isReleaseComplete } from '../release'

const props = defineProps<{
  projectId: number
  nodeId: number
  nodeReadOnly: boolean
  canEdit: boolean
}>()

const emit = defineEmits<{
  (event: 'completion-ready', ready: boolean): void
}>()

const { t } = useI18n()
const loading = ref(false)
const saving = ref(false)
const loadError = ref(false)
let savePromise: Promise<boolean> | null = null
let lastSavedFingerprint = ''

function emptyState(): NodeRelease {
  return {
    projectId: props.projectId,
    nodeId: props.nodeId,
    releaseType: 'GRAY',
    packageReady: false,
    configConfirmed: false,
    rollbackReady: false,
    monitoringConfirmed: false,
    onCallConfirmed: false,
    decisionResult: 'PENDING',
    canEdit: false,
  }
}

const state = reactive<NodeRelease>(emptyState())
const editable = computed(() => Boolean(props.canEdit && !props.nodeReadOnly && state.canEdit && !loading.value))
const completionReady = computed(() => isReleaseComplete(state))
const releaseTypeOptions = computed(() => [
  { value: 'GRAY' as NodeReleaseType, label: t('detail.release.types.gray') },
  { value: 'FULL' as NodeReleaseType, label: t('detail.release.types.full') },
  { value: 'HOTFIX' as NodeReleaseType, label: t('detail.release.types.hotfix') },
])
const decisionOptions = computed(() => [
  { value: 'PENDING' as NodeReleaseDecisionResult, label: t('detail.release.decisions.pending') },
  { value: 'APPROVED' as NodeReleaseDecisionResult, label: t('detail.release.decisions.approved') },
  { value: 'DEFERRED' as NodeReleaseDecisionResult, label: t('detail.release.decisions.deferred') },
  { value: 'CANCELLED' as NodeReleaseDecisionResult, label: t('detail.release.decisions.cancelled') },
])
const releaseWindowValue = computed(() => [
  state.releaseWindowStart || undefined,
  state.releaseWindowEnd || undefined,
])

function replaceState(next: NodeRelease) {
  Object.assign(state, {
    ...emptyState(),
    ...next,
    packageReady: Boolean(next.packageReady),
    configConfirmed: Boolean(next.configConfirmed),
    rollbackReady: Boolean(next.rollbackReady),
    monitoringConfirmed: Boolean(next.monitoringConfirmed),
    onCallConfirmed: Boolean(next.onCallConfirmed),
  })
  lastSavedFingerprint = JSON.stringify(toPayload())
  emit('completion-ready', completionReady.value)
}

function applySavedPatch(next: NodeRelease) {
  state.version = next.version
  state.canEdit = next.canEdit
  lastSavedFingerprint = JSON.stringify(toPayload())
  emit('completion-ready', completionReady.value)
}

async function load() {
  loading.value = true
  loadError.value = false
  replaceState(emptyState())
  try {
    replaceState(await getNodeRelease(props.projectId, props.nodeId))
  } catch (error) {
    loadError.value = true
    message.error(apiErrorMessage(error, t('detail.release.loadFailed')))
  } finally {
    loading.value = false
  }
}

function persistIfChanged() {
  if (!editable.value || JSON.stringify(toPayload()) === lastSavedFingerprint) return
  void saveDraft()
}

function onReleaseWindowChange(value: string[] | undefined) {
  if (!editable.value) return
  state.releaseWindowStart = value?.[0]
  state.releaseWindowEnd = value?.[1]
  persistIfChanged()
}

function toPayload(): NodeReleaseUpdate {
  return {
    version: state.version,
    releaseVersion: state.releaseVersion?.trim() || undefined,
    releaseWindowStart: state.releaseWindowStart,
    releaseWindowEnd: state.releaseWindowEnd,
    releaseType: state.releaseType,
    packageReady: state.packageReady,
    configConfirmed: state.configConfirmed,
    rollbackReady: state.rollbackReady,
    monitoringConfirmed: state.monitoringConfirmed,
    onCallConfirmed: state.onCallConfirmed,
    decisionResult: state.decisionResult,
    decisionNote: state.decisionNote?.trim() || undefined,
    handoverNotes: state.handoverNotes?.trim() || undefined,
    observationItems: state.observationItems?.trim() || undefined,
    emergencyContact: state.emergencyContact?.trim() || undefined,
  }
}

async function saveDraft(showSuccess = false): Promise<boolean> {
  if (savePromise) return savePromise
  if (!editable.value) return false

  saving.value = true
  const pending = (async () => {
    try {
      const next = await saveNodeRelease(props.projectId, props.nodeId, toPayload())
      if (next.canEdit === false) replaceState(next)
      else applySavedPatch(next)
      if (showSuccess) message.success(t('detail.release.saved'))
      return true
    } catch (error) {
      message.error(apiErrorMessage(error, t('detail.release.saveFailed')))
      return false
    } finally {
      saving.value = false
      savePromise = null
    }
  })()
  savePromise = pending
  return pending
}

function handleWorkbenchFocusOut(event: FocusEvent) {
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.matches('input, textarea, [role="combobox"]')) return
  persistIfChanged()
}

defineExpose({ saveDraft })

watch(completionReady, (ready) => emit('completion-ready', ready), { immediate: true })
watch(() => [props.projectId, props.nodeId], () => { void load() }, { immediate: true })
</script>

<template>
  <section class="release-workbench" :class="{ 'release-workbench--locked': !editable }" @focusout="handleWorkbenchFocusOut">
    <div class="release-workbench__header">
      <div>
        <div class="release-workbench__title-row">
          <h3>{{ $t('detail.release.title') }}</h3>
          <a-tag v-if="completionReady" color="green">{{ $t('detail.release.ready') }}</a-tag>
          <a-tag v-else color="orange">{{ $t('detail.release.draft') }}</a-tag>
        </div>
      </div>
    </div>

    <a-alert
      v-if="loadError"
      type="error"
      show-icon
      :message="$t('detail.release.loadFailed')"
      :description="$t('detail.release.reloadHint')"
    />
    <a-skeleton v-if="!loadError && loading" active :paragraph="{ rows: 8 }" />

    <template v-if="!loadError && !loading">
      <section class="release-block">
        <div class="release-block__heading">
          <div>
            <h4>{{ $t('detail.release.infoTitle') }}</h4>
            <p>{{ $t('detail.release.infoHint') }}</p>
          </div>
        </div>
        <div class="release-meta-grid">
          <label class="release-field">
            <span>{{ $t('detail.release.version') }}</span>
            <a-input v-model:value="state.releaseVersion" :disabled="!editable" :placeholder="$t('detail.release.versionPlaceholder')" />
          </label>
          <label class="release-field release-field--wide">
            <span>{{ $t('detail.release.window') }}</span>
            <a-range-picker
              :value="releaseWindowValue"
              :disabled="!editable"
              :show-time="{ format: 'HH:mm' }"
              format="YYYY-MM-DD HH:mm"
              value-format="YYYY-MM-DDTHH:mm:ss"
              :placeholder="[$t('detail.release.windowStart'), $t('detail.release.windowEnd')]"
              @change="onReleaseWindowChange"
            />
          </label>
          <label class="release-field">
            <span>{{ $t('detail.release.type') }}</span>
            <a-select v-model:value="state.releaseType" :disabled="!editable" :options="releaseTypeOptions" @change="persistIfChanged" />
          </label>
        </div>
      </section>

      <section class="release-block">
        <div class="release-block__heading">
          <div>
            <h4>{{ $t('detail.release.decisionTitle') }}</h4>
            <p>{{ $t('detail.release.decisionHint') }}</p>
          </div>
          <a-tag :color="state.decisionResult === 'APPROVED' ? 'green' : 'orange'">
            {{ decisionOptions.find((item) => item.value === state.decisionResult)?.label }}
          </a-tag>
        </div>
        <div class="release-decision-grid">
          <label class="release-field">
            <span>{{ $t('detail.release.result') }}</span>
            <a-select v-model:value="state.decisionResult" :disabled="!editable" :options="decisionOptions" @change="persistIfChanged" />
          </label>
          <label class="release-field release-field--wide">
            <span>{{ $t('detail.release.decisionNote') }}</span>
            <a-input v-model:value="state.decisionNote" :disabled="!editable" :placeholder="$t('detail.release.decisionNotePlaceholder')" />
          </label>
        </div>
      </section>

      <section class="release-block">
        <div class="release-block__heading">
          <div>
            <h4>{{ $t('detail.release.handoverTitle') }}</h4>
            <p>{{ $t('detail.release.handoverHint') }}</p>
          </div>
        </div>
        <div class="release-handover-grid">
          <label class="release-field">
            <span>{{ $t('detail.release.handoverNotes') }}</span>
            <a-textarea v-model:value="state.handoverNotes" :disabled="!editable" :rows="2" :placeholder="$t('detail.release.handoverNotesPlaceholder')" />
          </label>
          <label class="release-field">
            <span>{{ $t('detail.release.observationItems') }}</span>
            <a-textarea v-model:value="state.observationItems" :disabled="!editable" :rows="2" :placeholder="$t('detail.release.observationItemsPlaceholder')" />
          </label>
          <label class="release-field release-field--wide">
            <span>{{ $t('detail.release.emergencyContact') }}</span>
            <a-input v-model:value="state.emergencyContact" :disabled="!editable" :placeholder="$t('detail.release.emergencyContactPlaceholder')" />
          </label>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.release-workbench {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 24px;
  border: 1px solid var(--pms-border-color, #dbe4ef);
  border-radius: 12px;
  background: #f7f9fc;
}

.release-workbench__header,
.release-workbench__title-row,
.release-block__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.release-workbench__title-row h3,
.release-block__heading h4 {
  margin: 0;
  color: #18263d;
  font-weight: 700;
}

.release-block__heading h4 {
  font-size: 16px;
}

.release-block__heading p {
  margin: 4px 0 0;
  color: #8190a8;
  font-size: 12px;
}

.release-block {
  padding: 18px;
  border: 1px solid #dfe7f1;
  border-radius: 10px;
  background: #fff;
}

.release-meta-grid,
.release-decision-grid,
.release-handover-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.release-meta-grid {
  grid-template-columns: minmax(180px, .8fr) minmax(300px, 1.4fr) minmax(160px, .7fr);
}

.release-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 7px;
  color: #586a84;
  font-size: 12px;
  font-weight: 600;
}

.release-field--wide {
  grid-column: span 2;
}

.release-meta-grid .release-field--wide {
  grid-column: auto;
}

.release-field :deep(.ant-picker),
.release-field :deep(.ant-select),
.release-field :deep(.ant-input) {
  width: 100%;
}

@media (max-width: 900px) {
  .release-meta-grid,
  .release-decision-grid,
  .release-handover-grid {
    grid-template-columns: 1fr;
  }

  .release-meta-grid .release-field--wide,
  .release-field--wide {
    grid-column: auto;
  }
}

@media (max-width: 560px) {
  .release-workbench {
    padding: 16px;
  }

  .release-workbench__header,
  .release-block__heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
