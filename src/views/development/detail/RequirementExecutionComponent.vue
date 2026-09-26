<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import { DeleteOutlined, LinkOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import {
  changeRequirementExecutionTarget,
  getDevelopmentRequirement,
  getDevelopmentItemWorkflow,
  getRequirementExecutionTargetHistory,
  getRequirementExecutionTargetOptions,
  linkRequirementExecutionTarget,
  unlinkRequirementExecutionTarget,
  type RequirementExecutionTargetCommand,
} from '/@/api/development-item'
import type {
  DevelopmentItemWorkflowDetail,
  RequirementExecutionTarget,
  RequirementExecutionTargetHistory,
  RequirementExecutionTargetType,
} from '/@/types/domain'

const props = defineProps<{
  itemId: number
  target?: RequirementExecutionTarget
  targetHistory?: RequirementExecutionTargetHistory[]
  canWrite: boolean
  canManage?: boolean
  requirementVersion?: number
}>()

const emit = defineEmits<{ updated: [detail: DevelopmentItemWorkflowDetail] }>()
const { t } = useI18n()
const router = useRouter()
const requirementExecutionTargetType = ref<RequirementExecutionTargetType>('PROJECT')
const keyword = ref('')
const options = ref<RequirementExecutionTarget[]>([])
const executionTargetHistory = ref<RequirementExecutionTargetHistory[]>(props.targetHistory || [])
const loading = ref(false)
const historyLoading = ref(false)
const saving = ref(false)
const requirementVersion = ref<number | undefined>(props.requirementVersion)
const changeReason = ref('')
const selectedTargetId = ref<number>()
let searchTimer: number | undefined

const targetTypeOptions = computed(() => [
  { value: 'PROJECT', label: t('developmentDetail.requirementExecution.targetTypes.PROJECT') },
  { value: 'TOPIC', label: t('developmentDetail.requirementExecution.targetTypes.TOPIC') },
  { value: 'STORY', label: t('developmentDetail.requirementExecution.targetTypes.STORY') },
])

const targetUnavailable = computed(() => ['DELETED', 'TERMINATED', 'COMPLETED', 'UNAVAILABLE'].includes(props.target?.status || ''))
const selectedOption = computed(() => options.value.find((option) => option.targetId === selectedTargetId.value))
const hasTarget = computed(() => props.target != null)
const actionNeedsReason = computed(() => hasTarget.value)
const canChangeTarget = computed(() => props.canManage !== false)

function targetLabel(targetType?: RequirementExecutionTargetType) {
  return targetType ? t(`developmentDetail.requirementExecution.targetTypes.${targetType}`) : t('common.unset')
}

function targetStatus(status?: string) {
  if (!status) return t('common.unset')
  return t(`developmentDetail.requirementExecution.statuses.${status}`, status)
}

function targetPath(target: RequirementExecutionTarget) {
  if (target.navigationId == null) return ''
  const id = target.navigationId
  const type = target.navigationType || target.targetType.toLowerCase()
  if (type === 'project') return `/projects/${id}`
  if (type === 'topic') return `/development/topics/${id}`
  return `/development/stories/${id}`
}

function openTarget(target?: RequirementExecutionTarget) {
  if (!target || target.navigationId == null) return
  void router.push(targetPath(target))
}

async function loadRequirementVersion() {
  if (requirementVersion.value != null) return
  try {
    const requirement = await getDevelopmentRequirement(props.itemId)
    requirementVersion.value = requirement.version
  } catch {
    // The workflow detail remains usable; the mutation will surface the server error.
  }
}

async function loadOptions() {
  loading.value = true
  try {
    const result = await getRequirementExecutionTargetOptions(props.itemId, {
      currPage: 1,
      pageSize: 30,
      keyword: keyword.value.trim() || undefined,
      targetType: requirementExecutionTargetType.value,
    })
    options.value = result.list || []
    selectedTargetId.value = selectedOption.value?.targetId
  } catch (error) {
    message.error((error as Error).message || t('developmentDetail.requirementExecution.loadFailed'))
  } finally {
    loading.value = false
  }
}

async function loadHistory() {
  historyLoading.value = true
  try {
    executionTargetHistory.value = await getRequirementExecutionTargetHistory(props.itemId)
  } catch (error) {
    message.error((error as Error).message || t('developmentDetail.requirementExecution.historyLoadFailed'))
  } finally {
    historyLoading.value = false
  }
}

async function refreshDetail() {
  const next = await getDevelopmentItemWorkflow('requirement', props.itemId)
  requirementVersion.value = undefined
  try {
    requirementVersion.value = (await getDevelopmentRequirement(props.itemId)).version
  } catch {
    // The next mutation will retry the version lookup before submitting.
  }
  emit('updated', next)
}

function command(target: RequirementExecutionTarget): RequirementExecutionTargetCommand {
  return {
    targetType: target.targetType,
    targetId: target.targetId,
    requirementVersion: requirementVersion.value ?? 0,
    reason: changeReason.value.trim() || undefined,
  }
}

async function saveTarget() {
  const target = selectedOption.value
  if (!props.canWrite || !target || saving.value || (hasTarget.value && !canChangeTarget.value)) return
  if (actionNeedsReason.value && !changeReason.value.trim()) {
    message.warning(t('developmentDetail.requirementExecution.reasonRequired'))
    return
  }
  saving.value = true
  try {
    await loadRequirementVersion()
    if (requirementVersion.value == null) throw new Error(t('developmentDetail.requirementExecution.versionMissing'))
    if (hasTarget.value) {
      await changeRequirementExecutionTarget(props.itemId, command(target))
      message.success(t('developmentDetail.requirementExecution.changed'))
    } else {
      await linkRequirementExecutionTarget(props.itemId, command(target))
      message.success(t('developmentDetail.requirementExecution.linked'))
    }
    changeReason.value = ''
    await Promise.all([refreshDetail(), loadHistory()])
  } catch (error) {
    message.error((error as Error).message || t('developmentDetail.requirementExecution.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function unlinkTarget() {
  if (!props.canWrite || !props.target || saving.value) return
  if (!changeReason.value.trim()) {
    message.warning(t('developmentDetail.requirementExecution.reasonRequired'))
    return
  }
  saving.value = true
  try {
    await loadRequirementVersion()
    if (requirementVersion.value == null) throw new Error(t('developmentDetail.requirementExecution.versionMissing'))
    await unlinkRequirementExecutionTarget(props.itemId, {
      requirementVersion: requirementVersion.value,
      reason: changeReason.value.trim(),
    })
    changeReason.value = ''
    message.success(t('developmentDetail.requirementExecution.unlinked'))
    await Promise.all([refreshDetail(), loadHistory()])
  } catch (error) {
    message.error((error as Error).message || t('developmentDetail.requirementExecution.saveFailed'))
  } finally {
    saving.value = false
  }
}

function scheduleSearch() {
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => { void loadOptions() }, 240)
}

function selectType(type: RequirementExecutionTargetType) {
  requirementExecutionTargetType.value = type
  selectedTargetId.value = undefined
  void loadOptions()
}

watch(() => props.targetHistory, (value) => {
  if (value) executionTargetHistory.value = value
})
watch(() => props.requirementVersion, (value) => { requirementVersion.value = value })
watch(keyword, scheduleSearch)
watch(() => props.itemId, () => {
  requirementVersion.value = props.requirementVersion
  void Promise.all([loadOptions(), loadHistory(), loadRequirementVersion()])
})

onMounted(() => {
  void Promise.all([loadOptions(), loadHistory(), loadRequirementVersion()])
})
</script>

<template>
  <section class="requirement-execution-component pms-runtime-component">
    <div class="requirement-execution-component__header pms-section-heading">
      <div>
        <h3>{{ t('developmentDetail.requirementExecution.title') }}</h3>
        <p>{{ t('developmentDetail.requirementExecution.hint') }}</p>
      </div>
      <a-tag :color="targetUnavailable ? 'red' : props.target ? 'blue' : 'default'">
        {{ targetUnavailable ? t('developmentDetail.requirementExecution.unavailable') : props.target ? t('developmentDetail.requirementExecution.linkedState') : t('developmentDetail.requirementExecution.unlinkedState') }}
      </a-tag>
    </div>

    <div v-if="props.target" class="requirement-execution-component__target">
      <div class="requirement-execution-component__target-main">
        <span class="requirement-execution-component__eyebrow">{{ targetLabel(props.target.targetType) }}</span>
        <button v-if="props.target.navigationId != null" type="button" class="requirement-execution-component__target-link" @click="openTarget(props.target)">
          <LinkOutlined /> {{ props.target.title || t('developmentDetail.requirementExecution.unnamedTarget') }}
        </button>
        <span v-else class="requirement-execution-component__target-link is-unavailable">
          {{ props.target.title || t('developmentDetail.requirementExecution.unnamedTarget') }}
        </span>
        <span v-if="props.target.code" class="requirement-execution-component__code">{{ props.target.code }}</span>
      </div>
      <div class="requirement-execution-component__target-meta">
        <span>{{ t('developmentDetail.requirementExecution.owner') }}：{{ props.target.ownerName || t('common.unset') }}</span>
        <span>{{ t('developmentDetail.requirementExecution.status') }}：{{ targetStatus(props.target.status) }}</span>
        <span v-if="props.target.progress != null">{{ props.target.progress }}%</span>
      </div>
    </div>

    <a-alert v-if="targetUnavailable" type="warning" show-icon :message="t('developmentDetail.requirementExecution.unavailableHint')" />

    <div v-if="props.canWrite" class="requirement-execution-component__editor">
      <div class="requirement-execution-component__type-tabs" role="tablist" :aria-label="t('developmentDetail.requirementExecution.targetType')">
        <button
          v-for="option in targetTypeOptions"
          :key="option.value"
          type="button"
          :class="{ 'is-active': requirementExecutionTargetType === option.value }"
          @click="selectType(option.value as RequirementExecutionTargetType)"
        >{{ option.label }}</button>
      </div>

      <div class="requirement-execution-component__search-row">
        <a-input v-model:value="keyword" allow-clear :placeholder="t('developmentDetail.requirementExecution.searchPlaceholder')">
          <template #prefix><SearchOutlined /></template>
        </a-input>
        <a-button :loading="loading" @click="loadOptions"><ReloadOutlined />{{ t('common.refresh') }}</a-button>
      </div>

      <a-spin :spinning="loading">
        <div v-if="!options.length" class="requirement-execution-component__empty">{{ t('developmentDetail.requirementExecution.noOptions') }}</div>
        <div v-else class="requirement-execution-component__options">
          <label v-for="option in options" :key="`${option.targetType}-${option.targetId}`" class="requirement-execution-component__option" :class="{ 'is-selected': selectedTargetId === option.targetId }">
            <input v-model="selectedTargetId" type="radio" :value="option.targetId" :name="`requirement-target-${props.itemId}`" />
            <span class="requirement-execution-component__option-copy">
              <strong>{{ option.title || t('developmentDetail.requirementExecution.unnamedTarget') }}</strong>
              <small>{{ option.code || targetLabel(option.targetType) }} · {{ option.ownerName || t('common.unset') }}</small>
            </span>
            <a-tag>{{ targetStatus(option.status) }}</a-tag>
          </label>
        </div>
      </a-spin>

      <a-textarea
        v-if="props.target"
        v-model:value="changeReason"
        :maxlength="500"
        :rows="2"
        :placeholder="t('developmentDetail.requirementExecution.reasonPlaceholder')"
      />
      <div class="requirement-execution-component__actions">
        <a-button type="primary" :loading="saving" :disabled="!selectedTargetId || (props.target && !canChangeTarget)" @click="saveTarget">
          <LinkOutlined />{{ props.target ? t('developmentDetail.requirementExecution.change') : t('developmentDetail.requirementExecution.link') }}
        </a-button>
        <a-button v-if="props.target" danger :loading="saving" @click="unlinkTarget"><DeleteOutlined />{{ t('developmentDetail.requirementExecution.unlink') }}</a-button>
      </div>
    </div>

    <details class="requirement-execution-component__history">
      <summary>{{ t('developmentDetail.requirementExecution.historyTitle') }}（{{ executionTargetHistory.length }}）</summary>
      <a-spin :spinning="historyLoading">
        <a-empty v-if="!executionTargetHistory.length" :description="t('developmentDetail.requirementExecution.noHistory')" />
        <ol v-else>
          <li v-for="item in executionTargetHistory" :key="item.id">
            <strong>{{ t(`developmentDetail.requirementExecution.actions.${item.action}`, item.action) }}</strong>
            <span>{{ item.operatorName || t('common.unset') }} · {{ item.createdAt || '—' }}</span>
            <small v-if="item.reason">{{ item.reason }}</small>
          </li>
        </ol>
      </a-spin>
    </details>
  </section>
</template>

<style scoped>
.requirement-execution-component { display: grid; gap: var(--pms-space-3); padding-top: 2px; }
.requirement-execution-component__header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--pms-space-3); }
.requirement-execution-component__header h3 { margin: 0; color: var(--pms-text); font-size: var(--pms-font-size-section); font-weight: 700; }
.requirement-execution-component__header p { margin: var(--pms-space-1) 0 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-normal); }
.requirement-execution-component__target { display: flex; align-items: center; justify-content: space-between; gap: var(--pms-space-3); padding: var(--pms-space-3); background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); }
.requirement-execution-component__target-main, .requirement-execution-component__target-meta { display: flex; align-items: center; flex-wrap: wrap; gap: var(--pms-space-2); min-width: 0; }
.requirement-execution-component__target-main { flex: 1 1 auto; }
.requirement-execution-component__target-meta { flex: 0 1 auto; justify-content: flex-end; color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); }
.requirement-execution-component__eyebrow, .requirement-execution-component__code { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.requirement-execution-component__target-link { padding: 0; overflow: hidden; color: var(--pms-primary); font-weight: 650; text-align: left; text-overflow: ellipsis; white-space: nowrap; background: none; border: 0; cursor: pointer; }
.requirement-execution-component__target-link:hover { text-decoration: underline; }
.requirement-execution-component__editor { display: grid; gap: var(--pms-space-3); padding: var(--pms-space-3); background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); }
.requirement-execution-component__type-tabs { display: flex; flex-wrap: wrap; gap: var(--pms-space-2); }
.requirement-execution-component__type-tabs button { padding: 6px 12px; color: var(--pms-text-muted); background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); cursor: pointer; }
.requirement-execution-component__type-tabs button.is-active { color: var(--pms-primary); background: var(--pms-primary-soft); border-color: var(--pms-primary); }
.requirement-execution-component__search-row, .requirement-execution-component__actions { display: flex; flex-wrap: wrap; gap: var(--pms-space-2); }
.requirement-execution-component__search-row :deep(.ant-input-affix-wrapper) { flex: 1 1 280px; }
.requirement-execution-component__options { display: grid; gap: var(--pms-space-2); max-height: 260px; overflow: auto; }
.requirement-execution-component__option { display: flex; align-items: center; gap: var(--pms-space-2); padding: 10px 12px; background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); cursor: pointer; }
.requirement-execution-component__option:hover, .requirement-execution-component__option.is-selected { border-color: var(--pms-primary); background: var(--pms-primary-soft); }
.requirement-execution-component__option input { flex: 0 0 auto; }
.requirement-execution-component__option-copy { display: grid; flex: 1 1 auto; gap: 3px; min-width: 0; }
.requirement-execution-component__option-copy strong { overflow: hidden; color: var(--pms-text); text-overflow: ellipsis; white-space: nowrap; }
.requirement-execution-component__option-copy small { overflow: hidden; color: var(--pms-text-faint); text-overflow: ellipsis; white-space: nowrap; }
.requirement-execution-component__empty { display: grid; min-height: 74px; place-items: center; color: var(--pms-text-faint); background: var(--pms-surface); border: 1px dashed var(--pms-border-strong); border-radius: var(--pms-radius-sm); }
.requirement-execution-component__history { padding-top: var(--pms-space-2); border-top: 1px solid var(--pms-border); }
.requirement-execution-component__history summary { color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); cursor: pointer; }
.requirement-execution-component__history ol { display: grid; gap: var(--pms-space-2); margin: var(--pms-space-2) 0 0; padding-left: 20px; }
.requirement-execution-component__history li { display: grid; gap: 3px; color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); }
.requirement-execution-component__history li span, .requirement-execution-component__history li small { color: var(--pms-text-faint); }
@media (max-width: 640px) { .requirement-execution-component__target { align-items: flex-start; flex-direction: column; } .requirement-execution-component__target-meta { justify-content: flex-start; } }
</style>
