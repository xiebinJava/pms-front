<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import { apiErrorMessage } from '/@/plugins/http'
import { getIterationPlans } from '/@/api/iteration-plan'
import { getNodeRelease, saveNodeRelease } from '/@/api/node-release'
import type { NodeIterationPlan, NodeRelease, NodeReleaseUpdate } from '/@/types/domain'
import { normalizePersonDisplayLabel } from '../workflow'
import type { PersonOption } from '../workflow'
import PersonSelect from './PersonSelect.vue'
import { getReleaseWorkbenchStatus, isReleaseComplete } from '../release'

const props = defineProps<{
  projectId: number
  nodeId: number
  nodeStatus: number
  nodeReadOnly: boolean
  canEdit: boolean
  ownerOptions?: PersonOption[]
}>()

const emit = defineEmits<{
  (event: 'completion-ready', ready: boolean): void
}>()

const { t } = useI18n()
const loading = ref(false)
const saving = ref(false)
const loadError = ref(false)
const iterationLoadError = ref(false)
const iterationPlans = ref<NodeIterationPlan[]>([])
let savePromise: Promise<boolean> | null = null
let lastSavedFingerprint = ''

function emptyState(): NodeRelease {
  return {
    projectId: props.projectId,
    nodeId: props.nodeId,
    canEdit: false,
    handoverOwnerId: undefined,
  }
}

const state = reactive<NodeRelease>(emptyState())
const editable = computed(() => Boolean(props.canEdit && !props.nodeReadOnly && state.canEdit && !loading.value))
const completionReady = computed(() => isReleaseComplete(state))
const handoverOwnerDisplay = computed(() => {
  const name = normalizePersonDisplayLabel(state.handoverOwnerName)
  const username = state.handoverOwnerUsername?.trim()
  if (!name) return username
  if (!username || name.toLocaleLowerCase() === username.toLocaleLowerCase()) return name
  const suffixes = [`（${username}）`, `(${username})`]
  return suffixes.some((suffix) => name.toLocaleLowerCase().endsWith(suffix.toLocaleLowerCase()))
    ? name
    : `${name}（${username}）`
})
const handoverOwnerOptions = computed<PersonOption[]>(() => {
  const options = [...(props.ownerOptions || [])]
  if (state.handoverOwnerId != null && handoverOwnerDisplay.value
      && !options.some((option) => option.value === state.handoverOwnerId)) {
    options.push({ value: state.handoverOwnerId, label: handoverOwnerDisplay.value })
  }
  return options
})
const workbenchStatus = computed(() => getReleaseWorkbenchStatus({
  nodeStatus: props.nodeStatus,
  completionReady: completionReady.value,
}))
function replaceState(next: NodeRelease) {
  Object.assign(state, { ...emptyState(), ...next })
  lastSavedFingerprint = JSON.stringify(toPayload())
  emit('completion-ready', completionReady.value)
}

function applySavedPatch(next: NodeRelease) {
  state.version = next.version
  state.handoverOwnerId = next.handoverOwnerId
  state.handoverOwnerName = next.handoverOwnerName
  state.handoverOwnerUsername = next.handoverOwnerUsername
  state.canEdit = next.canEdit
  lastSavedFingerprint = JSON.stringify(toPayload())
  emit('completion-ready', completionReady.value)
}

async function load() {
  loading.value = true
  loadError.value = false
  iterationLoadError.value = false
  iterationPlans.value = []
  replaceState(emptyState())
  try {
    const [release, plans] = await Promise.all([
      getNodeRelease(props.projectId, props.nodeId),
      getIterationPlans(props.projectId).catch(() => {
        iterationLoadError.value = true
        return []
      }),
    ])
    replaceState(release)
    iterationPlans.value = plans
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

function toPayload(): NodeReleaseUpdate {
  return {
    version: state.version,
    handoverOwnerId: state.handoverOwnerId,
    handoverNotes: state.handoverNotes?.trim() || undefined,
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
          <a-tag v-if="workbenchStatus === 'completed'" color="green">{{ $t('detail.release.completed') }}</a-tag>
          <a-tag v-else-if="workbenchStatus === 'terminated'" color="red">{{ $t('detail.release.terminated') }}</a-tag>
          <a-tag v-else-if="workbenchStatus === 'ready'" color="green">{{ $t('detail.release.ready') }}</a-tag>
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
        <div class="release-scope">
          <div class="release-scope__heading">
            <strong>{{ $t('detail.release.scopeTitle') }}</strong>
            <span>{{ $t('detail.release.scopeHint') }}</span>
          </div>
          <a-alert v-if="iterationLoadError" type="warning" show-icon :message="$t('detail.release.scopeLoadFailed')" />
          <a-empty v-else-if="iterationPlans.length === 0" :description="$t('detail.release.noIterations')" />
          <div v-else class="release-scope__list">
            <article v-for="iteration in iterationPlans" :key="iteration.id ?? iteration.name" class="release-scope__item">
              <div class="release-scope__iteration">
                <strong>{{ iteration.name }}</strong>
                <span v-if="iteration.startDate || iteration.dueDate">
                  {{ iteration.startDate || '—' }} ～ {{ iteration.dueDate || '—' }}
                </span>
              </div>
              <div class="release-scope__binding">
                <span>{{ iteration.systemName || $t('detail.release.unboundSystem') }}</span>
                <a-tag :color="iteration.systemVersionNo ? 'blue' : 'default'">
                  {{ iteration.systemVersionNo
                    ? `${iteration.systemVersionNo}${iteration.systemVersionName ? ` · ${iteration.systemVersionName}` : ''}`
                    : $t('detail.release.unboundVersion') }}
                </a-tag>
              </div>
            </article>
          </div>
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
            <span>{{ $t('detail.release.handoverOwner') }}</span>
            <PersonSelect v-model="state.handoverOwnerId" :options="handoverOwnerOptions" :disabled="!editable" :placeholder="$t('detail.release.handoverOwnerPlaceholder')" />
          </label>
          <label class="release-field release-field--wide">
            <span>{{ $t('detail.release.handoverNotes') }}</span>
            <a-textarea v-model:value="state.handoverNotes" :disabled="!editable" :rows="2" :placeholder="$t('detail.release.handoverNotesPlaceholder')" />
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

.release-handover-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.release-scope {
  margin-top: 16px;
  padding: 14px;
  border: 1px solid #e4eaf2;
  border-radius: 8px;
  background: #f8fafc;
}

.release-scope__heading,
.release-scope__iteration,
.release-scope__binding {
  display: flex;
  gap: 6px;
  flex-direction: column;
}

.release-scope__heading > span,
.release-scope__iteration > span {
  color: #8190a8;
  font-size: 12px;
}

.release-scope__list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.release-scope__item {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(220px, 1fr);
  gap: 16px;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid #dfe7f1;
  border-radius: 8px;
  background: #fff;
}

.release-scope__binding {
  align-items: flex-start;
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

.release-field :deep(.ant-picker),
.release-field :deep(.ant-select),
.release-field :deep(.ant-input) {
  width: 100%;
}

@media (max-width: 900px) {
  .release-handover-grid {
    grid-template-columns: 1fr;
  }

  .release-scope__item {
    grid-template-columns: 1fr;
  }

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
