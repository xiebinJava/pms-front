<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CheckCircleOutlined,
  LockOutlined,
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { apiErrorMessage } from '/@/plugins/http'
import {
  assignNodeSolutionReviewer,
  completeNodeSolutionReview,
  confirmNodeSolutionDecision,
  getNodeSolutionDesign,
  saveNodeSolutionDecisionDraft,
  saveNodeSolutionPackage,
  submitNodeSolutionPackage,
  updateNodeSolutionReview,
} from '/@/api/node-solution-design'
import type {
  NodeSolutionDecision,
  NodeSolutionDesign,
  NodeSolutionPackage,
  NodeSolutionReview,
  NodeSolutionReviewType,
} from '/@/types/domain'
import {
  allSolutionReviewsReady,
  canSubmitSolutionPackage,
  isSolutionDecisionComplete,
  isSolutionPackageComplete,
  shouldAutoConfirmDecision,
  canEditSolutionReviews,
  solutionReviewTypes,
} from '../solution-design'
import type { PersonOption } from '../workflow'
import PersonSelect from './PersonSelect.vue'

const props = defineProps<{
  projectId: number
  nodeId: number
  nodeReadOnly: boolean
  canEdit: boolean
  reviewerOptions: PersonOption[]
}>()

const emit = defineEmits<{
  (event: 'solution-status', status: string): void
  (event: 'saved'): void
}>()

const { t } = useI18n()
const loading = ref(false)
const saving = ref(false)
const submitting = ref(false)
const decisionSaving = ref(false)
const confirming = ref(false)
const reviewingType = ref<NodeSolutionReviewType | null>(null)
const assigningType = ref<NodeSolutionReviewType | null>(null)
const reviewSuggestionSaving = ref<NodeSolutionReviewType | null>(null)
const loadError = ref(false)
let packagePersistenceTimer: ReturnType<typeof setTimeout> | null = null
let decisionPersistenceTimer: ReturnType<typeof setTimeout> | null = null
let lastPackageFingerprint = ''
let lastDecisionFingerprint = ''

function emptyPackage(): NodeSolutionPackage {
  return {
    productSolution: '',
    technicalSolution: '',
    status: 'DRAFT',
    version: 0,
    canEdit: false,
  }
}

function emptyState(): NodeSolutionDesign {
  return {
    projectId: props.projectId,
    nodeId: props.nodeId,
    upstreamBaseline: {
      available: false,
      confirmed: false,
      inScopeCount: 0,
      requirementCount: 0,
    },
    solutionPackage: emptyPackage(),
    reviews: solutionReviewTypes.map((reviewType) => ({ reviewType, status: 'PENDING', version: 0 })),
    decision: {
      status: 'DRAFT',
      version: 0,
      canEdit: false,
    },
  }
}

const state = reactive<NodeSolutionDesign>(emptyState())
const decisionLocked = computed(() => state.decision.status === 'CONFIRMED' && props.nodeReadOnly)
const editable = computed(() => Boolean(
  props.canEdit
    && !props.nodeReadOnly
    && state.solutionPackage.canEdit
    && !decisionLocked.value
    && !loading.value,
))
const decisionEditable = computed(() => Boolean(
  props.canEdit
    && !props.nodeReadOnly
    && state.decision.canEdit
    && !decisionLocked.value
    && !loading.value,
))
const reviewEditable = computed(() => Boolean(
  canEditSolutionReviews(props.canEdit, props.nodeReadOnly)
    && !decisionLocked.value
    && !loading.value,
))
const reviewsComplete = computed(() => allSolutionReviewsReady(state.reviews))
const decisionComplete = computed(() => isSolutionDecisionComplete(state.decision))
const canSubmit = computed(() => canSubmitSolutionPackage(editable.value, state.solutionPackage, state.upstreamBaseline))
const canConfirm = computed(() => Boolean(
  props.canEdit
    && !props.nodeReadOnly
    && !decisionLocked.value
    && state.solutionPackage.status === 'SUBMITTED'
    && reviewsComplete.value
    && decisionComplete.value
    && !confirming.value,
))
const reviewLabelKey: Record<NodeSolutionReviewType, string> = {
  BUSINESS_PRODUCT: 'detail.solutionDesign.reviews.businessProduct',
  TECHNICAL: 'detail.solutionDesign.reviews.technical',
  TEST_RELEASE: 'detail.solutionDesign.reviews.testRelease',
}
const decisionOptions = computed(() => [
  { value: 'PASS', label: t('detail.solutionDesign.decision.results.pass') },
  { value: 'CONDITIONAL_PASS', label: t('detail.solutionDesign.decision.results.conditionalPass') },
  { value: 'RETURN_FOR_CHANGES', label: t('detail.solutionDesign.decision.results.returnForChanges') },
])

function replaceState(next: NodeSolutionDesign) {
  const packageValue = {
    ...emptyPackage(),
    ...(next.solutionPackage || {}),
    productSolution: next.solutionPackage?.productSolution ?? '',
    technicalSolution: next.solutionPackage?.technicalSolution ?? '',
  }
  const reviews = solutionReviewTypes.map((reviewType) => next.reviews?.find((item) => item.reviewType === reviewType)
    || { reviewType, status: 'PENDING' as const })
  const decision: NodeSolutionDecision = {
    ...(next.decision || {}),
    status: next.decision?.status || 'DRAFT',
    version: next.decision?.version ?? 0,
    canEdit: next.decision?.canEdit ?? false,
  }
  Object.assign(state, {
    ...emptyState(),
    ...next,
    projectId: props.projectId,
    nodeId: props.nodeId,
    upstreamBaseline: { ...emptyState().upstreamBaseline, ...(next.upstreamBaseline || {}) },
    solutionPackage: packageValue,
    reviews,
    decision,
  })
  emit('solution-status', decision.status)
  lastPackageFingerprint = JSON.stringify(packagePayload())
  lastDecisionFingerprint = JSON.stringify(decisionPayload())
}

function applyServerMeta(next: NodeSolutionDesign) {
  if (next.upstreamBaseline) Object.assign(state.upstreamBaseline, next.upstreamBaseline)
  if (next.solutionPackage) {
    state.solutionPackage.version = next.solutionPackage.version
    state.solutionPackage.status = next.solutionPackage.status
    state.solutionPackage.canEdit = next.solutionPackage.canEdit
  }
  next.reviews?.forEach((saved) => {
    const current = state.reviews.find((item) => item.reviewType === saved.reviewType)
    if (!current) return
    current.version = saved.version
    current.status = saved.status
    current.canComplete = saved.canComplete
    current.reviewerId = saved.reviewerId
  })
  if (next.decision) {
    state.decision.version = next.decision.version
    state.decision.status = next.decision.status
    state.decision.canEdit = next.decision.canEdit
    state.decision.confirmedBy = next.decision.confirmedBy
    state.decision.confirmedAt = next.decision.confirmedAt
    if (next.decision.result !== undefined) state.decision.result = next.decision.result
  }
  emit('solution-status', state.decision.status)
  lastPackageFingerprint = JSON.stringify(packagePayload())
  lastDecisionFingerprint = JSON.stringify(decisionPayload())
}

async function load() {
  loading.value = true
  loadError.value = false
  let next: NodeSolutionDesign | null = null
  try {
    next = await getNodeSolutionDesign(props.projectId, props.nodeId)
    replaceState(next)
  } catch (error) {
    loadError.value = true
    message.error(apiErrorMessage(error, t('detail.solutionDesign.loadFailed')))
  } finally {
    loading.value = false
  }
  if (!next) return
  if (next.solutionPackage?.status === 'DRAFT'
    && next.upstreamBaseline?.confirmed
    && isSolutionPackageComplete(next.solutionPackage)) {
    schedulePackagePersistence()
  }
  if (next.decision?.status === 'DRAFT' && isSolutionDecisionComplete(next.decision)) {
    scheduleDecisionPersistence(0)
  }
}

function packagePayload() {
  return {
    version: state.solutionPackage.version,
    productSolution: state.solutionPackage.productSolution?.trim() || undefined,
    technicalSolution: state.solutionPackage.technicalSolution?.trim() || undefined,
  }
}

function decisionPayload() {
  return {
    version: state.decision.version,
    result: state.decision.result,
    conditions: state.decision.conditions?.trim() || undefined,
  }
}

async function saveDraft(showSuccess = true): Promise<boolean> {
  if (!editable.value || saving.value) return false
  saving.value = true
  try {
    const next = await saveNodeSolutionPackage(props.projectId, props.nodeId, packagePayload())
    applyServerMeta(next)
    emit('saved')
    if (showSuccess) message.success(t('detail.solutionDesign.saved'))
    return true
  } catch {
    message.error(t('detail.solutionDesign.saveFailed'))
    return false
  } finally {
    saving.value = false
  }
}

async function submitPackage(): Promise<boolean> {
  if (!canSubmit.value || submitting.value) return false
  submitting.value = true
  try {
    const next = await submitNodeSolutionPackage(props.projectId, props.nodeId, state.solutionPackage.version)
    applyServerMeta(next)
    message.success(t('detail.solutionDesign.submitted'))
    scheduleDecisionPersistence(0)
    return true
  } catch {
    message.error(t('detail.solutionDesign.submitFailed'))
    return false
  } finally {
    submitting.value = false
  }
}

function schedulePackagePersistence(eventOrDelay?: unknown) {
  const delay = typeof eventOrDelay === 'number' ? eventOrDelay : 650
  if (!editable.value) return
  if (packagePersistenceTimer) clearTimeout(packagePersistenceTimer)
  packagePersistenceTimer = setTimeout(() => {
    packagePersistenceTimer = null
    void persistPackage()
  }, delay)
}

function handleWorkbenchFocusOut(event: FocusEvent) {
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.matches('input, textarea, [role="combobox"]')) return
  if (target.closest('.solution-design-review-row')) return
  if (target.closest('.solution-design-package-grid')) {
    schedulePackagePersistence(0)
    return
  }
  if (target.closest('.solution-design-decision-grid')) {
    scheduleDecisionPersistence(0)
  }
}

async function persistPackage() {
  if (!editable.value) return
  if (saving.value || submitting.value) {
    schedulePackagePersistence()
    return
  }
  const fingerprint = JSON.stringify(packagePayload())
  if (fingerprint !== lastPackageFingerprint) {
    const saved = await saveDraft(false)
    if (!saved) return
  }
  if (canSubmit.value) {
    const submitted = await submitPackage()
    if (submitted) scheduleDecisionPersistence(0)
  }
}

function scheduleDecisionPersistence(eventOrDelay?: unknown) {
  const delay = typeof eventOrDelay === 'number' ? eventOrDelay : 650
  if (state.decision.status === 'CONFIRMED' && !props.nodeReadOnly) {
    state.decision.status = 'DRAFT'
    state.decision.confirmedBy = undefined
    state.decision.confirmedAt = undefined
    emit('solution-status', 'DRAFT')
  }
  if (!decisionEditable.value) return
  if (decisionPersistenceTimer) clearTimeout(decisionPersistenceTimer)
  decisionPersistenceTimer = setTimeout(() => {
    decisionPersistenceTimer = null
    void persistDecision()
  }, delay)
}

async function saveDecisionDraft(): Promise<boolean> {
  if (!decisionEditable.value) return false
  decisionSaving.value = true
  try {
    const next = await saveNodeSolutionDecisionDraft(props.projectId, props.nodeId, decisionPayload())
    applyServerMeta(next)
    return true
  } catch (error) {
    message.error(apiErrorMessage(error, t('detail.solutionDesign.decision.saveFailed')))
    return false
  } finally {
    decisionSaving.value = false
  }
}

async function persistDecision() {
  if (!decisionEditable.value) return
  if (decisionSaving.value || confirming.value) {
    scheduleDecisionPersistence()
    return
  }
  const fingerprint = JSON.stringify(decisionPayload())
  if (fingerprint !== lastDecisionFingerprint) {
    const saved = await saveDecisionDraft()
    if (!saved) return
  }
  if (shouldAutoConfirmDecision(
    props.canEdit && !props.nodeReadOnly,
    state.solutionPackage.status,
    state.reviews,
    state.decision,
  )) {
    await confirmDecision()
  }
}

async function completeReview(review: NodeSolutionReview) {
  if (review.status === 'PASSED' || reviewingType.value || !review.canComplete || props.nodeReadOnly) return
  reviewingType.value = review.reviewType
  try {
    const next = await completeNodeSolutionReview(
      props.projectId,
      props.nodeId,
      review.reviewType,
      review.version,
      review.comment?.trim() || undefined,
    )
    applyServerMeta(next)
    scheduleDecisionPersistence(0)
    message.success(t('detail.solutionDesign.reviewCompleted'))
  } catch (error) {
    message.error(apiErrorMessage(error, t('detail.solutionDesign.reviewFailed')))
  } finally {
    reviewingType.value = null
  }
}

async function assignReviewer(review: NodeSolutionReview) {
  if (!review.reviewerId || assigningType.value || !reviewEditable.value) return
  assigningType.value = review.reviewType
  try {
    const next = await assignNodeSolutionReviewer(
      props.projectId,
      props.nodeId,
      review.reviewType,
      review.version,
      review.reviewerId,
    )
    applyServerMeta(next)
    message.success(t('detail.solutionDesign.reviewerAssigned'))
  } catch (error) {
    message.error(apiErrorMessage(error, t('detail.solutionDesign.reviewerAssignFailed')))
  } finally {
    assigningType.value = null
  }
}

async function saveReviewSuggestion(review: NodeSolutionReview) {
  if (!reviewEditable.value || reviewSuggestionSaving.value === review.reviewType || !review.reviewerId) return
  reviewSuggestionSaving.value = review.reviewType
  try {
    const next = await updateNodeSolutionReview(
      props.projectId,
      props.nodeId,
      review.reviewType,
      review.version,
      review.comment?.trim() || undefined,
    )
    applyServerMeta(next)
  } catch (error) {
    message.error(apiErrorMessage(error, t('detail.solutionDesign.reviews.suggestionSaveFailed')))
  } finally {
    reviewSuggestionSaving.value = null
  }
}

async function confirmDecision() {
  if (!canConfirm.value || !state.decision.result) return
  confirming.value = true
  try {
    const next = await confirmNodeSolutionDecision(props.projectId, props.nodeId, {
      version: state.decision.version,
      result: state.decision.result,
      conditions: state.decision.conditions?.trim() || undefined,
    })
    applyServerMeta(next)
    message.success(t('detail.solutionDesign.decision.confirmedMessage'))
  } catch (error) {
    message.error(apiErrorMessage(error, t('detail.solutionDesign.decision.confirmFailed')))
  } finally {
    confirming.value = false
  }
}

function reviewStatusLabel(status: NodeSolutionReview['status']) {
  return t(status === 'PASSED' ? 'detail.solutionDesign.reviewStatus.passed' : 'detail.solutionDesign.reviewStatus.pending')
}

watch(() => [props.projectId, props.nodeId], () => { void load() }, { immediate: true })

onBeforeUnmount(() => {
  if (packagePersistenceTimer) clearTimeout(packagePersistenceTimer)
  if (decisionPersistenceTimer) clearTimeout(decisionPersistenceTimer)
})
</script>

<template>
  <section
    class="solution-design-workbench"
    :class="{ 'solution-design-workbench--confirmed': decisionLocked }"
    @focusout="handleWorkbenchFocusOut"
  >
    <div class="solution-design-workbench__header">
      <div>
        <div class="solution-design-workbench__title-row">
          <h3>{{ $t('detail.solutionDesign.title') }}</h3>
          <a-tag v-if="decisionLocked" color="green"><LockOutlined /> {{ $t('detail.solutionDesign.decision.confirmed') }}</a-tag>
        </div>
        <p v-if="!state.upstreamBaseline.confirmed" class="solution-design-submit-hint">
          {{ $t('detail.solutionDesign.package.requirementBaselineRequired') }}
        </p>
      </div>
    </div>

    <a-alert
      v-if="loadError"
      type="error"
      show-icon
      :message="$t('detail.solutionDesign.loadFailed')"
    />
    <a-skeleton v-else-if="loading" active :paragraph="{ rows: 7 }" />
    <template v-else>
      <div class="solution-design-block">
        <div class="solution-design-block__heading">
          <div>
            <h4>{{ $t('detail.solutionDesign.package.title') }}</h4>
          </div>
        </div>
        <div class="solution-design-package-grid">
          <div class="solution-design-field">
            <label>{{ $t('detail.solutionDesign.package.productSolution') }}</label>
            <a-input v-model:value="state.solutionPackage.productSolution" :disabled="!editable" :placeholder="$t('detail.solutionDesign.package.productPlaceholder')" />
          </div>
          <div class="solution-design-field">
            <label>{{ $t('detail.solutionDesign.package.technicalSolution') }}</label>
            <a-input v-model:value="state.solutionPackage.technicalSolution" :disabled="!editable" :placeholder="$t('detail.solutionDesign.package.technicalPlaceholder')" />
          </div>
        </div>
      </div>

      <div class="solution-design-block">
        <div class="solution-design-block__heading">
          <div>
            <h4>{{ $t('detail.solutionDesign.reviews.title') }}</h4>
            <p>{{ $t('detail.solutionDesign.reviews.hint') }}</p>
          </div>
          <span class="solution-design-review-summary">{{ state.reviews.filter((review) => review.status === 'PASSED').length }} / 3 {{ $t('detail.solutionDesign.reviews.passed') }}</span>
        </div>
        <div class="solution-design-review-list">
          <div v-for="review in state.reviews" :key="review.reviewType" class="solution-design-review-row">
            <div class="solution-design-review-row__marker" :class="{ 'is-passed': review.status === 'PASSED' }">
              <CheckCircleOutlined v-if="review.status === 'PASSED'" />
              <span v-else />
            </div>
            <div class="solution-design-review-row__copy">
              <strong>{{ $t(reviewLabelKey[review.reviewType]) }}</strong>
              <small :class="{ 'is-passed': review.status === 'PASSED' }">{{ reviewStatusLabel(review.status) }}</small>
            </div>
            <a-input
              v-if="reviewEditable"
              v-model:value="review.comment"
              class="solution-design-review-row__suggestion"
              :maxlength="2000"
              :placeholder="$t('detail.solutionDesign.reviews.suggestionPlaceholder')"
              @blur="saveReviewSuggestion(review)"
            />
            <span v-else class="solution-design-review-row__suggestion" :title="review.comment || $t('detail.solutionDesign.reviews.suggestion')">
              {{ review.comment || $t('detail.solutionDesign.reviews.suggestion') }}
            </span>
            <PersonSelect
              v-model="review.reviewerId"
              class="solution-design-review-row__reviewer"
              :options="props.reviewerOptions"
              :placeholder="$t('detail.solutionDesign.reviews.reviewerPlaceholder')"
              :loading="assigningType === review.reviewType"
              :disabled="assigningType !== null || !reviewEditable"
              @change="assignReviewer(review)"
            />
            <a-button
              v-if="review.status !== 'PASSED'"
              class="pms-project-button pms-project-button--secondary solution-design-review-row__action"
              :loading="reviewingType === review.reviewType"
              :disabled="!review.canComplete || props.nodeReadOnly || state.solutionPackage.status !== 'SUBMITTED' || decisionLocked"
              @click="completeReview(review)"
            >
              {{ $t('detail.solutionDesign.reviews.complete') }}
            </a-button>
          </div>
        </div>
      </div>

      <div class="solution-design-block solution-design-decision">
        <div class="solution-design-block__heading">
          <div>
            <h4>{{ $t('detail.solutionDesign.decision.title') }}</h4>
            <p>{{ $t('detail.solutionDesign.decision.hint') }}</p>
          </div>
        </div>
        <div class="solution-design-decision-grid">
          <div class="solution-design-field">
            <label>{{ $t('detail.solutionDesign.decision.result') }}</label>
            <a-select v-model:value="state.decision.result" :options="decisionOptions" :disabled="!props.canEdit || !state.decision.canEdit || props.nodeReadOnly || decisionLocked || loading" @change="scheduleDecisionPersistence" />
          </div>
          <div class="solution-design-field">
            <label>{{ $t('detail.solutionDesign.decision.conditions') }}</label>
            <a-textarea v-model:value="state.decision.conditions" class="solution-design-decision__conditions" :rows="1" :disabled="!props.canEdit || !state.decision.canEdit || props.nodeReadOnly || decisionLocked || loading" :placeholder="$t('detail.solutionDesign.decision.conditionsPlaceholder')" />
          </div>
        </div>
      </div>

    </template>
  </section>
</template>

<style scoped>
.solution-design-workbench { display: grid; gap: 14px; padding: 18px; background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: 8px; }
.solution-design-workbench__header, .solution-design-block__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.solution-design-workbench__header { padding-bottom: 2px; }
.solution-design-workbench__title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; }
.solution-design-workbench h3, .solution-design-workbench h4 { margin: 0; color: var(--pms-text); }
.solution-design-workbench h3 { font-size: 17px; font-weight: 650; }
.solution-design-workbench h4 { font-size: 14px; font-weight: 700; }
.solution-design-workbench p { margin: 5px 0 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); line-height: 1.55; }
.solution-design-submit-hint { color: var(--pms-warning) !important; }
.solution-design-block { background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: 8px; }
.solution-design-block { padding: 16px; }
.solution-design-block__heading { align-items: center; padding-bottom: 12px; border-bottom: 1px solid var(--pms-border); }
.solution-design-review-summary { flex: 0 0 auto; color: var(--pms-text-faint); font-size: 12px; }
.solution-design-field { display: grid; gap: 6px; min-width: 0; }
.solution-design-field label { color: var(--pms-text-muted); font-size: 12px; font-weight: 650; }
.solution-design-package-grid, .solution-design-decision-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 14px; }
.solution-design-field--wide { grid-column: 1 / -1; }
.solution-design-review-list { display: grid; gap: 8px; margin-top: 14px; }
.solution-design-review-row { display: flex; align-items: center; gap: 10px; min-height: 54px; padding: 9px 11px; background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: 7px; }
.solution-design-review-row__marker { display: grid; place-items: center; flex: 0 0 20px; width: 20px; height: 20px; color: var(--pms-text-faint); border: 1px solid var(--pms-border-strong); border-radius: 50%; }
.solution-design-review-row__marker > span { width: 6px; height: 6px; background: currentColor; border-radius: 50%; }
.solution-design-review-row__marker.is-passed { color: var(--pms-success); border-color: #9ad8b4; background: var(--pms-success-soft); }
.solution-design-review-row__copy { display: flex; align-items: baseline; flex: 1 1 auto; gap: 7px; min-width: 150px; }
.solution-design-review-row__copy strong { color: var(--pms-text); font-size: 13px; }
.solution-design-review-row__copy strong, .solution-design-review-row__suggestion { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.solution-design-review-row__copy small { color: var(--pms-text-faint); font-size: 11px; white-space: nowrap; }
.solution-design-review-row__copy small.is-passed { color: var(--pms-success); }
.solution-design-review-row__reviewer { flex: 0 0 210px; min-width: 0; }
.solution-design-review-row__suggestion { flex: 0 1 220px; min-width: 130px; margin: 0; color: var(--pms-text-muted); font-size: 12px; text-align: left; }
.solution-design-review-row__suggestion.ant-input { height: 30px; padding-inline: 8px; }
.solution-design-review-row__suggestion:not(.ant-input) { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 30px; }
.solution-design-review-row__action { flex: 0 0 auto; min-height: 30px; padding-inline: 10px; }
.solution-design-decision { position: relative; }
.solution-design-decision__conditions { height: 32px !important; min-height: 32px !important; resize: none; }
.solution-design-decision :deep(.ant-select-selector) { display: flex; align-items: center; height: 32px; }
.solution-design-decision :deep(.ant-select-arrow) { top: 50%; transform: translateY(-50%); }
@media (max-width: 720px) {
  .solution-design-workbench__header, .solution-design-block__heading { align-items: stretch; flex-direction: column; }
  .solution-design-package-grid, .solution-design-decision-grid { grid-template-columns: 1fr; }
  .solution-design-field--wide { grid-column: auto; }
  .solution-design-review-row { align-items: flex-start; flex-wrap: wrap; }
  .solution-design-review-row__reviewer { flex: 1 1 180px; }
  .solution-design-review-row__suggestion { flex: 1 1 160px; }
  .solution-design-review-row__action { align-self: center; }
}
</style>
