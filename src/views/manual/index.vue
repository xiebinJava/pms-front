<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  ApartmentOutlined,
  AuditOutlined,
  BookOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  ExperimentOutlined,
  QuestionCircleOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  ToolOutlined,
} from '@ant-design/icons-vue'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'

type MediaKind = 'image' | 'gif' | 'video'
type MediaSlot = {
  kind: MediaKind
  labelKey: string
  captionKey: string
  src: string
  poster?: string
}

type ManualSection = {
  id: string
  titleKey: string
  leadKey: string
  icon: Component
  tagKeys: string[]
  relatedPath: string
  media: MediaSlot[]
  purposeKey: string
  stepsKey: string
  notesKey: string
  checklistKey: string
}

const MEDIA_ROOT = '/manual/' // 将 PNG、JPG 或 GIF 放入 public/manual/ 后填写 src；真实视频准备好后再启用 video 插槽

const sections: ManualSection[] = [
  {
    id: 'quick-start',
    titleKey: 'manual.sections.quickStart.title',
    leadKey: 'manual.sections.quickStart.lead',
    icon: CheckCircleOutlined,
    tagKeys: ['manual.sections.quickStart.tags.firstUse', 'manual.sections.quickStart.tags.accountSecurity'],
    relatedPath: '/login',
    media: [{ kind: 'image', src: 'quick-start-login.png', labelKey: 'manual.sections.quickStart.media.login.label', captionKey: 'manual.sections.quickStart.media.login.caption' }],
    purposeKey: 'manual.sections.quickStart.purpose',
    stepsKey: 'manual.sections.quickStart.steps',
    notesKey: 'manual.sections.quickStart.notes',
    checklistKey: 'manual.sections.quickStart.checklist',
  },
  {
    id: 'workbench',
    titleKey: 'manual.sections.workbench.title',
    leadKey: 'manual.sections.workbench.lead',
    icon: ToolOutlined,
    tagKeys: ['manual.sections.workbench.tags.myWork', 'manual.sections.workbench.tags.taskReminder'],
    relatedPath: '/dashboard',
    media: [{ kind: 'image', src: 'workbench.jpg', labelKey: 'manual.sections.workbench.media.dashboard.label', captionKey: 'manual.sections.workbench.media.dashboard.caption' }],
    purposeKey: 'manual.sections.workbench.purpose',
    stepsKey: 'manual.sections.workbench.steps',
    notesKey: 'manual.sections.workbench.notes',
    checklistKey: 'manual.sections.workbench.checklist',
  },
  {
    id: 'rd-management',
    titleKey: 'manual.sections.rdManagement.title',
    leadKey: 'manual.sections.rdManagement.lead',
    icon: ExperimentOutlined,
    tagKeys: ['manual.sections.rdManagement.tags.navigation', 'manual.sections.rdManagement.tags.delivery'],
    relatedPath: '/projects',
    media: [],
    purposeKey: 'manual.sections.rdManagement.purpose',
    stepsKey: 'manual.sections.rdManagement.steps',
    notesKey: 'manual.sections.rdManagement.notes',
    checklistKey: 'manual.sections.rdManagement.checklist',
  },
  {
    id: 'projects',
    titleKey: 'manual.sections.projects.title',
    leadKey: 'manual.sections.projects.lead',
    icon: BookOutlined,
    tagKeys: ['manual.sections.projects.tags.list', 'manual.sections.projects.tags.detail'],
    relatedPath: '/projects',
    media: [{ kind: 'image', src: 'project-list.jpg', labelKey: 'manual.sections.projects.media.list.label', captionKey: 'manual.sections.projects.media.list.caption' }],
    purposeKey: 'manual.sections.projects.purpose',
    stepsKey: 'manual.sections.projects.steps',
    notesKey: 'manual.sections.projects.notes',
    checklistKey: 'manual.sections.projects.checklist',
  },
  {
    id: 'configuration',
    titleKey: 'manual.sections.configuration.title',
    leadKey: 'manual.sections.configuration.lead',
    icon: SettingOutlined,
    tagKeys: ['manual.sections.configuration.tags.governance', 'manual.sections.configuration.tags.admin'],
    relatedPath: '/admin/users',
    media: [],
    purposeKey: 'manual.sections.configuration.purpose',
    stepsKey: 'manual.sections.configuration.steps',
    notesKey: 'manual.sections.configuration.notes',
    checklistKey: 'manual.sections.configuration.checklist',
  },
  {
    id: 'users',
    titleKey: 'manual.sections.users.title',
    leadKey: 'manual.sections.users.lead',
    icon: TeamOutlined,
    tagKeys: ['manual.sections.users.tags.account', 'manual.sections.users.tags.affiliation'],
    relatedPath: '/admin/users',
    media: [],
    purposeKey: 'manual.sections.users.purpose',
    stepsKey: 'manual.sections.users.steps',
    notesKey: 'manual.sections.users.notes',
    checklistKey: 'manual.sections.users.checklist',
  },
  {
    id: 'organization',
    titleKey: 'manual.sections.organization.title',
    leadKey: 'manual.sections.organization.lead',
    icon: ApartmentOutlined,
    tagKeys: ['manual.sections.organization.tags.canvas', 'manual.sections.organization.tags.owner'],
    relatedPath: '/admin/org',
    media: [{ kind: 'image', src: 'organization-canvas.jpg', labelKey: 'manual.sections.organization.media.canvas.label', captionKey: 'manual.sections.organization.media.canvas.caption' }],
    purposeKey: 'manual.sections.organization.purpose',
    stepsKey: 'manual.sections.organization.steps',
    notesKey: 'manual.sections.organization.notes',
    checklistKey: 'manual.sections.organization.checklist',
  },
  {
    id: 'roles',
    titleKey: 'manual.sections.roles.title',
    leadKey: 'manual.sections.roles.lead',
    icon: SafetyCertificateOutlined,
    tagKeys: ['manual.sections.roles.tags.rbac', 'manual.sections.roles.tags.scope'],
    relatedPath: '/admin/roles',
    media: [],
    purposeKey: 'manual.sections.roles.purpose',
    stepsKey: 'manual.sections.roles.steps',
    notesKey: 'manual.sections.roles.notes',
    checklistKey: 'manual.sections.roles.checklist',
  },
  {
    id: 'import',
    titleKey: 'manual.sections.import.title',
    leadKey: 'manual.sections.import.lead',
    icon: CloudUploadOutlined,
    tagKeys: ['manual.sections.import.tags.file', 'manual.sections.import.tags.preview'],
    relatedPath: '/admin/import',
    media: [],
    purposeKey: 'manual.sections.import.purpose',
    stepsKey: 'manual.sections.import.steps',
    notesKey: 'manual.sections.import.notes',
    checklistKey: 'manual.sections.import.checklist',
  },
  {
    id: 'audit',
    titleKey: 'manual.sections.audit.title',
    leadKey: 'manual.sections.audit.lead',
    icon: AuditOutlined,
    tagKeys: ['manual.sections.audit.tags.tracking', 'manual.sections.audit.tags.security'],
    relatedPath: '/admin/audit',
    media: [],
    purposeKey: 'manual.sections.audit.purpose',
    stepsKey: 'manual.sections.audit.steps',
    notesKey: 'manual.sections.audit.notes',
    checklistKey: 'manual.sections.audit.checklist',
  },
  {
    id: 'faq',
    titleKey: 'manual.sections.faq.title',
    leadKey: 'manual.sections.faq.lead',
    icon: QuestionCircleOutlined,
    tagKeys: ['manual.sections.faq.tags.troubleshooting', 'manual.sections.faq.tags.faq'],
    relatedPath: '/dashboard',
    media: [],
    purposeKey: 'manual.sections.faq.purpose',
    stepsKey: 'manual.sections.faq.steps',
    notesKey: 'manual.sections.faq.notes',
    checklistKey: 'manual.sections.faq.checklist',
  },
]

const currentSection = ref('quick-start')
const route = useRoute()
const router = useRouter()
const { t, tm } = useI18n()

function translateList(key: string): string[] {
  const value = tm(key)
  return Array.isArray(value) ? value.map(String) : []
}

function syncFromHash() {
  const id = route.hash.replace(/^#/, '')
  if (sections.some((section) => section.id === id)) currentSection.value = id
  else currentSection.value = 'quick-start'
}

function scrollToSection(id: string) {
  currentSection.value = id
  router.replace({ path: '/manual', hash: `#${id}` })
  nextTick(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

onMounted(() => {
  syncFromHash()
  nextTick(() => {
    if (route.hash) document.getElementById(currentSection.value)?.scrollIntoView({ block: 'start' })
  })
})
watch(() => route.hash, syncFromHash)
onBeforeUnmount(() => window.scrollTo({ top: 0, behavior: 'auto' }))
</script>

<template>
  <div class="manual-page pms-page-stack">
    <PmsPageHeader :title="$t('route.manual')" :description="$t('manual.description')">
      <template #actions>
        <a-button class="pms-secondary-button" @click="scrollToSection('quick-start')">
          <BookOutlined /> {{ $t('manual.startReading') }}
        </a-button>
      </template>
    </PmsPageHeader>

    <div class="manual-layout">
      <aside class="manual-index pms-panel" :aria-label="$t('manual.tocAria')">
        <div class="manual-index__heading">
          <span>{{ $t('manual.toc') }}</span>
          <small>{{ $t('manual.tocCount', { count: sections.length }) }}</small>
        </div>
        <nav class="manual-index__nav">
          <button
            v-for="section in sections"
            :key="section.id"
            class="manual-index__item"
            :class="{ 'manual-index__item--active': currentSection === section.id }"
            type="button"
            :aria-current="currentSection === section.id ? 'location' : undefined"
            @click="scrollToSection(section.id)"
          >
            <component :is="section.icon" />
            <span>{{ t(section.titleKey) }}</span>
          </button>
        </nav>
        <div class="manual-index__tip">
          <SettingOutlined />
          <p>{{ $t('manual.tocTip') }}</p>
        </div>
      </aside>

      <main class="manual-content" :aria-label="$t('manual.contentAria')">
        <section class="manual-intro pms-panel">
          <div class="manual-intro__icon"><BookOutlined /></div>
          <div>
            <h2>{{ $t('manual.introTitle') }}</h2>
            <p>{{ $t('manual.introBody') }}</p>
          </div>
          <div class="manual-intro__rules">
            <span><strong>{{ $t('manual.introEmail') }}</strong> {{ $t('manual.introEmailHint') }}</span>
            <span><strong>{{ $t('manual.introOwner') }}</strong> {{ $t('manual.introOwnerHint') }}</span>
            <span><strong>{{ $t('manual.introPermission') }}</strong> {{ $t('manual.introPermissionHint') }}</span>
          </div>
        </section>

        <article v-for="section in sections" :id="section.id" :key="section.id" class="manual-section pms-panel">
          <header class="manual-section__header">
            <div class="manual-section__title-wrap">
              <div class="manual-section__icon"><component :is="section.icon" /></div>
              <div>
                <div class="manual-section__eyebrow">{{ section.id }}</div>
                <h2>{{ t(section.titleKey) }}</h2>
                <p>{{ t(section.leadKey) }}</p>
              </div>
            </div>
            <RouterLink class="manual-related-link" :to="section.relatedPath">{{ $t('manual.related') }} <span aria-hidden="true">→</span></RouterLink>
          </header>

          <div class="manual-tags">
            <span v-for="tagKey in section.tagKeys" :key="tagKey" class="manual-tag">{{ t(tagKey) }}</span>
          </div>

          <div class="manual-section__body">
            <section class="manual-block manual-block--purpose">
              <h3>{{ $t('manual.purpose') }}</h3>
              <p>{{ t(section.purposeKey) }}</p>
            </section>
            <section class="manual-block">
              <h3>{{ $t('manual.steps') }}</h3>
              <ol class="manual-steps">
                <li v-for="(step, index) in translateList(section.stepsKey)" :key="`${section.id}-step-${index}`">
                  <span class="manual-step-index">{{ index + 1 }}</span>
                  <span>{{ step }}</span>
                </li>
              </ol>
            </section>
            <div class="manual-detail-grid">
              <section class="manual-block">
                <h3>{{ $t('manual.notes') }}</h3>
                <ul class="manual-list">
                  <li v-for="(note, index) in translateList(section.notesKey)" :key="`${section.id}-note-${index}`">{{ note }}</li>
                </ul>
              </section>
              <section class="manual-block manual-block--checklist">
                <h3>{{ $t('manual.checklist') }}</h3>
                <ul class="manual-checklist">
                  <li v-for="(item, index) in translateList(section.checklistKey)" :key="`${section.id}-check-${index}`"><CheckCircleOutlined />{{ item }}</li>
                </ul>
              </section>
            </div>
          </div>

          <section v-if="section.media.length" class="manual-media" :aria-label="$t('manual.mediaAria')">
            <div class="manual-media__heading">
              <div>
                <h3>{{ $t('manual.mediaTitle') }}</h3>
                <p>{{ $t('manual.mediaHint') }}</p>
              </div>
              <span>{{ $t('manual.mediaDir') }}</span>
            </div>
            <div class="manual-media__grid">
              <figure v-for="media in section.media" :key="media.labelKey" class="manual-media-card">
                <img v-if="media.kind !== 'video'" :src="`${MEDIA_ROOT}${media.src}`" :alt="t(media.labelKey)" />
                <video v-else controls preload="metadata" :poster="media.poster ? `${MEDIA_ROOT}${media.poster}` : undefined">
                  <source :src="`${MEDIA_ROOT}${media.src}`" />
                  {{ $t('manual.videoUnsupported') }}
                </video>
                <figcaption><strong>{{ t(media.labelKey) }}</strong><span>{{ t(media.captionKey) }}</span></figcaption>
              </figure>
            </div>
          </section>
        </article>
      </main>
    </div>
  </div>
</template>
