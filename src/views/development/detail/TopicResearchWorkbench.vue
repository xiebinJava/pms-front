<script setup lang="ts">
import { reactive, watch } from 'vue'

const props = defineProps<{ modelValue?: Record<string, unknown>; disabled?: boolean; preview?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>]; commit: [] }>()
const state = reactive({ needed: undefined as 'YES' | 'NO' | undefined, goal: '', reportUrl: '', skipReason: '' })
watch(() => props.modelValue, (values) => {
  const components = values?.__components as Record<string, unknown> | undefined
  const value = components?.['topic-research'] as Record<string, unknown> | undefined
  state.needed = value?.needed === 'YES' || value?.needed === 'NO' ? value.needed : undefined
  for (const key of ['goal', 'reportUrl', 'skipReason'] as const) state[key] = typeof value?.[key] === 'string' ? value[key] as string : ''
}, { immediate: true, deep: true })
function update() {
  const values = props.modelValue || {}
  const components = values.__components as Record<string, unknown> || {}
  const existing = components['topic-research'] as Record<string, unknown> || {}
  emit('update:modelValue', { ...values, __components: { ...components, 'topic-research': { ...existing, ...state } } })
}
function commit() { update(); emit('commit') }
</script>

<template>
  <section class="topic-research pms-runtime-component">
    <div class="topic-research__card">
      <div class="topic-research__field">
        <span>是否需要调研 <span class="topic-research__required">*</span></span>
        <a-radio-group v-model:value="state.needed" aria-label="是否需要调研" :disabled="disabled || preview" @change="commit">
          <a-radio value="YES">是</a-radio><a-radio value="NO">否</a-radio>
        </a-radio-group>
      </div>
      <label v-if="state.needed === 'NO'" class="topic-research__field">
        <span>无需调研原因 <span class="topic-research__required">*</span></span>
        <a-textarea v-model:value="state.skipReason" :disabled="disabled" :rows="3" :maxlength="10000" placeholder="说明为什么无需开展竞品调研，例如已有报告或本次不涉及竞品对比" @change="update" @blur="commit" />
      </label>
      <template v-if="state.needed === 'YES' || preview">
        <label class="topic-research__field">
          <span>调研目标 <span class="topic-research__required">*</span></span>
          <a-textarea v-model:value="state.goal" :disabled="disabled || preview" :rows="3" :maxlength="10000" placeholder="说明调研目标、竞品范围，以及功能、视觉交互或技术等重点方向" @change="update" @blur="commit" />
        </label>
      </template>
    </div>
    <div v-if="state.needed === 'YES' || preview" class="topic-research__card">
      <label class="topic-research__field topic-research__field--link">
        <span>竞品调研报告 <span class="topic-research__required">*</span></span>
        <a-input v-model:value="state.reportUrl" :disabled="disabled || preview" :maxlength="4000" placeholder="请输入竞品调研报告的文档链接" @change="update" @blur="commit" />
      </label>
    </div>
  </section>
</template>

<style scoped>
.topic-research{display:grid;gap:16px;color:var(--pms-text-primary,#24334d)}
.topic-research__card{display:grid;gap:16px;padding:16px;background:var(--pms-bg-subtle,#f7f9fc);border:1px solid var(--pms-border-color,#dfe6f0);border-radius:6px;min-width:0}
.topic-research__field{display:grid;gap:8px;min-width:0;font-size:13px}
.topic-research__required{color:#f5222d}
.topic-research__field--link{grid-template-columns:120px minmax(0,1fr);align-items:center}
@media(max-width:600px){.topic-research__field--link{grid-template-columns:1fr}}
</style>
