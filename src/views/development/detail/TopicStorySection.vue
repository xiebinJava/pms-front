<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { getDevelopmentTopicStories, type DevelopmentTopicStory } from '/@/api/development-item'
import DevelopmentStoryEditModal from '../DevelopmentStoryEditModal.vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ topicId: number }>()
const { t } = useI18n()
const stories = ref<DevelopmentTopicStory[]>([])
const loading = ref(false)
const editorOpen = ref(false)

async function load() {
  loading.value = true
  try {
    stories.value = await getDevelopmentTopicStories(props.topicId)
  } catch (error) {
    message.error((error as Error).message || t('developmentList.storyLoadFailed'))
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editorOpen.value = true
}

onMounted(() => { void load() })
watch(() => props.topicId, () => { void load() })
</script>

<template>
  <section class="topic-story-section pms-detail-panel pms-section-panel card-surface">
    <div class="topic-story-section__header pms-section-heading">
      <div><h2>{{ t('developmentDetail.topicStories') }}</h2><p>{{ t('developmentDetail.topicStoriesHint') }}</p></div>
      <div class="topic-story-section__actions">
        <a-button size="small" @click="load"><ReloadOutlined />{{ t('common.refresh') }}</a-button>
        <a-button type="primary" size="small" @click="openCreate"><PlusOutlined />{{ t('developmentList.createStory') }}</a-button>
      </div>
    </div>
    <a-spin :spinning="loading">
      <a-empty v-if="!stories.length" :description="t('developmentDetail.noTopicStories')" />
      <div v-else class="topic-story-section__list">
        <div v-for="story in stories" :key="story.id" class="topic-story-section__row">
          <strong>{{ story.title }}</strong>
          <span>{{ story.ownerName || t('common.unset') }}</span>
          <a-tag>{{ t(`developmentList.status${story.status === 'NOT_STARTED' ? 'NotStarted' : story.status === 'IN_PROGRESS' ? 'InProgress' : story.status === 'TESTING' ? 'Testing' : story.status === 'BLOCKED' ? 'Blocked' : 'Done'}`) }}</a-tag>
          <span>{{ story.progress }}%</span>
        </div>
      </div>
    </a-spin>
    <DevelopmentStoryEditModal v-model:open="editorOpen" :story="null" :initial-topic-id="topicId" @saved="load" />
  </section>
</template>

<style scoped>
.topic-story-section__header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 15px; }
.topic-story-section__header h2 { margin: 0; color: var(--pms-text); font-size: 16px; font-weight: 730; }
.topic-story-section__header p { margin: 4px 0 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.topic-story-section__actions { display: flex; gap: 8px; }
.topic-story-section__list { display: grid; gap: 8px; }
.topic-story-section__row { display: grid; grid-template-columns: minmax(0, 1fr) 180px 100px 60px; gap: 12px; align-items: center; padding: 12px 14px; border: 1px solid var(--pms-border); border-radius: 8px; }
@media (max-width: 720px) { .topic-story-section__header { flex-direction: column; } .topic-story-section__row { grid-template-columns: 1fr 1fr; } }
</style>
