<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WorkflowFieldDefinition } from '/@/types/workflow'
import { isWorkflowFieldFullWidth } from '/@/utils/workflow-field-layout.mjs'
import type { PersonOption } from '/@/views/project/detail/workflow'

const props = defineProps<{
  fields: WorkflowFieldDefinition[]
  modelValue: Record<string, unknown>
  personOptions: PersonOption[]
  disabled: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>()
const { t } = useI18n()
const visibleFields = computed(() => props.fields.filter((field) => field.visible !== false && !field.binding))

function setValue(key: string, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

function setTextValue(key: string, event: Event) {
  setValue(key, (event.target as HTMLInputElement).value)
}

function setTextareaValue(key: string, event: Event) {
  setValue(key, (event.target as HTMLTextAreaElement).value)
}

function setDateValue(key: string, _date: unknown, value: string) {
  setValue(key, value || null)
}

function setRangeValue(key: string, _dates: unknown, values: string[]) {
  setValue(key, values)
}

function valueChangeHandler(key: string) {
  return (value: unknown) => setValue(key, value ?? null)
}

function dateChangeHandler(key: string) {
  return (_date: unknown, value: string) => setDateValue(key, _date, value)
}

function rangeChangeHandler(key: string) {
  return (_dates: unknown, values: string[]) => setRangeValue(key, _dates, values)
}

function setRadioValue(key: string, event: { target?: { value?: unknown } }) {
  setValue(key, event.target?.value)
}
</script>

<template>
  <section v-if="visibleFields.length" class="development-item-fields pms-workflow-fields node-tab-profile">
    <div class="development-item-fields__grid">
      <div
        v-for="field in visibleFields"
        :key="field.key"
        class="development-item-fields__field"
        :class="{ 'development-item-fields__field--wide': isWorkflowFieldFullWidth(field) }"
      >
        <label :for="`development-item-field-${field.key}`">
          {{ field.label }}<span v-if="field.required" class="development-item-fields__required">*</span>
        </label>
        <a-input
          v-if="field.type === 'TEXT'"
          :id="`development-item-field-${field.key}`"
          :value="modelValue[field.key] as string"
          :disabled="disabled"
          :maxlength="500"
          @change="setTextValue(field.key, $event)"
        />
        <a-textarea
          v-else-if="field.type === 'TEXTAREA'"
          :id="`development-item-field-${field.key}`"
          :value="modelValue[field.key] as string"
          :disabled="disabled"
          :rows="3"
          :maxlength="10000"
          @change="setTextareaValue(field.key, $event)"
        />
        <a-input-number
          v-else-if="field.type === 'NUMBER'"
          :id="`development-item-field-${field.key}`"
          :value="modelValue[field.key] as number | undefined"
          :disabled="disabled"
          class="development-item-fields__control"
          @change="valueChangeHandler(field.key)"
        />
        <a-date-picker
          v-else-if="field.type === 'DATE'"
          :id="`development-item-field-${field.key}`"
          :value="modelValue[field.key] as string | undefined"
          value-format="YYYY-MM-DD"
          :disabled="disabled"
          class="development-item-fields__control"
          @change="dateChangeHandler(field.key)"
        />
        <a-radio-group
          v-else-if="field.type === 'RADIO'"
          :id="`development-item-field-${field.key}`"
          :value="modelValue[field.key]"
          :disabled="disabled"
          :options="field.options.map((label) => ({ label, value: label }))"
          @change="setRadioValue(field.key, $event)"
        />
        <a-select
          v-else-if="field.type === 'SINGLE_SELECT'"
          :id="`development-item-field-${field.key}`"
          :value="modelValue[field.key]"
          :disabled="disabled"
          :options="field.options.map((label) => ({ label, value: label }))"
          allow-clear
          @change="valueChangeHandler(field.key)"
        />
        <a-select
          v-else-if="field.type === 'MULTI_SELECT'"
          :id="`development-item-field-${field.key}`"
          :value="modelValue[field.key]"
          :disabled="disabled"
          :options="field.options.map((label) => ({ label, value: label }))"
          mode="multiple"
          @change="valueChangeHandler(field.key)"
        />
        <a-select
          v-else-if="field.type === 'PERSON'"
          :id="`development-item-field-${field.key}`"
          :value="modelValue[field.key]"
          :disabled="disabled"
          :options="personOptions"
          allow-clear
          show-search
          option-filter-prop="label"
          @change="valueChangeHandler(field.key)"
        />
        <a-select
          v-else-if="field.type === 'PERSON_MULTI'"
          :id="`development-item-field-${field.key}`"
          :value="modelValue[field.key]"
          :disabled="disabled"
          :options="personOptions"
          mode="multiple"
          show-search
          option-filter-prop="label"
          @change="valueChangeHandler(field.key)"
        />
        <a-range-picker
          v-else-if="field.type === 'DATE_RANGE'"
          :id="`development-item-field-${field.key}`"
          :value="modelValue[field.key] as [string, string] | undefined"
          value-format="YYYY-MM-DD"
          :disabled="disabled"
          class="development-item-fields__control"
          @change="rangeChangeHandler(field.key)"
        />
        <span v-else class="development-item-fields__unsupported">{{ t('developmentDetail.unsupportedFieldType') }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.development-item-fields { margin-top: 14px; padding: 16px 18px; background: var(--pms-detail-surface-muted); border: 1px solid var(--pms-detail-border); border-radius: 7px; }
.development-item-fields__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 36px; row-gap: 12px; }
.development-item-fields__field { display: grid; align-content: start; gap: 6px; min-width: 0; color: var(--pms-text); font-size: var(--pms-font-size-body); }
.development-item-fields__field--wide { grid-column: 1 / -1; }
.development-item-fields__field label { color: var(--pms-text-muted); font-weight: 680; }
.development-item-fields__required { padding-left: 3px; color: var(--pms-danger); }
.development-item-fields__control { width: 100%; }
.development-item-fields__unsupported { color: var(--pms-text-faint); }
@media (max-width: 640px) { .development-item-fields__grid { grid-template-columns: 1fr; } .development-item-fields__field--wide { grid-column: auto; } }
</style>
