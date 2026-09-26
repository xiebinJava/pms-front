<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import {
  createDevelopmentRequirement,
  getDevelopmentWorkflowTemplateOptions,
  updateDevelopmentRequirement,
  type DevelopmentRequirementRow,
} from '/@/api/development-item'
import type { WorkflowTemplateSummary } from '/@/types/workflow'
import PersonSelect from '/@/views/project/detail/components/PersonSelect.vue'

const props = defineProps<{ open: boolean; requirement: DevelopmentRequirementRow | null }>()
const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'saved'): void
}>()
const { t } = useI18n()

const form = reactive({
  title: '',
  description: '',
  priority: 2,
  ownerId: undefined as number | undefined,
  templateVersionId: null as number | null,
  version: 0,
})
const workflowTemplates = ref<WorkflowTemplateSummary[]>([])
const workflowTemplatesLoading = ref(false)
const saving = ref(false)

const workflowTemplateSelectOptions = computed(() => workflowTemplates.value
  .filter((template) => template.publishedVersionId != null)
  .map((template) => {
    const versionId = template.defaultTemplateVersionId ?? template.publishedVersionId
    const versionNo = template.publishedVersions?.find((version) => version.id === versionId)?.versionNo
      ?? template.publishedVersionNo
    return {
      value: versionId,
      label: `${template.name} · v${versionNo ?? '?'}${template.defaultTemplate ? ` · ${t('developmentList.workflowTemplateDefault')}` : ''}`,
    }
  }))

watch(() => [props.open, props.requirement?.id] as const, ([open]) => {
  if (!open) return
  const requirement = props.requirement
  form.title = requirement?.title || ''
  form.description = requirement?.description || ''
  form.priority = requirement?.priority ?? 2
  form.ownerId = requirement?.ownerId
  form.templateVersionId = null
  form.version = requirement?.version ?? 0
  if (!requirement) void loadWorkflowTemplates()
})

async function loadWorkflowTemplates() {
  workflowTemplatesLoading.value = true
  try {
    const result = await getDevelopmentWorkflowTemplateOptions()
    workflowTemplates.value = result.requirementTemplates || []
    form.templateVersionId = workflowTemplateSelectOptions.value.find((option) =>
      workflowTemplates.value.some((template) =>
        template.defaultTemplate && (template.defaultTemplateVersionId ?? template.publishedVersionId) === option.value),
    )?.value ?? workflowTemplateSelectOptions.value[0]?.value ?? null
  } catch (error) {
    message.error((error as Error).message || t('developmentList.workflowTemplateLoadFailed'))
  } finally {
    workflowTemplatesLoading.value = false
  }
}

function close() {
  if (saving.value) return
  emit('update:open', false)
}

async function save() {
  if (saving.value) return
  const requirement = props.requirement
  const title = form.title.trim()
  if (!title) {
    message.warning(t('developmentList.requirementTitleRequired'))
    return
  }

  saving.value = true
  try {
    if (requirement) {
      await updateDevelopmentRequirement(requirement.id, {
        title,
        description: form.description.trim() || undefined,
        priority: form.priority,
        ownerId: form.ownerId ?? null,
        version: form.version,
      })
    } else {
      await createDevelopmentRequirement({
        title,
        description: form.description.trim() || undefined,
        priority: form.priority,
        ownerId: form.ownerId ?? null,
        templateVersionId: form.templateVersionId,
      })
    }
    message.success(t(requirement ? 'developmentList.requirementUpdated' : 'developmentList.requirementCreated'))
    emit('update:open', false)
    emit('saved')
  } catch (error) {
    message.error((error as Error).message || t(requirement ? 'developmentList.requirementUpdateFailed' : 'developmentList.requirementCreateFailed'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <a-modal
    :open="open"
    class="pms-project-modal development-requirement-edit-modal"
    :title="t(props.requirement ? 'developmentList.editRequirementTitle' : 'developmentList.createRequirementTitle')"
    :confirm-loading="saving"
    :ok-text="t('common.save')"
    :cancel-text="t('common.cancel')"
    @ok="save"
    @cancel="close"
  >
    <a-form layout="vertical">
      <a-form-item :label="t('developmentList.requirementName')" required>
        <a-input v-model:value="form.title" :maxlength="200" show-count :placeholder="t('developmentList.requirementNamePlaceholder')" />
      </a-form-item>
      <a-form-item :label="t('developmentList.requirementDescription')">
        <a-textarea v-model:value="form.description" :maxlength="2000" show-count :rows="4" :placeholder="t('developmentList.requirementDescriptionPlaceholder')" />
      </a-form-item>
      <a-form-item :label="t('developmentList.requirementPriority')">
        <a-select v-model:value="form.priority">
          <a-select-option :value="1">{{ t('developmentList.requirementPriorityLow') }}</a-select-option>
          <a-select-option :value="2">{{ t('developmentList.requirementPriorityMedium') }}</a-select-option>
          <a-select-option :value="3">{{ t('developmentList.requirementPriorityHigh') }}</a-select-option>
          <a-select-option :value="4">{{ t('developmentList.requirementPriorityUrgent') }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item v-if="!props.requirement" :label="t('developmentList.requirementWorkflowTemplate')">
        <a-select
          v-model:value="form.templateVersionId"
          :options="workflowTemplateSelectOptions"
          :loading="workflowTemplatesLoading"
          :placeholder="t('developmentList.workflowTemplatePlaceholder')"
          allow-clear
        />
        <p class="development-requirement-edit-modal__hint">{{ t('developmentList.requirementWorkflowTemplateOptionalHint') }}</p>
      </a-form-item>
      <a-form-item :label="t('developmentList.requirementOwner')">
        <PersonSelect v-model="form.ownerId" allow-clear :placeholder="t('developmentList.requirementOwnerPlaceholder')" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped>
.development-requirement-edit-modal__hint { margin: 8px 0 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-relaxed); }
</style>
