<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  createDevelopmentTopic,
  getDevelopmentWorkflowTemplateOptions,
  getDevelopmentTopicProjectOptions,
  updateDevelopmentTopic,
  type DevelopmentTopicProjectOption,
  type DevelopmentTopicRow,
} from '/@/api/development-item'
import type { WorkflowTemplateSummary } from '/@/types/workflow'
import { useI18n } from 'vue-i18n'
import PersonSelect from '/@/views/project/detail/components/PersonSelect.vue'

const props = defineProps<{ open: boolean; topic: DevelopmentTopicRow | null }>()
const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'saved'): void
}>()
const { t } = useI18n()

const form = reactive({ title: '', ownerId: undefined as number | undefined, projectId: null as number | null, templateVersionId: null as number | null })
const workflowTemplates = ref<WorkflowTemplateSummary[]>([])
const workflowTemplatesLoading = ref(false)
const projectKeyword = ref('')
const projectOptions = ref<DevelopmentTopicProjectOption[]>([])
const selectedEligibleProjectId = ref<number | null>(null)
const projectOptionsLoading = ref(false)
const projectPage = ref(1)
const projectHasMore = ref(true)
const projectTotal = ref(0)
const saving = ref(false)
let projectRequestSequence = 0
const projectPageSize = 20

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

const projectSelectOptions = computed(() => {
  const options = [...projectOptions.value]
  const current = props.topic
  if (current?.projectId != null && form.projectId === current.projectId && !options.some((option) => option.projectId === current.projectId)) {
    options.unshift({
      projectId: current.projectId,
      projectCode: current.projectCode,
      projectName: current.projectName || t('common.unset'),
      nodeKey: current.nodeKey || '',
      nodeName: current.nodeName || t('common.unset'),
    })
  }
  return options.map((option) => ({
    value: option.projectId,
    label: `${option.projectName}${option.projectCode ? `（${option.projectCode}）` : ''} · ${option.nodeName}`,
    disabled: option.projectId === current?.projectId && !projectOptions.value.some((candidate) => candidate.projectId === option.projectId),
  }))
})

const projectChanged = computed(() => props.topic != null && form.projectId !== props.topic.projectId)

watch(() => [props.open, props.topic?.id] as const, ([open]) => {
  if (!open) return
  const topic = props.topic
  form.title = topic?.title || ''
  form.ownerId = topic?.ownerId
  form.projectId = topic?.projectId ?? null
  form.templateVersionId = null
  selectedEligibleProjectId.value = topic?.projectId ?? null
  projectKeyword.value = ''
  projectOptions.value = []
  projectPage.value = 1
  projectHasMore.value = true
  void initialize()
})

async function initialize() {
  if (!props.topic) await loadWorkflowTemplates()
  await loadProjectOptions(true)
}

async function loadWorkflowTemplates() {
  workflowTemplatesLoading.value = true
  try {
    const result = await getDevelopmentWorkflowTemplateOptions()
    workflowTemplates.value = result.topicTemplates || []
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

async function loadProjectOptions(reset = false) {
  if (reset) {
    projectRequestSequence += 1
    projectPage.value = 1
    projectHasMore.value = true
    projectOptions.value = []
    projectTotal.value = 0
  } else if (projectOptionsLoading.value || !projectHasMore.value) {
    return
  }

  const requestSequence = ++projectRequestSequence
  const requestedPage = projectPage.value
  projectOptionsLoading.value = true
  try {
    const result = await getDevelopmentTopicProjectOptions({
      currPage: requestedPage,
      pageSize: projectPageSize,
      keyword: projectKeyword.value.trim() || undefined,
      templateVersionId: form.templateVersionId ?? undefined,
    })
    if (requestSequence !== projectRequestSequence) return
    projectOptions.value = reset ? result.list : [...projectOptions.value, ...result.list]
    projectTotal.value = result.total
    projectPage.value = requestedPage + 1
    projectHasMore.value = projectOptions.value.length < result.total
  } catch (error) {
    if (requestSequence === projectRequestSequence) message.error((error as Error).message || t('developmentList.projectOptionsLoadFailed'))
  } finally {
    if (requestSequence === projectRequestSequence) projectOptionsLoading.value = false
  }
}

function onWorkflowTemplateChange() {
  form.projectId = null
  selectedEligibleProjectId.value = null
  void loadProjectOptions(true)
}

function onProjectSearch(value: string) {
  projectKeyword.value = value
  void loadProjectOptions(true)
}

function onProjectPopupScroll(event: UIEvent) {
  const target = event.target as HTMLElement | null
  if (!target || target.scrollTop + target.clientHeight < target.scrollHeight - 24) return
  void loadProjectOptions()
}

function onProjectChange(projectId: number) {
  selectedEligibleProjectId.value = projectOptions.value.some((option) => option.projectId === projectId) ? projectId : null
  form.projectId = projectId
}

function close() {
  if (saving.value) return
  emit('update:open', false)
}

async function save() {
  const topic = props.topic
  if (saving.value) return
  const title = form.title.trim()
  if (!title) {
    message.warning(t('developmentList.topicTitleRequired'))
    return
  }
  if (!topic && form.templateVersionId == null) {
    message.warning(t('developmentList.workflowTemplateRequired'))
    return
  }
  if (form.projectId != null && (!topic || projectChanged.value) && selectedEligibleProjectId.value !== form.projectId) {
    message.warning(t('developmentList.chooseEligibleProject'))
    return
  }

  saving.value = true
  try {
    const payload = {
      title,
      ownerId: form.ownerId ?? null,
      projectId: form.projectId ?? null,
      templateVersionId: topic ? undefined : form.templateVersionId,
    }
    if (topic) await updateDevelopmentTopic(topic.id, payload)
    else await createDevelopmentTopic(payload)
    message.success(t(topic ? 'developmentList.topicUpdated' : 'developmentList.topicCreated'))
    emit('update:open', false)
    emit('saved')
  } catch (error) {
    message.error((error as Error).message || t(topic ? 'developmentList.topicUpdateFailed' : 'developmentList.topicCreateFailed'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <a-modal
    :open="open"
    class="pms-project-modal development-topic-edit-modal"
    :title="t(props.topic ? 'developmentList.editTopicTitle' : 'developmentList.createTopicTitle')"
    :confirm-loading="saving"
    :ok-text="t('common.save')"
    :cancel-text="t('common.cancel')"
    @ok="save"
    @cancel="close"
  >
    <a-form layout="vertical">
      <a-form-item :label="t('developmentList.topicName')" required>
        <a-input v-model:value="form.title" :maxlength="200" show-count :placeholder="t('developmentList.topicNamePlaceholder')" />
      </a-form-item>
      <a-form-item v-if="!props.topic" :label="t('developmentList.topicWorkflowTemplate')" required>
        <a-select
          v-model:value="form.templateVersionId"
          :options="workflowTemplateSelectOptions"
          :loading="workflowTemplatesLoading"
          :placeholder="t('developmentList.workflowTemplatePlaceholder')"
          allow-clear
          @change="onWorkflowTemplateChange"
        />
        <p v-if="!workflowTemplatesLoading && workflowTemplateSelectOptions.length === 0" class="development-topic-edit-modal__empty-note">
          {{ t('developmentList.workflowTemplateEmpty') }}
        </p>
      </a-form-item>
      <a-form-item :label="t('developmentList.topicProject')">
        <a-select
          :value="form.projectId"
          show-search
          :filter-option="false"
          :options="projectSelectOptions"
          :loading="projectOptionsLoading"
          :placeholder="t('developmentList.topicProjectPlaceholder')"
          allow-clear
          @search="onProjectSearch"
          @popup-scroll="onProjectPopupScroll"
          @change="onProjectChange"
        />
        <p v-if="props.topic ? projectChanged : form.projectId != null" class="development-topic-edit-modal__rebind-note">
          {{ props.topic ? t('developmentList.topicRebindHint') : t('developmentList.topicCreateHint') }}
        </p>
        <p v-if="!projectOptionsLoading && projectTotal === 0" class="development-topic-edit-modal__empty-note">
          {{ t('developmentList.projectOptionsEmpty') }}
        </p>
      </a-form-item>
      <a-form-item :label="t('developmentList.topicOwner')">
        <PersonSelect v-model="form.ownerId" allow-clear :placeholder="t('developmentList.topicOwnerPlaceholder')" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped>
.development-topic-edit-modal__rebind-note,
.development-topic-edit-modal__empty-note { margin: 8px 0 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-relaxed); }
</style>
