<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { normalizeStoryTesting, mergeStoryTesting, DEFECT_TYPES, DEFECT_LEVELS } from './story-testing-results.mjs'

const props = defineProps<{ modelValue?: Record<string, unknown>; disabled?: boolean; preview?: boolean; story?: { workbenchPeople?: Record<string, string> } }>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>]; commit: [] }>()
const { t } = useI18n()
const state = reactive(normalizeStoryTesting(props.modelValue))
const readOnly = computed(() => props.disabled || props.preview)
const ownerOptions = computed(() => Object.entries(props.story?.workbenchPeople || {}).map(([id, label]) => ({ value: Number(id), label })))
const ownerSelectMode = computed(() => ownerOptions.value.length > 0)
watch(() => props.modelValue, values => Object.assign(state, normalizeStoryTesting(values)), { deep: true })
function update() { emit('update:modelValue', mergeStoryTesting(props.modelValue, state)) }
function commit() { update(); emit('commit') }
function addIssue() {
  if (readOnly.value || state.residualIssues.length >= 100) return
  state.residualIssues.push({ id: crypto.randomUUID(), name: '', type: 'RND', level: 'MEDIUM', description: '', expectedResult: '', owner: null })
  commit()
}
function removeIssue(id: string) {
  if (readOnly.value) return
  state.residualIssues = state.residualIssues.filter(issue => issue.id !== id)
  commit()
}
const defectTypeOptions = computed(() => DEFECT_TYPES.map(value => ({ value, label: t(`developmentDetail.storyTesting.defect.types.${value}`) })))
const defectLevelOptions = computed(() => DEFECT_LEVELS.map(value => ({ value, label: t(`developmentDetail.storyTesting.defect.levels.${value}`) })))
</script>

<template>
  <section class="topic-testing-results pms-runtime-component" :aria-label="t('developmentDetail.storyTesting.title')">
    <div class="topic-testing-results__heading">
      <h3>{{ t('developmentDetail.storyTesting.title') }}</h3>
      <span>{{ t('developmentDetail.storyTesting.manualCompletion') }}</span>
    </div>
    <div class="topic-testing-results__card">
      <label class="topic-testing-results__field">
        <span>{{ t('developmentDetail.storyTesting.reportUrl') }} <small>{{ t('developmentDetail.storyTesting.optional') }}</small></span>
        <a-input v-model:value="state.reportUrl" :aria-label="t('developmentDetail.storyTesting.reportUrl')" :disabled="readOnly" :maxlength="4000"
          :placeholder="t('developmentDetail.storyTesting.reportPlaceholder')" @change="update" @blur="commit" />
      </label>
    </div>
    <div class="topic-testing-results__card">
      <div class="topic-testing-results__heading">
        <h4>{{ t('developmentDetail.storyTesting.issues') }}（{{ state.residualIssues.length }}）</h4>
        <a-button v-if="!readOnly" size="small" :disabled="state.residualIssues.length >= 100" @click="addIssue"><PlusOutlined />{{ t('developmentDetail.storyTesting.addIssue') }}</a-button>
      </div>
      <p v-if="!state.residualIssues.length" class="topic-testing-results__empty">{{ t('developmentDetail.storyTesting.noIssues') }}</p>
      <div v-else class="topic-testing-results__defect-table">
        <div class="topic-testing-results__defect-head">
          <span></span>
          <span>{{ t('developmentDetail.storyTesting.defect.name') }}</span>
          <span>{{ t('developmentDetail.storyTesting.defect.type') }}</span>
          <span>{{ t('developmentDetail.storyTesting.defect.level') }}</span>
          <span>{{ t('developmentDetail.storyTesting.defect.description') }}</span>
          <span>{{ t('developmentDetail.storyTesting.defect.expected') }}</span>
          <span>{{ t('developmentDetail.storyTesting.defect.owner') }}</span>
          <span></span>
        </div>
        <div v-for="(issue, index) in state.residualIssues" :key="issue.id" class="topic-testing-results__defect-row">
          <span class="topic-testing-results__defect-index">{{ index + 1 }}</span>
          <a-input v-model:value="issue.name" :maxlength="200" :disabled="readOnly" :aria-label="t('developmentDetail.storyTesting.issueLabel', { index: index + 1 })" @change="update" @blur="commit" />
          <a-select v-model:value="issue.type" :disabled="readOnly" :options="defectTypeOptions" :aria-label="t('developmentDetail.storyTesting.defect.type')" @change="commit" />
          <a-select v-model:value="issue.level" :disabled="readOnly" :options="defectLevelOptions" :aria-label="t('developmentDetail.storyTesting.defect.level')" @change="commit" />
          <a-textarea v-model:value="issue.description" :aria-label="t('developmentDetail.storyTesting.issueLabel', { index: index + 1 })"
            :disabled="readOnly" :maxlength="2000" :auto-size="{ minRows: 1, maxRows: 5 }" :placeholder="t('developmentDetail.storyTesting.issuePlaceholder')" @change="update" @blur="commit" />
          <a-textarea v-model:value="issue.expectedResult" :disabled="readOnly" :maxlength="2000" :auto-size="{ minRows: 1, maxRows: 5 }"
            :aria-label="t('developmentDetail.storyTesting.defect.expected')" @change="update" @blur="commit" />
          <a-select v-if="ownerSelectMode" v-model:value="issue.owner" :disabled="readOnly" :options="ownerOptions" allow-clear
            :aria-label="t('developmentDetail.storyTesting.defect.owner')" @change="commit" />
          <a-input v-else v-model:value="issue.owner" :disabled="readOnly" :maxlength="100"
            :aria-label="t('developmentDetail.storyTesting.defect.owner')" @change="update" @blur="commit" />
          <a-button type="text" danger :disabled="readOnly" :aria-label="t('developmentDetail.storyTesting.deleteIssue', { index: index + 1 })" @click="removeIssue(issue.id)"><DeleteOutlined /></a-button>
        </div>
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
.topic-testing-results__defect-table { overflow-x: auto; background: var(--pms-surface, #fff); border: 1px solid var(--pms-detail-border); border-radius: 6px; }
.topic-testing-results__defect-head, .topic-testing-results__defect-row { display: grid; grid-template-columns: 36px minmax(150px, 1fr) 118px 96px minmax(210px, 1.25fr) minmax(180px, 1fr) minmax(120px, .9fr) 40px; align-items: center; column-gap: 10px; }
.topic-testing-results__defect-head { padding: 10px 12px; color: var(--pms-text-muted); background: var(--pms-detail-soft-bg, #f8fafc); border-bottom: 1px solid var(--pms-detail-border); font-size: 11px; font-weight: 650; }
.topic-testing-results__defect-row { padding: 8px 12px; border-bottom: 1px solid var(--pms-detail-border); }
.topic-testing-results__defect-row:last-child { border-bottom: 0; }
.topic-testing-results__defect-index { color: var(--pms-text-muted); font-size: 12px; font-weight: 650; }
.topic-testing-results__defect-row :deep(.ant-select) { width: 100%; }
.topic-testing-results__defect-row :deep(.ant-btn) { padding-inline: 4px; }
.topic-testing-results__empty { margin: 0; }
@media (max-width: 600px) { .topic-testing-results__grid { grid-template-columns: minmax(0, 1fr); } .topic-testing-results__card { padding: 12px; } }
</style>
