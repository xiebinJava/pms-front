<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  createStoryNodeWorkbenchConfig,
  getStoryWorkbenchVariant,
  normalizeStoryWorkbenchState,
  mergeStoryWorkbenchState,
  STORY_WORKBENCH_FIELDS,
  type StoryWorkbenchVariant,
} from '/@/components/workflow/story-node-workbench.mjs'

interface StoryNode { key?: string; name?: string }
interface StoryWorkbenchConfig { variant?: StoryWorkbenchVariant; purpose?: string; activities?: string[] }

const props = defineProps<{
  node?: StoryNode
  componentConfig?: unknown
  modelValue?: Record<string, unknown>
  disabled?: boolean
  preview?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>]; commit: [] }>()
const { t } = useI18n()

const persisted = computed<StoryWorkbenchConfig>(() => props.componentConfig && typeof props.componentConfig === 'object'
  ? props.componentConfig as StoryWorkbenchConfig : {})
const variant = computed<StoryWorkbenchVariant>(() => persisted.value.variant || getStoryWorkbenchVariant(props.node) || 'writing')
const blueprint = computed(() => createStoryNodeWorkbenchConfig(props.node))
const purpose = computed(() => persisted.value.purpose || blueprint.value?.purpose || '')
const activities = computed<string[]>(() => Array.isArray(persisted.value.activities)
  ? persisted.value.activities
  : (blueprint.value?.activities || []))
const fields = computed(() => STORY_WORKBENCH_FIELDS[variant.value] || [])
const readOnly = computed(() => props.disabled || props.preview)
const state = reactive<Record<string, string>>(normalizeStoryWorkbenchState(props.modelValue, variant.value))
watch(() => props.modelValue, values => Object.assign(state, normalizeStoryWorkbenchState(values, variant.value)), { deep: true })
function update() { emit('update:modelValue', mergeStoryWorkbenchState(props.modelValue, variant.value, state)) }
function commit() { update(); emit('commit') }
</script>

<template>
  <section class="story-node-workbench pms-runtime-component" :aria-label="t('developmentDetail.storyWorkbench.title')" :data-variant="variant">
    <div class="story-node-workbench__heading">
      <h3>{{ t('developmentDetail.storyWorkbench.title') }}</h3>
      <p>{{ purpose }}</p>
    </div>
    <ul v-if="activities.length" class="story-node-workbench__activities">
      <li v-for="activity in activities" :key="activity">{{ activity }}</li>
    </ul>
    <div class="story-node-workbench__fields">
      <label v-for="field in fields" :key="field.key" class="story-node-workbench__field">
        <span>{{ t(`developmentDetail.storyWorkbench.fields.${field.key}`) }}</span>
        <a-textarea v-if="field.type === 'textarea'" v-model:value="state[field.key]" :aria-label="t(`developmentDetail.storyWorkbench.fields.${field.key}`)"
          :disabled="readOnly" :maxlength="2000" :auto-size="{ minRows: 2, maxRows: 6 }"
          :placeholder="t(`developmentDetail.storyWorkbench.placeholders.${field.key}`)" @change="update" @blur="commit" />
        <a-date-picker v-else-if="field.type === 'date'" v-model:value="state[field.key]" value-format="YYYY-MM-DD"
          :aria-label="t(`developmentDetail.storyWorkbench.fields.${field.key}`)" :disabled="readOnly"
          :placeholder="t(`developmentDetail.storyWorkbench.placeholders.${field.key}`)" @change="commit" />
        <a-input v-else v-model:value="state[field.key]" :aria-label="t(`developmentDetail.storyWorkbench.fields.${field.key}`)"
          :disabled="readOnly" :maxlength="200" :placeholder="t(`developmentDetail.storyWorkbench.placeholders.${field.key}`)"
          @change="update" @blur="commit" />
      </label>
    </div>
  </section>
</template>

<style scoped>
.story-node-workbench { display: grid; gap: 12px; min-width: 0; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--pms-detail-border); }
.story-node-workbench__heading h3 { margin: 0; color: var(--pms-text); font-size: 14px; font-weight: 600; }
.story-node-workbench__heading p { margin: 4px 0 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.story-node-workbench__activities { display: grid; gap: 4px; margin: 0; padding: 12px 16px; list-style: none; background: var(--pms-detail-surface-muted); border: 1px solid var(--pms-detail-border); border-radius: 8px; }
.story-node-workbench__activities li { position: relative; padding-left: 16px; color: var(--pms-text); font-size: 13px; }
.story-node-workbench__activities li::before { position: absolute; left: 0; color: var(--pms-primary); content: '•'; }
.story-node-workbench__fields { display: grid; gap: 16px; min-width: 0; }
.story-node-workbench__field { display: grid; gap: 8px; min-width: 0; color: var(--pms-text); font-size: 13px; }
@media (max-width: 600px) { .story-node-workbench__activities { padding: 12px; } }
</style>
