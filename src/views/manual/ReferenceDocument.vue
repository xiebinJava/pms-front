<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { BookOutlined, LinkOutlined } from '@ant-design/icons-vue'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
import { referenceDocuments, type ReferenceDocumentId } from './reference'

const props = defineProps<{ kind: ReferenceDocumentId }>()
const route = useRoute()
const router = useRouter()
const { t, tm } = useI18n()
const referenceDocument = referenceDocuments[props.kind]
const activeSection = ref(referenceDocument.sections[0]?.id ?? '')
const scrollFrame = ref<number | null>(null)

function translateList(key: string): string[] {
  const value = tm(key)
  return Array.isArray(value) ? value.map(String) : []
}

function syncFromHash() {
  const hash = route.hash.replace(/^#/, '')
  if (referenceDocument.sections.some((section) => section.id === hash)) activeSection.value = hash
}

function scrollToSection(id: string) {
  activeSection.value = id
  void router.replace({ path: route.path, hash: `#${id}` })
  nextTick(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

function syncFromScroll() {
  const anchor = Math.min(Math.max(window.innerHeight * 0.3, 150), 260)
  const visible = referenceDocument.sections
    .map((section) => ({ id: section.id, top: window.document.getElementById(section.id)?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY }))
    .filter((section) => Number.isFinite(section.top) && section.top <= anchor)
  const next = visible.at(-1)?.id ?? referenceDocument.sections[0]?.id
  if (!next || next === activeSection.value) return
  activeSection.value = next
  if (route.hash !== `#${next}`) void router.replace({ path: route.path, hash: `#${next}` })
}

function onWindowScroll() {
  if (scrollFrame.value !== null) return
  scrollFrame.value = window.requestAnimationFrame(() => {
    scrollFrame.value = null
    syncFromScroll()
  })
}

onMounted(() => {
  window.addEventListener('scroll', onWindowScroll, { passive: true })
  syncFromHash()
  nextTick(() => {
    if (route.hash) window.document.getElementById(activeSection.value)?.scrollIntoView({ block: 'start' })
    syncFromScroll()
  })
})

watch(() => route.hash, syncFromHash)

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onWindowScroll)
  if (scrollFrame.value !== null) window.cancelAnimationFrame(scrollFrame.value)
})
</script>

<template>
  <div class="reference-document-page pms-page-stack">
    <PmsPageHeader :eyebrow="t(referenceDocument.eyebrowKey)" :title="t(referenceDocument.titleKey)" :description="t(referenceDocument.leadKey)">
      <template #actions>
        <RouterLink class="reference-document__back" to="/manual#quick-start"><BookOutlined />{{ $t('manual.references.backToGuide') }}</RouterLink>
      </template>
    </PmsPageHeader>

    <section class="reference-document__hero pms-panel">
      <div class="reference-document__hero-icon"><LinkOutlined /></div>
      <div>
        <h2>{{ $t('manual.references.overviewTitle') }}</h2>
        <p>{{ t(referenceDocument.purposeKey) }}</p>
      </div>
      <dl>
        <div><dt>{{ $t('manual.references.scopeLabel') }}</dt><dd>{{ t(referenceDocument.scopeKey) }}</dd></div>
        <div><dt>{{ $t('manual.references.sourceLabel') }}</dt><dd>{{ t(referenceDocument.sourceKey) }}</dd></div>
      </dl>
    </section>

    <div class="reference-document__layout">
      <aside class="reference-document__toc pms-panel" :aria-label="$t('manual.references.tocAria')">
        <div class="reference-document__toc-heading">
          <span>{{ $t('manual.references.toc') }}</span>
          <small>{{ $t('manual.references.sectionCount', { count: referenceDocument.sections.length }) }}</small>
        </div>
        <nav>
          <button
            v-for="(section, index) in referenceDocument.sections"
            :key="section.id"
            type="button"
            class="reference-document__toc-item"
            :class="{ 'reference-document__toc-item--active': activeSection === section.id }"
            @click="scrollToSection(section.id)"
          >
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <strong>{{ t(section.titleKey) }}</strong>
          </button>
        </nav>
      </aside>

      <main class="reference-document__content" :aria-label="t(referenceDocument.titleKey)">
        <section v-for="(section, index) in referenceDocument.sections" :id="section.id" :key="section.id" class="reference-document__section pms-panel">
          <header class="reference-document__section-heading">
            <div>
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <h2>{{ t(section.titleKey) }}</h2>
            </div>
            <p>{{ t(section.summaryKey) }}</p>
          </header>
          <div class="reference-document__section-grid">
            <div>
              <h3>{{ $t('manual.references.rulesTitle') }}</h3>
              <ul class="reference-document__list">
                <li v-for="(rule, ruleIndex) in translateList(section.rulesKey)" :key="`${section.id}-rule-${ruleIndex}`">{{ rule }}</li>
              </ul>
            </div>
            <aside class="reference-document__examples">
              <h3>{{ $t('manual.references.examplesTitle') }}</h3>
              <ul>
                <li v-for="(example, exampleIndex) in translateList(section.examplesKey)" :key="`${section.id}-example-${exampleIndex}`">{{ example }}</li>
              </ul>
            </aside>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>
