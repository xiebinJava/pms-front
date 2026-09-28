<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WorkflowFieldDefinition } from '/@/types/workflow'
import { isWorkflowFieldFullWidth } from '/@/utils/workflow-field-layout.mjs'
import BusinessLineSelect from '/@/views/project/detail/components/BusinessLineSelect.vue'
import PersonSelect from '/@/views/project/detail/components/PersonSelect.vue'
import type { BusinessLineOption, PersonOption } from '/@/views/project/detail/workflow'

const props = defineProps<{
  fields: WorkflowFieldDefinition[]
  boundValues: Record<string, unknown>
  modelValue: Record<string, unknown>
  personOptions: PersonOption[]
  businessLineOptions: BusinessLineOption[]
  disabled: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>()
const { t } = useI18n()
const visibleFields = computed(() => props.fields.filter((field) => field.visible !== false))

function fieldValue(field: WorkflowFieldDefinition) {
  if (field.binding && Object.prototype.hasOwnProperty.call(props.modelValue, field.key)) {
    return props.modelValue[field.key]
  }
  return field.binding ? props.boundValues[field.key] : props.modelValue[field.key]
}

function fieldDisabled(_field: WorkflowFieldDefinition) {
  return props.disabled
}

function fieldOptions(field: WorkflowFieldDefinition) {
  if (field.binding === 'requirement.priority') {
    return [
      { label: t('developmentList.requirementPriorityLowest'), value: 0 },
      { label: t('developmentList.requirementPriorityLow'), value: 1 },
      { label: t('developmentList.requirementPriorityMedium'), value: 2 },
      { label: t('developmentList.requirementPriorityHigh'), value: 3 },
    ]
  }
  return field.options.map((label) => ({ label, value: label }))
}

function findBusinessLinePath(options: BusinessLineOption[], targetId: number, parentPath: number[] = []): number[] {
  for (const option of options) {
    const path = [...parentPath, option.value]
    if (option.value === targetId) return path
    const childPath = findBusinessLinePath(option.children || [], targetId, path)
    if (childPath.length) return childPath
  }
  return []
}

function businessLinePath(field: WorkflowFieldDefinition) {
  const value = fieldValue(field)
  const id = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(id) && id > 0 ? findBusinessLinePath(props.businessLineOptions, id) : []
}

function setValue(key: string, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

function setTextValue(key: string, event: Event) {
  setValue(key, (event.target as HTMLInputElement).value)
}

function setTextareaValue(key: string, event: Event) {
  setValue(key, (event.target as HTMLTextAreaElement).value)
}

function setRadioValue(key: string, event: { target?: { value?: unknown } }) {
  setValue(key, event.target?.value)
}

function setBusinessLineValue(key: string, value?: number[]) {
  const path = Array.isArray(value) ? value : []
  setValue(key, path.at(-1) ?? null)
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
          :value="fieldValue(field) as string"
          :disabled="fieldDisabled(field)"
          :maxlength="500"
          @change="setTextValue(field.key, $event)"
        />
        <a-textarea
          v-else-if="field.type === 'TEXTAREA'"
          :id="`development-item-field-${field.key}`"
          :value="fieldValue(field) as string"
          :disabled="fieldDisabled(field)"
          :rows="3"
          :maxlength="10000"
          @change="setTextareaValue(field.key, $event)"
        />
        <a-input-number
          v-else-if="field.type === 'NUMBER'"
          :id="`development-item-field-${field.key}`"
          :value="fieldValue(field) as number | undefined"
          :disabled="fieldDisabled(field)"
          class="development-item-fields__control"
          @change="setValue(field.key, $event ?? null)"
        />
        <a-date-picker
          v-else-if="field.type === 'DATE'"
          :id="`development-item-field-${field.key}`"
          :value="fieldValue(field) as string | undefined"
          value-format="YYYY-MM-DD"
          :disabled="fieldDisabled(field)"
          class="development-item-fields__control"
          @change="setValue(field.key, $event ?? null)"
        />
        <a-radio-group
          v-else-if="field.type === 'RADIO'"
          :id="`development-item-field-${field.key}`"
          :value="fieldValue(field)"
          :disabled="fieldDisabled(field)"
          :options="field.options.map((label) => ({ label, value: label }))"
          @change="setRadioValue(field.key, $event)"
        />
        <BusinessLineSelect
          v-else-if="field.binding === 'requirement.businessLine'"
          :model-value="businessLinePath(field)"
          :options="businessLineOptions"
          :disabled="fieldDisabled(field)"
          :placeholder="t('detail.selectBusinessLine')"
          @update:model-value="setBusinessLineValue(field.key, $event)"
        />
        <a-select
          v-else-if="field.type === 'SINGLE_SELECT'"
          :id="`development-item-field-${field.key}`"
          :value="fieldValue(field)"
          :disabled="fieldDisabled(field)"
          :options="fieldOptions(field)"
          allow-clear
          @change="setValue(field.key, $event ?? null)"
        />
        <a-select
          v-else-if="field.type === 'MULTI_SELECT'"
          :id="`development-item-field-${field.key}`"
          :value="fieldValue(field)"
          :disabled="fieldDisabled(field)"
          :options="field.options.map((label) => ({ label, value: label }))"
          mode="multiple"
          @change="setValue(field.key, $event ?? null)"
        />
        <PersonSelect
          v-else-if="field.type === 'PERSON'"
          :model-value="fieldValue(field) as number | null | undefined"
          :disabled="fieldDisabled(field)"
          :options="personOptions"
          :remote-search="true"
          allow-clear
          :placeholder="t('detail.selectPerson')"
          @update:model-value="setValue(field.key, $event)"
        />
        <PersonSelect
          v-else-if="field.type === 'PERSON_MULTI'"
          :model-value="fieldValue(field) as number[]"
          :disabled="fieldDisabled(field)"
          :options="personOptions"
          :remote-search="true"
          multiple
          :placeholder="t('detail.selectPerson')"
          @update:model-value="setValue(field.key, $event)"
        />
        <a-range-picker
          v-else-if="field.type === 'DATE_RANGE'"
          :id="`development-item-field-${field.key}`"
          :value="fieldValue(field) as [string, string] | undefined"
          value-format="YYYY-MM-DD"
          :disabled="fieldDisabled(field)"
          class="development-item-fields__control"
          @change="setValue(field.key, $event ?? null)"
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
