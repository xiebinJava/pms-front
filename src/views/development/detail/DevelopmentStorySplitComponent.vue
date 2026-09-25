<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { getDevelopmentTopicStories, type DevelopmentTopicStory } from '/@/api/development-item'
import DevelopmentStoryEditModal from '../DevelopmentStoryEditModal.vue'

const props = defineProps<{ topicId: number; nodeId: number; canEdit: boolean }>()
const { t } = useI18n()
const router = useRouter()
const stories = ref<DevelopmentTopicStory[]>([])
const loading = ref(false)
const editorOpen = ref(false)

const nodeStories = computed(() => stories.value.filter((story) => story.topicWorkflowNodeId === props.nodeId))

async function load() {
  loading.value = true
  try {
    stories.value = await getDevelopmentTopicStories(props.topicId)
  } catch (error) {
    message.error((error as Error).message || t('developmentDetail.storySplitLoadFailed'))
  } finally {
    loading.value = false
  }
}

function openCreate() {
  if (!props.canEdit) return
  editorOpen.value = true
}

function openStory(storyId: number) {
  void router.push(`/development/stories/${storyId}`)
}

function statusKey(status: DevelopmentTopicStory['status']) {
  if (status === 'DONE') return 'Done'
  if (status === 'IN_PROGRESS') return 'InProgress'
  if (status === 'TESTING') return 'Testing'
  if (status === 'BLOCKED') return 'Blocked'
  return 'NotStarted'
}

onMounted(() => { void load() })
watch(() => [props.topicId, props.nodeId], () => { void load() })
</script>

<template>
  <section class="development-story-split-component pms-runtime-component">
    <div class="development-story-split-component__header pms-section-heading">
      <div>
        <h3>{{ t('developmentDetail.storySplitTitle') }}</h3>
        <p>{{ t('developmentDetail.storySplitHint') }}</p>
      </div>
      <div class="development-story-split-component__actions">
        <a-button size="small" @click="load"><ReloadOutlined />{{ t('common.refresh') }}</a-button>
        <a-button v-if="canEdit" type="primary" size="small" @click="openCreate"><PlusOutlined />{{ t('developmentList.createStory') }}</a-button>
      </div>
    </div>

    <a-spin :spinning="loading">
      <a-empty v-if="!nodeStories.length" :description="t('developmentDetail.noNodeStories')" />
      <div v-else class="development-story-split-component__list">
        <button
          v-for="story in nodeStories"
          :key="story.id"
          type="button"
          class="development-story-split-component__story"
          @click="openStory(story.id)"
        >
          <span class="development-story-split-component__story-main">
            <strong>{{ story.title }}</strong>
            <span>{{ story.ownerName || t('common.unset') }}</span>
          </span>
          <span class="development-story-split-component__story-meta">
            <a-tag>{{ t(`developmentList.status${statusKey(story.status)}`) }}</a-tag>
            <span>{{ story.progress }}%</span>
          </span>
        </button>
      </div>
    </a-spin>

    <DevelopmentStoryEditModal
      v-model:open="editorOpen"
      :story="null"
      :initial-topic-id="topicId"
      :lock-topic="true"
      @saved="load"
    />
  </section>
</template>

<style scoped>
.development-story-split-component { padding-top: 2px; }
.development-story-split-component__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.development-story-split-component__header h3 { margin: 0; color: var(--pms-text); font-size: 15px; font-weight: 700; }
.development-story-split-component__header p { margin: 4px 0 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.development-story-split-component__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.development-story-split-component__list { display: grid; gap: 8px; }
.development-story-split-component__story { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; padding: 12px 14px; color: inherit; text-align: left; background: var(--pms-detail-surface-muted); border: 1px solid var(--pms-detail-border); border-radius: 8px; cursor: pointer; }
.development-story-split-component__story:hover { border-color: var(--pms-primary); background: var(--pms-detail-surface); }
.development-story-split-component__story-main { display: grid; gap: 3px; min-width: 0; }
.development-story-split-component__story-main strong { overflow: hidden; color: var(--pms-text); text-overflow: ellipsis; white-space: nowrap; }
.development-story-split-component__story-main span { color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.development-story-split-component__story-meta { display: flex; flex: 0 0 auto; align-items: center; gap: 12px; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
@media (max-width: 640px) { .development-story-split-component__header { flex-direction: column; } .development-story-split-component__story { align-items: flex-start; flex-direction: column; gap: 8px; } }
</style>
