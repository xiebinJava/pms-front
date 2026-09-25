<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  ApartmentOutlined,
  AuditOutlined,
  BellOutlined,
  BookOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  DownOutlined,
  ExperimentOutlined,
  MessageOutlined,
  QuestionCircleOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  ToolOutlined,
} from '@ant-design/icons-vue'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
import { matchesManualSearch, pickActiveManualSection } from './manual-navigation'

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
  businessLogicKey?: string
  roleMatrixKey?: string
  permissionGuideKey?: string
  examplesKey?: string
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
    businessLogicKey: 'manual.sections.quickStart.businessLogic',
    examplesKey: 'manual.sections.quickStart.examples',
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
    businessLogicKey: 'manual.sections.workbench.businessLogic',
    examplesKey: 'manual.sections.workbench.examples',
  },
  {
    id: 'notifications',
    titleKey: 'manual.sections.notifications.title',
    leadKey: 'manual.sections.notifications.lead',
    icon: BellOutlined,
    tagKeys: ['manual.sections.notifications.tags.inbox', 'manual.sections.notifications.tags.reminders'],
    relatedPath: '/notifications',
    media: [],
    purposeKey: 'manual.sections.notifications.purpose',
    stepsKey: 'manual.sections.notifications.steps',
    notesKey: 'manual.sections.notifications.notes',
    checklistKey: 'manual.sections.notifications.checklist',
    businessLogicKey: 'manual.sections.notifications.businessLogic',
    examplesKey: 'manual.sections.notifications.examples',
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
    businessLogicKey: 'manual.sections.rdManagement.businessLogic',
    examplesKey: 'manual.sections.rdManagement.examples',
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
    businessLogicKey: 'manual.sections.projects.businessLogic',
    examplesKey: 'manual.sections.projects.examples',
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
    businessLogicKey: 'manual.sections.configuration.businessLogic',
    examplesKey: 'manual.sections.configuration.examples',
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
    businessLogicKey: 'manual.sections.users.businessLogic',
    examplesKey: 'manual.sections.users.examples',
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
    businessLogicKey: 'manual.sections.organization.businessLogic',
    examplesKey: 'manual.sections.organization.examples',
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
    businessLogicKey: 'manual.sections.roles.businessLogic',
    roleMatrixKey: 'manual.sections.roles.roleMatrix',
    permissionGuideKey: 'manual.sections.roles.permissionGuide',
    examplesKey: 'manual.sections.roles.examples',
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
    businessLogicKey: 'manual.sections.import.businessLogic',
    examplesKey: 'manual.sections.import.examples',
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
    businessLogicKey: 'manual.sections.audit.businessLogic',
    examplesKey: 'manual.sections.audit.examples',
  },
  {
    id: 'feedback',
    titleKey: 'manual.sections.feedback.title',
    leadKey: 'manual.sections.feedback.lead',
    icon: MessageOutlined,
    tagKeys: ['manual.sections.feedback.tags.intake', 'manual.sections.feedback.tags.traceability'],
    relatedPath: '/feedback',
    media: [],
    purposeKey: 'manual.sections.feedback.purpose',
    stepsKey: 'manual.sections.feedback.steps',
    notesKey: 'manual.sections.feedback.notes',
    checklistKey: 'manual.sections.feedback.checklist',
    businessLogicKey: 'manual.sections.feedback.businessLogic',
    examplesKey: 'manual.sections.feedback.examples',
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
    businessLogicKey: 'manual.sections.faq.businessLogic',
    examplesKey: 'manual.sections.faq.examples',
  },
]

const currentSection = ref('quick-start')
const scrollFrame = ref<number | null>(null)
const manualSearchQuery = ref('')
const manualIndexExpanded = ref(false)
const route = useRoute()
const router = useRouter()
const { t, tm } = useI18n()

const legacyReferenceHashes: Record<string, string> = {
  '#business-rules': '/manual/business-rules#identity',
  '#design-system': '/manual/design-system#principles',
}

function translateList(key: string): string[] {
  const value = tm(key)
  return Array.isArray(value) ? value.map(String) : []
}

type RoleMatrixRow = {
  name: string
  code: string
  permissions: string
  scope: string
}

function translateMatrix(key: string): RoleMatrixRow[] {
  const value = tm(key)
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    return [{
      name: String(row.name ?? ''),
      code: String(row.code ?? ''),
      permissions: String(row.permissions ?? ''),
      scope: String(row.scope ?? ''),
    }]
  })
}

function sectionSearchText(section: ManualSection): string {
  const listKeys = [
    section.leadKey,
    section.purposeKey,
    section.stepsKey,
    section.notesKey,
    section.checklistKey,
    section.businessLogicKey,
    section.permissionGuideKey,
    section.examplesKey,
  ].filter(Boolean) as string[]

  return [
    t(section.titleKey),
    ...section.tagKeys.map((key) => t(key)),
    ...listKeys.flatMap((key) => translateList(key)),
    ...(section.roleMatrixKey ? translateMatrix(section.roleMatrixKey).flatMap((row) => Object.values(row)) : []),
  ].map(String).join(' ')
}

const filteredSections = computed(() => sections.filter((section) => matchesManualSearch(manualSearchQuery.value, sectionSearchText(section))))

function syncFromHash() {
  const id = route.hash.replace(/^#/, '')
  if (sections.some((section) => section.id === id)) currentSection.value = id
  else currentSection.value = 'quick-start'
}

function scrollToSection(id: string) {
  currentSection.value = id
  manualIndexExpanded.value = false
  void router.replace({ path: '/manual', hash: `#${id}` })
  nextTick(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const focusHeading = () => document.getElementById(`${id}-title`)?.focus({ preventScroll: true })
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(focusHeading)
    else focusHeading()
  })
}

function syncFromScroll() {
  const anchor = Math.min(Math.max(window.innerHeight * 0.32, 160), 280)
  const positions = sections.map((section) => ({
    id: section.id,
    top: document.getElementById(section.id)?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
  }))
  const nextSection = pickActiveManualSection(positions, anchor)
  if (!nextSection || nextSection === currentSection.value) return

  currentSection.value = nextSection
  if (route.hash !== `#${nextSection}`) void router.replace({ path: '/manual', hash: `#${nextSection}` })
}

function onWindowScroll() {
  if (scrollFrame.value !== null) return
  scrollFrame.value = window.requestAnimationFrame(() => {
    scrollFrame.value = null
    syncFromScroll()
  })
}

function redirectLegacyReferenceHash(hash: string): boolean {
  const target = legacyReferenceHashes[hash]
  if (!target) return false
  void router.replace(target)
  return true
}

onMounted(() => {
  window.addEventListener('scroll', onWindowScroll, { passive: true })
  if (redirectLegacyReferenceHash(route.hash)) return
  syncFromHash()
  nextTick(() => {
    if (route.hash) document.getElementById(currentSection.value)?.scrollIntoView({ block: 'start' })
    syncFromScroll()
  })
})
watch(() => route.hash, (hash) => {
  if (!redirectLegacyReferenceHash(hash)) syncFromHash()
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onWindowScroll)
  if (scrollFrame.value !== null) window.cancelAnimationFrame(scrollFrame.value)
  window.scrollTo({ top: 0, behavior: 'auto' })
})
</script>

<template>
  <div class="manual-page pms-page-stack">
    <PmsPageHeader :title="$t('route.manual')" :description="$t('manual.description')">
      <template #actions>
        <div class="manual-page-header__meta" :aria-label="$t('manual.metadataAria')">
          <span>{{ $t('manual.version') }}</span>
          <span>{{ $t('manual.lastUpdated') }}</span>
          <span>{{ $t('manual.maintainedBy') }}</span>
        </div>
        <a-button class="pms-secondary-button" @click="scrollToSection('quick-start')">
          <BookOutlined /> {{ $t('manual.startReading') }}
        </a-button>
      </template>
    </PmsPageHeader>

    <div class="manual-layout">
      <aside class="manual-index pms-panel" :aria-label="$t('manual.tocAria')">
        <div class="manual-index__heading">
          <span>{{ $t('manual.toc') }}</span>
          <small>{{ manualSearchQuery.trim() ? $t('manual.tocSearchCount', { count: filteredSections.length }) : $t('manual.tocCount', { count: sections.length }) }}</small>
        </div>
        <label class="manual-index__search">
          <span class="manual-index__search-label">{{ $t('manual.searchLabel') }}</span>
          <input v-model="manualSearchQuery" type="search" :placeholder="$t('manual.searchPlaceholder')" :aria-label="$t('manual.searchAria')" />
        </label>
        <button
          class="manual-index__mobile-toggle"
          type="button"
          :aria-expanded="manualIndexExpanded"
          aria-controls="manual-index-nav"
          @click="manualIndexExpanded = !manualIndexExpanded"
        >
          <span>{{ manualIndexExpanded ? $t('manual.hideIndex') : $t('manual.showIndex') }}</span>
          <DownOutlined :class="{ 'manual-index__mobile-toggle-icon--expanded': manualIndexExpanded }" />
        </button>
        <nav id="manual-index-nav" class="manual-index__nav" :class="{ 'manual-index__nav--mobile-collapsed': !manualIndexExpanded && !manualSearchQuery.trim() }">
          <button
            v-for="section in filteredSections"
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
        <p v-if="!filteredSections.length" class="manual-index__empty">{{ $t('manual.searchEmpty') }}</p>
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

        <nav class="manual-reference-links" :aria-label="$t('manual.referenceNavAria')">
          <RouterLink class="manual-reference-link" to="/manual/business-rules#identity">
            <SafetyCertificateOutlined />
            <span><strong>{{ $t('manual.references.businessRules.title') }}</strong><small>{{ $t('manual.references.businessRules.lead') }}</small></span>
            <span class="manual-reference-link__arrow" aria-hidden="true">→</span>
          </RouterLink>
          <RouterLink class="manual-reference-link" to="/manual/design-system#principles">
            <SettingOutlined />
            <span><strong>{{ $t('manual.references.designSystem.title') }}</strong><small>{{ $t('manual.references.designSystem.lead') }}</small></span>
            <span class="manual-reference-link__arrow" aria-hidden="true">→</span>
          </RouterLink>
        </nav>

        <article v-for="section in sections" :id="section.id" :key="section.id" class="manual-section pms-panel" :aria-labelledby="`${section.id}-title`">
          <header class="manual-section__header">
            <div class="manual-section__title-wrap">
              <div class="manual-section__icon"><component :is="section.icon" /></div>
              <div>
                <div class="manual-section__eyebrow">{{ section.id }}</div>
                <h2 :id="`${section.id}-title`" tabindex="-1">{{ t(section.titleKey) }}</h2>
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
            <section v-if="section.businessLogicKey" class="manual-block manual-block--logic">
              <h3>{{ $t('manual.businessLogic') }}</h3>
              <ul class="manual-list">
                <li v-for="(rule, index) in translateList(section.businessLogicKey)" :key="`${section.id}-logic-${index}`">{{ rule }}</li>
              </ul>
            </section>
            <section v-if="section.roleMatrixKey" class="manual-block manual-role-matrix">
              <h3>{{ $t('manual.roleMatrix') }}</h3>
              <div class="manual-role-matrix__table" role="table" :aria-label="$t('manual.roleMatrix')">
                <div class="manual-role-matrix__row manual-role-matrix__row--head" role="row">
                  <span role="columnheader">{{ $t('manual.roleMatrixColumns.role') }}</span>
                  <span role="columnheader">{{ $t('manual.roleMatrixColumns.permissions') }}</span>
                  <span role="columnheader">{{ $t('manual.roleMatrixColumns.scope') }}</span>
                </div>
                <div v-for="row in translateMatrix(section.roleMatrixKey)" :key="row.code" class="manual-role-matrix__row" role="row">
                  <span role="cell"><strong>{{ row.name }}</strong><small>{{ row.code }}</small></span>
                  <span role="cell">{{ row.permissions }}</span>
                  <span role="cell">{{ row.scope }}</span>
                </div>
              </div>
            </section>
            <section v-if="section.permissionGuideKey" class="manual-block manual-block--guide">
              <h3>{{ $t('manual.permissionGuide') }}</h3>
              <p>{{ $t('manual.permissionGuideHint') }}</p>
              <ul class="manual-list">
                <li v-for="(item, index) in translateList(section.permissionGuideKey)" :key="`${section.id}-guide-${index}`">{{ item }}</li>
              </ul>
            </section>
            <section v-if="section.examplesKey" class="manual-block manual-block--examples">
              <h3>{{ $t('manual.examples') }}</h3>
              <ul class="manual-list">
                <li v-for="(example, index) in translateList(section.examplesKey)" :key="`${section.id}-example-${index}`">{{ example }}</li>
              </ul>
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
