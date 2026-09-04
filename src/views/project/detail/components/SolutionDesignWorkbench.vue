<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CheckCircleOutlined,
  EditOutlined,
  LockOutlined,
  ReloadOutlined,
  SaveOutlined,
  SendOutlined,
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import {
  completeNodeSolutionReview,
  confirmNodeSolutionDecision,
  getNodeSolutionDesign,
  reopenNodeSolutionDecision,
  saveNodeSolutionPackage,
  submitNodeSolutionPackage,
} from '/@/api/node-solution-design'
import type {
  NodeSolutionDecision,
  NodeSolutionDesign,
  NodeSolutionPackage,
  NodeSolutionReview,
  NodeSolutionReviewType,
} from '/@/types/domain'
import {
  allSolutionReviewsPassed,
  isSolutionDecisionComplete,
  isSolutionPackageComplete,
  solutionReviewTypes,
} from '../solution-design'

const props = defineProps<{
  projectId: number
  nodeId: number
  nodeReadOnly: boolean
  canEdit: boolean
}>()

const emit = defineEmits<{
  (event: 'solution-status', status: string): void
  (event: 'saved'): void
}>()

const { t } = useI18n()
const loading = ref(false)
const saving = ref(false)
const submitting = ref(false)
const confirming = ref(false)
const reopening = ref(false)
const reviewingType = ref<NodeSolutionReviewType | null>(null)
const loadError = ref(false)
const packageEditing = ref(true)

function emptyPackage(): NodeSolutionPackage {
  return {
    packageVersion: '',
    productSolution: '',
    technicalSolution: '',
    summary: '',
    scopeCoverage: '',
    rolloutPremise: '',
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
    reviews: solutionReviewTypes.map((reviewType) => ({ reviewType, status: 'PENDING' })),
    decision: {
      status: 'DRAFT',
      version: 0,
      canEdit: false,
    },
  }
}

const state = reactive<NodeSolutionDesign>(emptyState())
const decisionLocked = computed(() => state.decision.status === 'CONFIRMED')
const editable = computed(() => Boolean(
  props.canEdit
    && !props.nodeReadOnly
    && state.solutionPackage.canEdit
    && !decisionLocked.value
    && packageEditing.value
    && !loading.value,
))
const packageComplete = computed(() => isSolutionPackageComplete(state.solutionPackage))
const reviewsComplete = computed(() => allSolutionReviewsPassed(state.reviews))
const decisionComplete = computed(() => isSolutionDecisionComplete(state.decision))
const canSubmit = computed(() => editable.value && packageComplete.value)
const canConfirm = computed(() => Boolean(
  props.canEdit
    && !props.nodeReadOnly
    && !decisionLocked.value
    && state.solutionPackage.status === 'SUBMITTED'
    && reviewsComplete.value
    && decisionComplete.value
    && !confirming.value,
))
const checklist = computed(() => [
  { key: 'package', label: t('detail.solutionDesign.checklist.package'), checked: state.solutionPackage.status === 'SUBMITTED' },
  { key: 'reviews', label: t('detail.solutionDesign.checklist.reviews'), checked: reviewsComplete.value },
  { key: 'decision', label: t('detail.solutionDesign.checklist.decision'), checked: decisionLocked.value },
])
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
  const packageValue = { ...emptyPackage(), ...(next.solutionPackage || {}) }
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
  packageEditing.value = packageValue.status === 'DRAFT'
  emit('solution-status', decision.status)
}

async function load() {
  loading.value = true
  loadError.value = false
  try {
    const next = await getNodeSolutionDesign(props.projectId, props.nodeId)
    replaceState(next)
  } catch {
    loadError.value = true
    message.error(t('detail.solutionDesign.loadFailed'))
  } finally {
    loading.value = false
  }
}

function packagePayload() {
  return {
    version: state.solutionPackage.version,
    packageVersion: state.solutionPackage.packageVersion.trim() || undefined,
    productSolution: state.solutionPackage.productSolution.trim() || undefined,
    technicalSolution: state.solutionPackage.technicalSolution.trim() || undefined,
    summary: state.solutionPackage.summary.trim() || undefined,
    scopeCoverage: state.solutionPackage.scopeCoverage.trim() || undefined,
    rolloutPremise: state.solutionPackage.rolloutPremise.trim() || undefined,
  }
}

async function saveDraft(showSuccess = true): Promise<boolean> {
  if (!editable.value || saving.value) return false
  saving.value = true
  try {
    const next = await saveNodeSolutionPackage(props.projectId, props.nodeId, packagePayload())
    replaceState(next)
    packageEditing.value = true
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

async function submitPackage() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  try {
    if (!await saveDraft(false)) return
    const next = await submitNodeSolutionPackage(props.projectId, props.nodeId, state.solutionPackage.version)
    replaceState(next)
    packageEditing.value = false
    message.success(t('detail.solutionDesign.submitted'))
  } catch {
    message.error(t('detail.solutionDesign.submitFailed'))
  } finally {
    submitting.value = false
  }
}

async function completeReview(review: NodeSolutionReview) {
  if (review.status === 'PASSED' || reviewingType.value || !props.canEdit || props.nodeReadOnly) return
  reviewingType.value = review.reviewType
  try {
    const next = await completeNodeSolutionReview(props.projectId, props.nodeId, review.reviewType)
    replaceState(next)
    message.success(t('detail.solutionDesign.reviewCompleted'))
  } catch {
    message.error(t('detail.solutionDesign.reviewFailed'))
  } finally {
    reviewingType.value = null
  }
}

async function confirmDecision() {
  if (!canConfirm.value || !state.decision.result) return
  confirming.value = true
  try {
    const next = await confirmNodeSolutionDecision(props.projectId, props.nodeId, {
      version: state.decision.version,
      result: state.decision.result,
      reason: state.decision.reason?.trim() || '',
      conditions: state.decision.conditions?.trim() || undefined,
    })
    replaceState(next)
    message.success(t('detail.solutionDesign.decision.confirmedMessage'))
  } catch {
    message.error(t('detail.solutionDesign.decision.confirmFailed'))
  } finally {
    confirming.value = false
  }
}

async function reopenDecision() {
  if (!props.canEdit || props.nodeReadOnly || reopening.value) return
  reopening.value = true
  try {
    const next = await reopenNodeSolutionDecision(props.projectId, props.nodeId)
    replaceState(next)
    message.success(t('detail.solutionDesign.decision.reopenedMessage'))
  } catch {
    message.error(t('detail.solutionDesign.decision.reopenFailed'))
  } finally {
    reopening.value = false
  }
}

function editPackage() {
  if (!props.canEdit || props.nodeReadOnly || decisionLocked.value) return
  packageEditing.value = true
}

function reviewStatusLabel(status: NodeSolutionReview['status']) {
  return t(status === 'PASSED' ? 'detail.solutionDesign.reviewStatus.passed' : 'detail.solutionDesign.reviewStatus.pending')
}

watch(() => [props.projectId, props.nodeId], () => { void load() }, { immediate: true })
</script>

<template>
  <section class="solution-design-workbench" :class="{ 'solution-design-workbench--locked': decisionLocked }">
    <div class="solution-design-workbench__header">
      <div>
        <div class="solution-design-workbench__title-row">
          <h3>{{ $t('detail.solutionDesign.title') }}</h3>
          <a-tag v-if="decisionLocked" color="green"><LockOutlined /> {{ $t('detail.solutionDesign.decision.confirmed') }}</a-tag>
          <a-tag v-else-if="state.solutionPackage.status === 'SUBMITTED'" color="blue">{{ $t('detail.solutionDesign.package.submitted') }}</a-tag>
          <a-tag v-else color="orange">{{ $t('detail.solutionDesign.package.draft') }}</a-tag>
        </div>
        <p>{{ $t('detail.solutionDesign.description') }}</p>
      </div>
      <div class="solution-design-workbench__actions">
        <a-button
          v-if="state.solutionPackage.status === 'SUBMITTED' && !packageEditing"
          class="pms-project-button pms-project-button--secondary"
          :disabled="!props.canEdit || props.nodeReadOnly || decisionLocked"
          @click="editPackage"
        >
          <EditOutlined /> {{ $t('detail.solutionDesign.package.edit') }}
        </a-button>
        <template v-else>
          <a-button
            class="pms-project-button pms-project-button--secondary"
            :loading="saving"
            :disabled="!editable"
            @click="saveDraft()"
          >
            <SaveOutlined /> {{ $t('detail.solutionDesign.package.saveDraft') }}
          </a-button>
          <a-button
            type="primary"
            class="pms-primary-button pms-project-button pms-project-button--primary"
            :loading="submitting"
            :disabled="!canSubmit"
            @click="submitPackage"
          >
            <SendOutlined /> {{ $t('detail.solutionDesign.package.submit') }}
          </a-button>
        </template>
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
      <div class="solution-design-upstream" :class="{ 'solution-design-upstream--pending': !state.upstreamBaseline.confirmed }">
        <div>
          <span class="solution-design-upstream__label">{{ $t('detail.solutionDesign.upstream.title') }}</span>
          <strong>{{ state.upstreamBaseline.confirmed ? $t('detail.solutionDesign.upstream.confirmed') : $t('detail.solutionDesign.upstream.pending') }}</strong>
          <span class="solution-design-upstream__meta">
            {{ $t('detail.solutionDesign.upstream.summary', { version: state.upstreamBaseline.version ?? '-', inScope: state.upstreamBaseline.inScopeCount, requirements: state.upstreamBaseline.requirementCount }) }}
          </span>
        </div>
        <span class="solution-design-upstream__readonly">{{ $t('detail.solutionDesign.upstream.readonly') }}</span>
      </div>

      <div class="solution-design-block">
        <div class="solution-design-block__heading">
          <div>
            <h4>{{ $t('detail.solutionDesign.package.title') }}</h4>
            <p>{{ $t('detail.solutionDesign.package.hint') }}</p>
          </div>
          <span class="solution-design-block__state">{{ state.solutionPackage.status === 'SUBMITTED' ? $t('detail.solutionDesign.package.submitted') : $t('detail.solutionDesign.package.draft') }}</span>
        </div>
        <div class="solution-design-package-meta">
          <label>{{ $t('detail.solutionDesign.package.version') }}</label>
          <a-input v-model:value="state.solutionPackage.packageVersion" :disabled="!editable" :placeholder="$t('detail.solutionDesign.package.versionPlaceholder')" />
        </div>
        <div class="solution-design-package-grid">
          <div class="solution-design-field">
            <label>{{ $t('detail.solutionDesign.package.productSolution') }}</label>
            <a-textarea v-model:value="state.solutionPackage.productSolution" :rows="5" :disabled="!editable" :placeholder="$t('detail.solutionDesign.package.productPlaceholder')" />
          </div>
          <div class="solution-design-field">
            <label>{{ $t('detail.solutionDesign.package.technicalSolution') }}</label>
            <a-textarea v-model:value="state.solutionPackage.technicalSolution" :rows="5" :disabled="!editable" :placeholder="$t('detail.solutionDesign.package.technicalPlaceholder')" />
          </div>
        </div>
        <div class="solution-design-form-grid">
          <div class="solution-design-field">
            <label>{{ $t('detail.solutionDesign.package.summary') }}</label>
            <a-textarea v-model:value="state.solutionPackage.summary" :rows="3" :disabled="!editable" :placeholder="$t('detail.solutionDesign.package.summaryPlaceholder')" />
          </div>
          <div class="solution-design-field">
            <label>{{ $t('detail.solutionDesign.package.scopeCoverage') }}</label>
            <a-textarea v-model:value="state.solutionPackage.scopeCoverage" :rows="3" :disabled="!editable" :placeholder="$t('detail.solutionDesign.package.scopePlaceholder')" />
          </div>
          <div class="solution-design-field solution-design-field--wide">
            <label>{{ $t('detail.solutionDesign.package.rolloutPremise') }}</label>
            <a-textarea v-model:value="state.solutionPackage.rolloutPremise" :rows="3" :disabled="!editable" :placeholder="$t('detail.solutionDesign.package.rolloutPlaceholder')" />
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
              <small>{{ reviewStatusLabel(review.status) }}</small>
            </div>
            <span v-if="review.status === 'PASSED'" class="solution-design-review-row__done">{{ $t('detail.solutionDesign.reviewStatus.passed') }}</span>
            <a-button
              v-else
              class="pms-project-button pms-project-button--secondary solution-design-review-row__action"
              :loading="reviewingType === review.reviewType"
              :disabled="!props.canEdit || props.nodeReadOnly || state.solutionPackage.status !== 'SUBMITTED' || decisionLocked"
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
          <a-tag :color="decisionLocked ? 'green' : 'orange'">{{ decisionLocked ? $t('detail.solutionDesign.decision.confirmed') : $t('detail.solutionDesign.decision.pending') }}</a-tag>
        </div>
        <div class="solution-design-decision-grid">
          <div class="solution-design-field">
            <label>{{ $t('detail.solutionDesign.decision.result') }}</label>
            <a-select v-model:value="state.decision.result" :options="decisionOptions" :disabled="!props.canEdit || !state.decision.canEdit || props.nodeReadOnly || decisionLocked" />
          </div>
          <div class="solution-design-field solution-design-decision-date">
            <label>{{ $t('detail.solutionDesign.decision.date') }}</label>
            <span>{{ state.decision.confirmedAt ? state.decision.confirmedAt.slice(0, 10) : $t('detail.solutionDesign.decision.notConfirmed') }}</span>
          </div>
          <div class="solution-design-field solution-design-field--wide">
            <label>{{ $t('detail.solutionDesign.decision.reason') }}</label>
            <a-textarea v-model:value="state.decision.reason" :rows="3" :disabled="!props.canEdit || !state.decision.canEdit || props.nodeReadOnly || decisionLocked" :placeholder="$t('detail.solutionDesign.decision.reasonPlaceholder')" />
          </div>
          <div class="solution-design-field solution-design-field--wide">
            <label>{{ $t('detail.solutionDesign.decision.conditions') }}</label>
            <a-textarea v-model:value="state.decision.conditions" :rows="3" :disabled="!props.canEdit || !state.decision.canEdit || props.nodeReadOnly || decisionLocked" :placeholder="$t('detail.solutionDesign.decision.conditionsPlaceholder')" />
          </div>
        </div>
        <div class="solution-design-decision__actions">
          <a-button
            v-if="decisionLocked"
            class="pms-project-button pms-project-button--secondary"
            :loading="reopening"
            :disabled="!props.canEdit || props.nodeReadOnly"
            @click="reopenDecision"
          >
            <ReloadOutlined /> {{ $t('detail.solutionDesign.decision.reopen') }}
          </a-button>
          <a-button
            v-else
            type="primary"
            class="pms-primary-button pms-project-button pms-project-button--primary"
            :loading="confirming"
            :disabled="!canConfirm"
            @click="confirmDecision"
          >
            <CheckCircleOutlined /> {{ $t('detail.solutionDesign.decision.confirm') }}
          </a-button>
        </div>
      </div>

      <div class="solution-design-checklist">
        <div class="solution-design-checklist__title">{{ $t('detail.solutionDesign.checklist.title') }}</div>
        <div class="solution-design-checklist__items">
          <span v-for="item in checklist" :key="item.key" :class="{ 'is-checked': item.checked }">
            <CheckCircleOutlined /> {{ item.label }}
          </span>
        </div>
        <small v-if="!decisionLocked">{{ $t('detail.solutionDesign.checklist.hint') }}</small>
        <small v-else class="is-confirmed">{{ $t('detail.solutionDesign.checklist.confirmed') }}</small>
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
.solution-design-workbench__actions { display: flex; flex: 0 0 auto; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.solution-design-upstream, .solution-design-block, .solution-design-checklist { background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: 8px; }
.solution-design-upstream { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 14px; border-left: 3px solid var(--pms-primary); }
.solution-design-upstream--pending { border-left-color: var(--pms-warning); }
.solution-design-upstream > div { display: flex; align-items: baseline; flex-wrap: wrap; gap: 7px 10px; min-width: 0; }
.solution-design-upstream__label { color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.solution-design-upstream strong { color: var(--pms-text); font-size: 13px; }
.solution-design-upstream--pending strong { color: var(--pms-warning); }
.solution-design-upstream__meta, .solution-design-upstream__readonly { color: var(--pms-text-faint); font-size: 12px; }
.solution-design-upstream__readonly { flex: 0 0 auto; padding: 3px 7px; background: var(--pms-surface-muted); border-radius: 4px; }
.solution-design-block { padding: 16px; }
.solution-design-block__heading { align-items: center; padding-bottom: 12px; border-bottom: 1px solid var(--pms-border); }
.solution-design-block__state, .solution-design-review-summary { flex: 0 0 auto; color: var(--pms-text-faint); font-size: 12px; }
.solution-design-package-meta { display: grid; grid-template-columns: 88px minmax(0, 220px); align-items: center; gap: 10px; margin-top: 14px; }
.solution-design-field { display: grid; gap: 6px; min-width: 0; }
.solution-design-field label, .solution-design-package-meta label { color: var(--pms-text-muted); font-size: 12px; font-weight: 650; }
.solution-design-package-grid, .solution-design-form-grid, .solution-design-decision-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 14px; }
.solution-design-form-grid { gap: 12px 20px; }
.solution-design-field--wide { grid-column: 1 / -1; }
.solution-design-review-list { display: grid; gap: 8px; margin-top: 14px; }
.solution-design-review-row { display: flex; align-items: center; gap: 10px; min-height: 54px; padding: 9px 11px; background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: 7px; }
.solution-design-review-row__marker { display: grid; place-items: center; flex: 0 0 20px; width: 20px; height: 20px; color: var(--pms-text-faint); border: 1px solid var(--pms-border-strong); border-radius: 50%; }
.solution-design-review-row__marker > span { width: 6px; height: 6px; background: currentColor; border-radius: 50%; }
.solution-design-review-row__marker.is-passed { color: var(--pms-success); border-color: #9ad8b4; background: var(--pms-success-soft); }
.solution-design-review-row__copy { display: grid; flex: 1; gap: 3px; min-width: 0; }
.solution-design-review-row__copy strong { color: var(--pms-text); font-size: 13px; }
.solution-design-review-row__copy small { color: var(--pms-text-faint); font-size: 11px; }
.solution-design-review-row__done { color: var(--pms-success); font-size: 12px; }
.solution-design-review-row__action { flex: 0 0 auto; min-height: 30px; padding-inline: 10px; }
.solution-design-decision { position: relative; }
.solution-design-decision-date span { display: inline-flex; align-items: center; min-height: 32px; color: var(--pms-text-muted); font-size: 12px; }
.solution-design-decision__actions { display: flex; justify-content: flex-end; margin-top: 14px; }
.solution-design-checklist { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; }
.solution-design-checklist__title { flex: 0 0 auto; color: var(--pms-text); font-size: 12px; font-weight: 700; }
.solution-design-checklist__items { display: flex; flex: 1; flex-wrap: wrap; gap: 7px 14px; color: var(--pms-text-faint); font-size: 11px; }
.solution-design-checklist__items span { display: inline-flex; align-items: center; gap: 4px; }
.solution-design-checklist__items .is-checked { color: var(--pms-success); }
.solution-design-checklist small { flex: 0 0 auto; color: var(--pms-text-faint); font-size: 11px; }
.solution-design-checklist small.is-confirmed { color: var(--pms-success); }
@media (max-width: 720px) {
  .solution-design-workbench__header, .solution-design-block__heading, .solution-design-checklist { align-items: stretch; flex-direction: column; }
  .solution-design-workbench__actions { justify-content: flex-start; }
  .solution-design-workbench__actions .ant-btn { flex: 1; }
  .solution-design-package-grid, .solution-design-form-grid, .solution-design-decision-grid { grid-template-columns: 1fr; }
  .solution-design-field--wide { grid-column: auto; }
  .solution-design-package-meta { grid-template-columns: 1fr; }
  .solution-design-review-row { align-items: flex-start; }
  .solution-design-review-row__action { align-self: center; }
  .solution-design-upstream { align-items: flex-start; flex-direction: column; }
  .solution-design-upstream__readonly { align-self: flex-start; }
}
</style>
