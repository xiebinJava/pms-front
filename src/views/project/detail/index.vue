<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftOutlined } from '@ant-design/icons-vue'
import { getProject } from '/@/api/project'
import { ProjectStatus, Priority, statusTagColor, priorityTagColor } from '/@/enums'
import { formatDate } from '/@/utils/format'
import TaskKanban from './components/TaskKanban.vue'
import Milestones from './components/Milestones.vue'
import Members from './components/Members.vue'
import Comments from './components/Comments.vue'
import type { Project } from '/@/types/domain'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => Number(route.params.id))

const project = ref<Project | null>(null)
const loading = ref(false)
const activeTab = ref('kanban')

async function loadProject() {
  loading.value = true
  try {
    project.value = await getProject(projectId.value)
  } finally {
    loading.value = false
  }
}

onMounted(loadProject)
</script>

<template>
  <div v-if="project">
    <div class="flex items-center gap-2 mb-4">
      <span class="b-opt flex items-center gap-1" @click="router.push('/projects')">
        <ArrowLeftOutlined /> 返回项目列表
      </span>
    </div>

    <a-card :bordered="false" class="mb-4" :loading="loading">
      <div class="flex items-start justify-between">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-[20px] font-semibold m-0 text-[#18212e]">{{ project.name }}</h1>
            <a-tag :color="statusTagColor[project.status]">{{ ProjectStatus.label(project.status) }}</a-tag>
            <a-tag :color="priorityTagColor[project.priority]">优先级：{{ Priority.label(project.priority) }}</a-tag>
          </div>
          <div class="text-[12px] text-[#8895a7] mt-1">
            {{ project.code }} · 负责人：{{ project.ownerName || '-' }} · {{ formatDate(project.startDate) }} ~
            {{ formatDate(project.endDate) }}
          </div>
          <p class="text-[13px] text-[#5d6b7e] mt-3 mb-0" style="max-width: 720px">
            {{ project.description || '暂无描述' }}
          </p>
        </div>
        <div class="w-[220px]">
          <a-progress
            type="circle"
            :percent="project.progress"
            :size="90"
            :format="(p?: number) => `${p ?? 0}%`"
            :status="project.progress === 100 ? 'success' : undefined"
          />
        </div>
      </div>
    </a-card>

    <a-card :bordered="false">
      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="kanban" tab="任务看板">
          <TaskKanban :project-id="projectId" :project="project" />
        </a-tab-pane>
        <a-tab-pane key="milestones" tab="里程碑">
          <Milestones :project-id="projectId" />
        </a-tab-pane>
        <a-tab-pane key="members" tab="成员">
          <Members :project-id="projectId" />
        </a-tab-pane>
        <a-tab-pane key="comments" tab="动态">
          <Comments :project-id="projectId" />
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>
