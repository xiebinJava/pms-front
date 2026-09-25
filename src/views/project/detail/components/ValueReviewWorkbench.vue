<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import { apiErrorMessage } from '/@/plugins/http'
import { getNodeValueReview, saveNodeValueReview } from '/@/api/node-value-review'
import type { NodeValueReview, NodeValueReviewUpdate } from '/@/types/domain'
import { isValueReviewComplete } from '../value-review'

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
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let lastSavedFingerprint = ''

function emptyState(): NodeValueReview {
  return {
    projectId: props.projectId,
    nodeId: props.nodeId,
    resultStatus: 'PENDING',
    canEdit: false,
  }
}

const state = reactive<NodeValueReview>(emptyState())
const editable = computed(() => Boolean(
  props.canEdit && !props.nodeReadOnly && state.canEdit && !loading.value,
))
const completionReady = computed(() => isValueReviewComplete(state))
const resultOptions = computed(() => [
  { value: 'PENDING' as const, label: t('detail.valueReview.results.pending') },
  { value: 'ACHIEVED' as const, label: t('detail.valueReview.results.achieved') },
  { value: 'PARTIAL' as const, label: t('detail.valueReview.results.partial') },
  { value: 'NOT_ACHIEVED' as const, label: t('detail.valueReview.results.notAchieved') },
])

function replaceState(next: NodeValueReview) {
  Object.assign(state, {
    ...emptyState(),
    ...next,
    resultStatus: next.resultStatus || 'PENDING',
  })
  lastSavedFingerprint = JSON.stringify(toPayload())
  emit('completion-ready', completionReady.value)
}

function applySavedPatch(next: NodeValueReview) {
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
    replaceState(await getNodeValueReview(props.projectId, props.nodeId))
  } catch (error) {
    loadError.value = true
    message.error(apiErrorMessage(error, t('detail.valueReview.loadFailed')))
  } finally {
    loading.value = false
  }
}

function toPayload(): NodeValueReviewUpdate {
  return {
    version: state.version,
    resultStatus: state.resultStatus,
    actualResult: state.actualResult?.trim() || undefined,
    retrospectiveConclusion: state.retrospectiveConclusion?.trim() || undefined,
    followUpActions: state.followUpActions?.trim() || undefined,
  }
}

async function saveDraft(showSuccess = false): Promise<boolean> {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
  if (savePromise) return savePromise
  if (!editable.value) return false

  saving.value = true
  const pending = (async () => {
    try {
      const next = await saveNodeValueReview(props.projectId, props.nodeId, toPayload())
      if (next.canEdit === false) replaceState(next)
      else applySavedPatch(next)
      if (showSuccess) message.success(t('detail.valueReview.saved'))
      return true
    } catch (error) {
      message.error(apiErrorMessage(error, t('detail.valueReview.saveFailed')))
      return false
    } finally {
      saving.value = false
      savePromise = null
    }
  })()
  savePromise = pending
  return pending
}

function scheduleAutoSave(delay = 0) {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => { void persistAutoSave() }, delay)
}

function persistAfterChange() {
  scheduleAutoSave()
}

function handleWorkbenchFocusOut(event: FocusEvent) {
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.matches('input, textarea, [role="combobox"]')) return
  scheduleAutoSave()
}

async function persistAutoSave() {
  autoSaveTimer = null
  if (!editable.value || saving.value) return
  if (JSON.stringify(toPayload()) === lastSavedFingerprint) return
  await saveDraft()
}

defineExpose({ saveDraft })

watch(completionReady, (ready) => emit('completion-ready', ready), { immediate: true })
watch(() => [props.projectId, props.nodeId], () => { void load() }, { immediate: true })
onBeforeUnmount(() => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
})
</script>

<template>
  <section
    class="value-review-workbench"
    :class="{ 'value-review-workbench--locked': !editable }"
    @focusout="handleWorkbenchFocusOut"
  >
    <div class="value-review-workbench__header">
      <div class="value-review-workbench__title-row">
        <h3>{{ $t('detail.valueReview.title') }}</h3>
        <a-tag v-if="completionReady" color="green">{{ $t('detail.valueReview.ready') }}</a-tag>
        <a-tag v-else color="orange">{{ $t('detail.valueReview.draft') }}</a-tag>
      </div>
    </div>

    <a-alert
      v-if="loadError"
      type="error"
      show-icon
      :message="$t('detail.valueReview.loadFailed')"
      :description="$t('detail.valueReview.reloadHint')"
    />
    <a-skeleton v-if="!loadError && loading" active :paragraph="{ rows: 7 }" />

    <template v-if="!loadError && !loading">
      <section class="value-review-block">
        <div class="value-review-block__heading">
          <div>
            <h4>{{ $t('detail.valueReview.valueTitle') }}</h4>
            <p>{{ $t('detail.valueReview.valueHint') }}</p>
          </div>
          <span class="value-review-block__status">{{ $t('detail.valueReview.result') }}</span>
        </div>
        <div class="value-review-grid">
          <label class="value-review-field">
            <span>{{ $t('detail.valueReview.result') }}</span>
            <a-select
              v-model:value="state.resultStatus"
              :disabled="!editable"
              :options="resultOptions"
              :placeholder="$t('detail.valueReview.results.pending')"
              @change="persistAfterChange"
            />
          </label>
          <label class="value-review-field value-review-field--wide">
            <span>{{ $t('detail.valueReview.actualResult') }}</span>
            <a-textarea
              v-model:value="state.actualResult"
              :disabled="!editable"
              :rows="3"
              :placeholder="$t('detail.valueReview.actualResultPlaceholder')"
            />
          </label>
        </div>
      </section>

      <section class="value-review-block">
        <div class="value-review-block__heading">
          <div>
            <h4>{{ $t('detail.valueReview.retrospectiveTitle') }}</h4>
            <p>{{ $t('detail.valueReview.retrospectiveHint') }}</p>
          </div>
        </div>
        <div class="value-review-grid">
          <label class="value-review-field value-review-field--wide">
            <span>{{ $t('detail.valueReview.retrospectiveConclusion') }}</span>
            <a-textarea
              v-model:value="state.retrospectiveConclusion"
              :disabled="!editable"
              :rows="3"
              :placeholder="$t('detail.valueReview.retrospectivePlaceholder')"
            />
          </label>
          <label class="value-review-field value-review-field--wide">
            <span>{{ $t('detail.valueReview.followUpActions') }}</span>
            <a-textarea
              v-model:value="state.followUpActions"
              :disabled="!editable"
              :rows="2"
              :placeholder="$t('detail.valueReview.followUpPlaceholder')"
            />
          </label>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.value-review-workbench {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 24px;
  border: 1px solid var(--pms-border-color, #dbe4ef);
  border-radius: 12px;
  background: #f7f9fc;
}

.value-review-workbench--locked { opacity: .92; }

.value-review-workbench__header,
.value-review-workbench__title-row,
.value-review-block__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.value-review-workbench__title-row h3,
.value-review-block__heading h4 { margin: 0; color: var(--pms-text, #17243b); }
.value-review-block__heading { align-items: flex-start; padding-bottom: 12px; border-bottom: 1px solid var(--pms-border, #e5eaf2); }
.value-review-block__heading p { margin: 5px 0 0; color: var(--pms-text-faint, #8997aa); font-size: 13px; }
.value-review-block__status { color: var(--pms-text-faint, #8997aa); font-size: 12px; }
.value-review-block { padding: 18px; border: 1px solid var(--pms-border, #e5eaf2); border-radius: 10px; background: #fff; }
.value-review-grid { display: grid; grid-template-columns: minmax(180px, .65fr) minmax(0, 1.35fr); gap: 16px; padding-top: 16px; }
.value-review-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.value-review-field--wide { grid-column: span 1; }
.value-review-field > span { color: var(--pms-text-muted, #5d6d85); font-size: 13px; font-weight: 600; }

@media (max-width: 720px) {
  .value-review-workbench { padding: 16px; }
  .value-review-workbench__header { align-items: flex-start; flex-direction: column; }
  .value-review-grid { grid-template-columns: 1fr; }
}
</style>
