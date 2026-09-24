<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  createDevelopmentStory,
  getDevelopmentTopicPage,
  updateDevelopmentStory,
  type DevelopmentStoryRow,
  type DevelopmentTopicRow,
  type DevelopmentStoryStatus,
} from '/@/api/development-item'
import PersonSelect from '/@/views/project/detail/components/PersonSelect.vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ open: boolean; story: DevelopmentStoryRow | null; initialTopicId?: number | null }>()
const emit = defineEmits<{ (event: 'update:open', value: boolean): void; (event: 'saved'): void }>()
const { t } = useI18n()
const form = reactive({
  topicId: null as number | null,
  title: '',
  ownerId: undefined as number | undefined,
  status: 'NOT_STARTED' as DevelopmentStoryStatus,
  progress: 0,
  storyPoints: 0,
  startDate: '',
  dueDate: '',
  blocker: '',
})
const topics = ref<DevelopmentTopicRow[]>([])
const topicLoading = ref(false)
const saving = ref(false)

const statusOptions = [
  'NOT_STARTED', 'IN_PROGRESS', 'TESTING', 'BLOCKED', 'DONE',
].map((value) => ({ value, label: t(`developmentList.status${value === 'NOT_STARTED' ? 'NotStarted' : value === 'IN_PROGRESS' ? 'InProgress' : value === 'TESTING' ? 'Testing' : value === 'BLOCKED' ? 'Blocked' : 'Done'}`) }))

watch(() => [props.open, props.story?.id, props.initialTopicId] as const, ([open]) => {
  if (!open) return
  const story = props.story
  form.topicId = story?.topicId ?? props.initialTopicId ?? null
  form.title = story?.title || ''
  form.ownerId = story?.ownerId
  form.status = story?.status || 'NOT_STARTED'
  form.progress = story?.developmentProgress ?? story?.progress ?? 0
  form.storyPoints = story?.storyPoints ?? 0
  form.startDate = story?.startDate || ''
  form.dueDate = story?.dueDate || ''
  form.blocker = story?.blocker || ''
  void loadTopics()
})

async function loadTopics() {
  topicLoading.value = true
  try {
    const result = await getDevelopmentTopicPage({ currPage: 1, pageSize: 100 })
    topics.value = result.list
  } catch (error) {
    message.error((error as Error).message || t('developmentList.topicOptionsLoadFailed'))
  } finally {
    topicLoading.value = false
  }
}

function filterTopicOption(input: string, option?: { label?: string }) {
  return String(option?.label || '').toLowerCase().includes(input.toLowerCase())
}

function close() {
  if (!saving.value) emit('update:open', false)
}

async function save() {
  if (saving.value) return
  if (!form.title.trim()) {
    message.warning(t('developmentList.storyTitleRequired'))
    return
  }
  const payload = {
    topicId: form.topicId,
    title: form.title.trim(),
    ownerId: form.ownerId ?? null,
    status: form.status,
    progress: form.progress,
    storyPoints: form.storyPoints,
    startDate: form.startDate || undefined,
    dueDate: form.dueDate || undefined,
    blocker: form.blocker.trim() || undefined,
  }
  saving.value = true
  try {
    if (props.story) await updateDevelopmentStory(props.story.id, payload)
    else await createDevelopmentStory(payload)
    message.success(t(props.story ? 'developmentList.storyUpdated' : 'developmentList.storyCreated'))
    emit('update:open', false)
    emit('saved')
  } catch (error) {
    message.error((error as Error).message || t(props.story ? 'developmentList.storyUpdateFailed' : 'developmentList.storyCreateFailed'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <a-modal
    :open="open"
    class="pms-project-modal development-story-edit-modal"
    :title="t(story ? 'developmentList.editStoryTitle' : 'developmentList.createStoryTitle')"
    :confirm-loading="saving"
    :ok-text="t('common.save')"
    :cancel-text="t('common.cancel')"
    @ok="save"
    @cancel="close"
  >
    <a-form layout="vertical">
      <a-form-item :label="t('developmentList.storyName')" required><a-input v-model:value="form.title" :maxlength="300" show-count :placeholder="t('developmentList.storyNamePlaceholder')" /></a-form-item>
      <a-form-item :label="t('developmentList.storyTopic')">
        <a-select v-model:value="form.topicId" allow-clear show-search :loading="topicLoading" :filter-option="filterTopicOption" :options="topics.map((topic) => ({ value: topic.id, label: topic.title }))" :placeholder="t('developmentList.storyTopicPlaceholder')" />
      </a-form-item>
      <a-form-item :label="t('developmentList.storyOwner')"><PersonSelect v-model="form.ownerId" allow-clear :placeholder="t('developmentList.storyOwnerPlaceholder')" /></a-form-item>
      <div class="development-story-edit-modal__grid">
        <a-form-item :label="t('developmentList.storyStatus')"><a-select v-model:value="form.status" :options="statusOptions" /></a-form-item>
        <a-form-item :label="t('developmentList.storyPoints')"><a-input-number v-model:value="form.storyPoints" :min="0" :max="1000" style="width: 100%" /></a-form-item>
        <a-form-item :label="t('developmentList.storyProgress')"><a-input-number v-model:value="form.progress" :min="0" :max="100" addon-after="%" style="width: 100%" /></a-form-item>
        <a-form-item :label="t('developmentList.storyStartDate')"><a-input v-model:value="form.startDate" type="date" /></a-form-item>
        <a-form-item :label="t('developmentList.storyDueDate')"><a-input v-model:value="form.dueDate" type="date" /></a-form-item>
      </div>
      <a-form-item :label="t('developmentList.storyBlocker')"><a-textarea v-model:value="form.blocker" :maxlength="500" :rows="3" /></a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped>
.development-story-edit-modal__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 12px; }
@media (max-width: 640px) { .development-story-edit-modal__grid { grid-template-columns: 1fr; } }
</style>
