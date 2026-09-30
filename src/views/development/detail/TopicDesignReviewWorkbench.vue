<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import PersonSelect from '/@/views/project/detail/components/PersonSelect.vue'
import type { PersonOption } from '/@/views/project/detail/workflow'

const props = defineProps<{ modelValue?: Record<string, unknown>; disabled?: boolean; preview?: boolean; personOptions?: PersonOption[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>]; commit: [] }>()
const state = reactive({ productPlanUrl: '', uiPlanUrl: '', technicalPlanUrl: '', productReviewerIds: [] as number[],
  designReviewerIds: [] as number[], technicalReviewerIds: [] as number[], productReviewSuggestion: '',
  designReviewSuggestion: '', technicalReviewSuggestion: '', productReviewStatus: 'PENDING', designReviewStatus: 'PENDING', technicalReviewStatus: 'PENDING' })
const reviews = [{ label: '产品评审', plan: 'productPlanUrl', planLabel: '产品详细方案', people: 'productReviewerIds', suggestion: 'productReviewSuggestion', status: 'productReviewStatus', required: true },
  { label: '设计评审', plan: 'uiPlanUrl', planLabel: 'UI 设计方案', people: 'designReviewerIds', suggestion: 'designReviewSuggestion', status: 'designReviewStatus', required: false },
  { label: '技术评审', plan: 'technicalPlanUrl', planLabel: '技术方案', people: 'technicalReviewerIds', suggestion: 'technicalReviewSuggestion', status: 'technicalReviewStatus', required: false }] as const
const passedCount = computed(() => reviews.filter(review => state[review.status] === 'PASSED').length)
const statusOptions = [{ value: 'PENDING', label: '待评审' }, { value: 'PASSED', label: '已通过' }, { value: 'REJECTED', label: '未通过' }]
watch(() => props.modelValue, values => {
  const components = values?.__components as Record<string, unknown> | undefined
  const value = components?.['topic-design-review'] as Record<string, unknown> | undefined
  for (const key of ['productPlanUrl', 'uiPlanUrl', 'technicalPlanUrl', 'productReviewSuggestion', 'designReviewSuggestion', 'technicalReviewSuggestion'] as const)
    state[key] = typeof value?.[key] === 'string' ? value[key] as string : ''
  for (const key of ['productReviewerIds', 'designReviewerIds', 'technicalReviewerIds'] as const)
    state[key] = Array.isArray(value?.[key]) ? (value[key] as unknown[]).filter((id): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0) : []
  for (const review of reviews) state[review.status] = value?.[review.status] === 'PASSED' || value?.[review.status] === 'REJECTED' ? value[review.status] as string : 'PENDING'
}, { immediate: true, deep: true })
function update() {
  const values = props.modelValue || {}
  const components = values.__components as Record<string, unknown> || {}
  const existing = components['topic-design-review'] as Record<string, unknown> || {}
  emit('update:modelValue', { ...values, __components: { ...components, 'topic-design-review': { ...existing, ...state } } })
}
function commit() { update(); emit('commit') }
function setPeople(key: 'productReviewerIds' | 'designReviewerIds' | 'technicalReviewerIds', value: number | number[] | undefined) {
  state[key] = Array.isArray(value) ? value : []; commit()
}
</script>

<template>
  <section class="topic-design-review pms-runtime-component">
    <section class="topic-design-review__card">
      <div class="topic-design-review__heading"><h3>方案评审</h3><span class="topic-design-review__optional">{{ passedCount }} / 3 已通过</span></div>
      <section v-for="review in reviews" :key="review.people" class="topic-design-review__review">
        <div class="topic-design-review__review-copy">
          <span class="topic-design-review__marker" :class="{ 'is-passed': state[review.status] === 'PASSED', 'is-rejected': state[review.status] === 'REJECTED' }">●</span>
          <h4>{{ review.label }}<span v-if="!review.required" class="topic-design-review__optional">（选填）</span><span v-else class="topic-design-review__required"> *</span></h4>
        </div>
        <a-input v-model:value="state[review.plan]" class="topic-design-review__plan" :disabled="disabled || preview" :maxlength="4000"
          :aria-label="`${review.planLabel}${review.required ? '（必填）' : '（选填）'}`" :placeholder="`请输入${review.planLabel}的文档链接`" @change="update" @blur="commit" />
        <a-input v-model:value="state[review.suggestion]" class="topic-design-review__suggestion" :disabled="disabled || preview" :maxlength="10000"
          :aria-label="`${review.label}建议`" :placeholder="`${review.label}建议（选填）`" @change="update" @blur="commit" />
          <PersonSelect :model-value="state[review.people]" :options="personOptions" multiple allow-clear
            class="topic-design-review__reviewer" :aria-label="`${review.label}参与人`"
            :disabled="disabled || preview" :remote-search="!preview" placeholder="请选择评审参与人"
            @update:model-value="setPeople(review.people, $event)" />
        <a-select v-model:value="state[review.status]" class="topic-design-review__status" :aria-label="`${review.label}状态`" :bordered="false" :options="statusOptions" :disabled="disabled || preview" @change="commit" />
      </section>
    </section>
  </section>
</template>

<style scoped>
.topic-design-review{display:grid;gap:16px;color:var(--pms-text-primary,#24334d);min-width:0;container-type:inline-size}
.topic-design-review__card{display:grid;gap:16px;padding:16px;background:var(--pms-bg-subtle,#f7f9fc);border:1px solid var(--pms-border-color,#dfe6f0);border-radius:6px;min-width:0}
.topic-design-review h3,.topic-design-review h4{margin:0;font-size:14px;font-weight:600}
.topic-design-review h4{font-size:13px}
.topic-design-review__heading{display:flex;align-items:center;justify-content:space-between;gap:12px}
.topic-design-review__review{display:grid;grid-template-columns:140px minmax(180px,1.4fr) minmax(130px,1fr) minmax(150px,1fr) 88px;align-items:center;gap:10px;min-height:54px;padding:9px 11px;background:var(--pms-surface-muted,#f7f9fc);border:1px solid var(--pms-border,#dfe6f0);border-radius:7px;min-width:0}
.topic-design-review__review-copy{display:flex;align-items:center;gap:7px;min-width:0}
.topic-design-review__marker{display:grid;place-items:center;width:20px;height:20px;flex:0 0 20px;border:1px solid var(--pms-border-strong,#cbd5e1);border-radius:50%;font-size:10px;color:var(--pms-text-faint,#94a3b8)}
.topic-design-review__marker.is-passed{color:var(--pms-success,#18a66a);background:var(--pms-success-soft,#ebf8f0);border-color:#9ad8b4}
.topic-design-review__marker.is-rejected{color:var(--pms-color-danger,#f5222d)}
.topic-design-review__status{width:88px;font-size:12px;justify-self:end}
.topic-design-review__plan,.topic-design-review__suggestion,.topic-design-review__reviewer{width:100%;min-width:0}
.topic-design-review__required{color:var(--pms-color-danger,#f5222d)}
.topic-design-review__optional{color:var(--pms-text-secondary,#8492a6);font-size:12px;font-weight:400}
@container(max-width:780px){.topic-design-review__review{grid-template-columns:minmax(0,1fr) 88px}.topic-design-review__review-copy,.topic-design-review__plan,.topic-design-review__suggestion{grid-column:1/-1}}
@container(max-width:400px){.topic-design-review__review{grid-template-columns:minmax(0,1fr)}.topic-design-review__reviewer,.topic-design-review__status{grid-column:1}}
</style>
