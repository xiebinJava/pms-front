<script setup lang="ts">
import { computed, reactive, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { normalizeTopicTesting, mergeTopicTesting, summarizeStoryTesting } from './topic-testing-results.mjs'

const props = defineProps<{ modelValue?: Record<string, unknown>; disabled?: boolean; preview?: boolean; stories?: Array<{ testStatus?: string | null }> }>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>]; commit: [] }>()
const { t } = useI18n()
const state = reactive(normalizeTopicTesting(props.modelValue))
const testingStatusId = useId()
const readOnly = computed(() => props.disabled || props.preview)
const hasStories = computed(() => Array.isArray(props.stories))
const storySummary = computed(() => summarizeStoryTesting(props.stories))
const statusOptions = computed(() => ['NOT_STARTED', 'IN_PROGRESS', 'PASSED', 'FAILED'].map(value => ({
  value, label: t(`developmentDetail.topicTesting.statuses.${value}`),
})))
watch(() => props.modelValue, values => Object.assign(state, normalizeTopicTesting(values)), { deep: true })
function update() { emit('update:modelValue', mergeTopicTesting(props.modelValue, state)) }
function commit() { update(); emit('commit') }
function addIssue() {
  if (readOnly.value || state.residualIssues.length >= 100) return
  state.residualIssues.push({ id: crypto.randomUUID(), description: '' })
  commit()
}
function removeIssue(id: string) {
  if (readOnly.value) return
  state.residualIssues = state.residualIssues.filter(issue => issue.id !== id)
  commit()
}
</script>

<template>
  <section class="topic-testing-results pms-runtime-component" :aria-label="t('developmentDetail.topicTesting.title')">
    <div class="topic-testing-results__heading">
      <h3>{{ t('developmentDetail.topicTesting.title') }}</h3>
      <span>{{ t('developmentDetail.topicTesting.manualCompletion') }}</span>
    </div>
    <div class="topic-testing-results__card">
      <div class="topic-testing-results__grid">
        <label class="topic-testing-results__field">
          <span>{{ t('developmentDetail.topicTesting.buildVersion') }}</span>
          <a-input v-model:value="state.buildVersion" :aria-label="t('developmentDetail.topicTesting.buildVersion')" :disabled="readOnly" :maxlength="200"
            :placeholder="t('developmentDetail.topicTesting.buildPlaceholder')" @change="update" @blur="commit" />
        </label>
        <div class="topic-testing-results__field">
          <label :for="testingStatusId">{{ t('developmentDetail.topicTesting.status') }}</label>
          <a-select :id="testingStatusId" v-model:value="state.testStatus" :disabled="readOnly" :options="statusOptions" @change="commit" />
        </div>
      </div>
      <label class="topic-testing-results__field">
        <span>{{ t('developmentDetail.topicTesting.reportUrl') }} <small>{{ t('developmentDetail.topicTesting.optional') }}</small></span>
        <a-input v-model:value="state.reportUrl" :aria-label="t('developmentDetail.topicTesting.reportUrl')" :disabled="readOnly" :maxlength="4000"
          :placeholder="t('developmentDetail.topicTesting.reportPlaceholder')" @change="update" @blur="commit" />
      </label>
    </div>
    <div class="topic-testing-results__card">
      <div class="topic-testing-results__heading">
        <h4>{{ t('developmentDetail.topicTesting.issues') }}（{{ state.residualIssues.length }}）</h4>
        <a-button v-if="!readOnly" size="small" :disabled="state.residualIssues.length >= 100" @click="addIssue"><PlusOutlined />{{ t('developmentDetail.topicTesting.addIssue') }}</a-button>
      </div>
      <p v-if="!state.residualIssues.length" class="topic-testing-results__empty">{{ t('developmentDetail.topicTesting.noIssues') }}</p>
      <div v-for="(issue, index) in state.residualIssues" :key="issue.id" class="topic-testing-results__issue">
        <span class="topic-testing-results__number">{{ index + 1 }}</span>
        <a-textarea v-model:value="issue.description" :aria-label="t('developmentDetail.topicTesting.issueLabel', { index: index + 1 })"
          :disabled="readOnly" :maxlength="2000" :auto-size="{ minRows: 1, maxRows: 5 }" :placeholder="t('developmentDetail.topicTesting.issuePlaceholder')" @change="update" @blur="commit" />
        <a-button v-if="!readOnly" :aria-label="t('developmentDetail.topicTesting.deleteIssue', { index: index + 1 })" @click="removeIssue(issue.id)"><DeleteOutlined /></a-button>
      </div>
    </div>
    <div v-if="hasStories" class="topic-testing-results__card">
      <div class="topic-testing-results__heading">
        <h4>{{ t('developmentDetail.topicTesting.storySummary') }}（{{ storySummary.total }}）</h4>
      </div>
      <div class="topic-testing-results__grid">
        <div class="topic-testing-results__field"><span>{{ t('developmentDetail.topicTesting.statuses.PASSED') }}</span><strong>{{ storySummary.passed }}</strong></div>
        <div class="topic-testing-results__field"><span>{{ t('developmentDetail.topicTesting.statuses.FAILED') }}</span><strong>{{ storySummary.failed }}</strong></div>
        <div class="topic-testing-results__field"><span>{{ t('developmentDetail.topicTesting.statuses.IN_PROGRESS') }}</span><strong>{{ storySummary.testing }}</strong></div>
        <div class="topic-testing-results__field"><span>{{ t('developmentDetail.topicTesting.statuses.NOT_STARTED') }}</span><strong>{{ storySummary.notStarted }}</strong></div>
        <div class="topic-testing-results__field"><span>{{ t('developmentDetail.topicTesting.storySummaryUnknown') }}</span><strong>{{ storySummary.unknown }}</strong></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.topic-testing-results { display: grid; gap: 12px; min-width: 0; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--pms-detail-border); }
.topic-testing-results__card { display: grid; gap: 16px; min-width: 0; padding: 16px; background: var(--pms-detail-surface-muted); border: 1px solid var(--pms-detail-border); border-radius: 8px; }
.topic-testing-results__heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; }
.topic-testing-results__heading h3, .topic-testing-results__heading h4 { margin: 0; color: var(--pms-text); font-size: 14px; font-weight: 600; }
.topic-testing-results__heading > span, .topic-testing-results__empty, .topic-testing-results__field small { color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.topic-testing-results__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.topic-testing-results__field { display: grid; gap: 8px; min-width: 0; color: var(--pms-text); font-size: 13px; }
.topic-testing-results__issue { display: grid; grid-template-columns: 24px minmax(0, 1fr) 34px; align-items: start; gap: 8px; min-width: 0; }
.topic-testing-results__number { display: grid; place-items: center; width: 24px; height: 24px; margin-top: 4px; color: var(--pms-primary); background: var(--pms-primary-soft, #eaf2ff); border-radius: 50%; font-size: 12px; }
.topic-testing-results__empty { margin: 0; }
@media (max-width: 600px) { .topic-testing-results__grid { grid-template-columns: minmax(0, 1fr); } .topic-testing-results__card { padding: 12px; } }
</style>
