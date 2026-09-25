<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

type PreviewBlockKind = 'table' | 'split' | 'form' | 'board'

interface PreviewBlock {
  key: string
  kind: PreviewBlockKind
  columns: string[]
  titleKey?: string
  hintKey?: string
  actionKey?: string
  emptyKey?: string
  columnKeys?: Record<string, string>
}

interface PreviewLayout {
  metrics: string[]
  blocks: PreviewBlock[]
  titleKey?: string
  hintKey?: string
  metricKeys?: Record<string, string>
}

const props = defineProps<{
  componentKey: string
}>()

const { t } = useI18n()
const isRequirementScope = computed(() => props.componentKey === 'requirement-scope')

const PREVIEW_LAYOUTS: Record<string, PreviewLayout> = {
  'requirement-scope': {
    metrics: ['total', 'inScope', 'outScope'],
    blocks: [
      { key: 'scope', kind: 'split', columns: ['inScope', 'outScope'] },
      { key: 'requirements', kind: 'table', columns: ['requirement', 'priority', 'status'] },
    ],
  },
  'solution-design': {
    titleKey: 'detail.solutionDesign.title',
    hintKey: 'detail.solutionDesign.description',
    metrics: ['package', 'reviews', 'decision'],
    metricKeys: {
      package: 'detail.solutionDesign.package.title',
      reviews: 'detail.solutionDesign.reviews.title',
      decision: 'detail.solutionDesign.decision.title',
    },
    blocks: [
      {
        key: 'solution', kind: 'form', titleKey: 'detail.solutionDesign.package.title', columns: ['productSolution', 'technicalSolution'],
        columnKeys: { productSolution: 'detail.solutionDesign.package.productSolution', technicalSolution: 'detail.solutionDesign.package.technicalSolution' },
      },
      {
        key: 'review', kind: 'table', titleKey: 'detail.solutionDesign.reviews.title', hintKey: 'detail.solutionDesign.reviews.hint',
        columns: ['reviewer', 'decision', 'suggestion'],
        columnKeys: { reviewer: 'admin.workflow.workbenchPreview.layouts.solution-design.columns.reviewer', decision: 'admin.workflow.workbenchPreview.layouts.solution-design.columns.decision', suggestion: 'detail.solutionDesign.reviews.suggestion' },
      },
      {
        key: 'decision', kind: 'form', titleKey: 'detail.solutionDesign.decision.title', hintKey: 'detail.solutionDesign.decision.hint',
        columns: ['result', 'date', 'conditions'],
        columnKeys: { result: 'detail.solutionDesign.decision.result', date: 'detail.solutionDesign.decision.date', conditions: 'detail.solutionDesign.decision.conditions' },
      },
    ],
  },
  'plan-resource-risk': {
    titleKey: 'detail.planResourceRisk.title',
    hintKey: 'detail.planResourceRisk.description',
    metrics: ['iterations', 'resources', 'risks'],
    metricKeys: {
      iterations: 'detail.planResourceRisk.iterationTitle',
      resources: 'detail.planResourceRisk.resourceTitle',
      risks: 'detail.planResourceRisk.riskTitle',
    },
    blocks: [
      {
        key: 'iteration', kind: 'table', titleKey: 'detail.planResourceRisk.iterationTitle', hintKey: 'detail.planResourceRisk.iterationHint', actionKey: 'detail.planResourceRisk.addIteration',
        emptyKey: 'detail.planResourceRisk.noIterations', columns: ['iterationName', 'owner', 'iterationGoal', 'status', 'iterationSchedule'],
        columnKeys: { iterationName: 'detail.planResourceRisk.iterationName', owner: 'detail.planResourceRisk.owner', iterationGoal: 'detail.planResourceRisk.iterationGoal', status: 'detail.planResourceRisk.statusLabel', iterationSchedule: 'detail.planResourceRisk.iterationSchedule' },
      },
      {
        key: 'resource', kind: 'table', titleKey: 'detail.planResourceRisk.resourceTitle', hintKey: 'detail.planResourceRisk.resourceHint', actionKey: 'detail.planResourceRisk.addResource',
        emptyKey: 'detail.planResourceRisk.noResources', columns: ['role', 'owner', 'focus', 'status'],
        columnKeys: { role: 'detail.planResourceRisk.role', owner: 'detail.planResourceRisk.owner', focus: 'detail.planResourceRisk.focus', status: 'detail.planResourceRisk.statusLabel' },
      },
      {
        key: 'risk', kind: 'table', titleKey: 'detail.planResourceRisk.riskTitle', hintKey: 'detail.planResourceRisk.riskHint', actionKey: 'detail.planResourceRisk.addRisk',
        emptyKey: 'detail.planResourceRisk.noRisks', columns: ['risk', 'level', 'owner', 'response', 'status'],
        columnKeys: { risk: 'detail.planResourceRisk.risk', level: 'detail.planResourceRisk.level', owner: 'detail.planResourceRisk.owner', response: 'detail.planResourceRisk.response', status: 'detail.planResourceRisk.statusLabel' },
      },
    ],
  },
  'development-control': {
    metrics: ['progress', 'topics', 'stories', 'blockedStories'],
    metricKeys: { progress: 'admin.workflow.workbenchPreview.layouts.development-control.metrics.progress', topics: 'admin.workflow.workbenchPreview.layouts.development-control.metrics.topics', stories: 'admin.workflow.workbenchPreview.layouts.development-control.metrics.stories', blockedStories: 'admin.workflow.workbenchPreview.layouts.development-control.metrics.blockedStories' },
    blocks: [{ key: 'topics', kind: 'table', titleKey: 'admin.workflow.workbenchPreview.layouts.development-control.blocks.topics', hintKey: 'admin.workflow.workbenchPreview.layouts.development-control.blocks.topicsHint', columns: ['topic', 'progress', 'storySummary', 'status', 'owner'], columnKeys: { topic: 'admin.workflow.workbenchPreview.layouts.development-control.columns.topic', progress: 'admin.workflow.workbenchPreview.layouts.development-control.columns.progress', storySummary: 'admin.workflow.workbenchPreview.layouts.development-control.columns.storySummary', status: 'admin.workflow.workbenchPreview.layouts.development-control.columns.status', owner: 'admin.workflow.workbenchPreview.layouts.development-control.columns.owner' } }],
  },
  'story-list': {
    metrics: ['total', 'inProgress', 'testing', 'blocked', 'done'],
    metricKeys: { total: 'developmentDetail.storyListTotal', inProgress: 'developmentDetail.storyListInProgress', testing: 'developmentDetail.storyListTesting', blocked: 'developmentDetail.storyListBlocked', done: 'developmentDetail.storyListDone' },
    blocks: [{ key: 'stories', kind: 'table', titleKey: 'developmentDetail.storyListTitle', hintKey: 'developmentDetail.storyListSearch', columns: ['story', 'owner', 'points', 'dueDate', 'progress', 'status'], columnKeys: { story: 'admin.workflow.workbenchPreview.layouts.story-list.columns.story', owner: 'developmentDetail.storyListOwner', points: 'developmentDetail.storyListPoints', dueDate: 'developmentDetail.storyListDueDate', progress: 'developmentDetail.storyListProgress', status: 'admin.workflow.workbenchPreview.layouts.story-list.columns.status' } }],
  },
  'business-acceptance': {
    titleKey: 'detail.acceptance.title',
    hintKey: 'detail.acceptance.description',
    metrics: ['acceptanceItems', 'defects', 'passRate'],
    metricKeys: { acceptanceItems: 'detail.acceptance.itemsTitle', defects: 'detail.acceptance.defectsTitle', passRate: 'detail.acceptance.itemsPassed' },
    blocks: [
      { key: 'acceptance', kind: 'table', titleKey: 'detail.acceptance.itemsTitle', hintKey: 'detail.acceptance.itemsHint', emptyKey: 'detail.acceptance.noItems', columns: ['code', 'requirement', 'criteria', 'itemResult', 'note'], columnKeys: { code: 'detail.acceptance.code', requirement: 'detail.acceptance.requirement', criteria: 'detail.acceptance.criteria', itemResult: 'detail.acceptance.itemResult', note: 'detail.acceptance.note' } },
      { key: 'defect', kind: 'table', titleKey: 'detail.acceptance.defectsTitle', hintKey: 'detail.acceptance.defectsHint', emptyKey: 'detail.acceptance.noDefects', columns: ['defectKey', 'defectTitle', 'defectSeverity', 'defectStatus', 'defectImpact'], columnKeys: { defectKey: 'detail.acceptance.defectKey', defectTitle: 'detail.acceptance.defectTitle', defectSeverity: 'detail.acceptance.defectSeverity', defectStatus: 'detail.acceptance.defectStatus', defectImpact: 'detail.acceptance.defectImpact' } },
      { key: 'decision', kind: 'form', titleKey: 'detail.acceptance.decisionTitle', hintKey: 'detail.acceptance.decisionHint', columns: ['result', 'residualItems'], columnKeys: { result: 'detail.acceptance.result', residualItems: 'detail.acceptance.residualItems' } },
    ],
  },
  'release-handover': {
    titleKey: 'detail.release.title',
    metrics: ['release', 'decision', 'handover'],
    metricKeys: { release: 'detail.release.infoTitle', decision: 'detail.release.decisionTitle', handover: 'detail.release.handoverTitle' },
    blocks: [
      { key: 'releaseInfo', kind: 'form', titleKey: 'detail.release.infoTitle', hintKey: 'detail.release.infoHint', columns: ['version', 'window', 'type'], columnKeys: { version: 'detail.release.version', window: 'detail.release.window', type: 'detail.release.type' } },
      { key: 'decision', kind: 'form', titleKey: 'detail.release.decisionTitle', hintKey: 'detail.release.decisionHint', columns: ['result', 'decisionNote'], columnKeys: { result: 'detail.release.result', decisionNote: 'detail.release.decisionNote' } },
      { key: 'handoverItems', kind: 'form', titleKey: 'detail.release.handoverTitle', hintKey: 'detail.release.handoverHint', columns: ['handoverNotes', 'observationItems', 'emergencyContact'], columnKeys: { handoverNotes: 'detail.release.handoverNotes', observationItems: 'detail.release.observationItems', emergencyContact: 'detail.release.emergencyContact' } },
    ],
  },
  'value-review': {
    titleKey: 'detail.valueReview.title',
    metrics: ['value', 'retrospective'],
    metricKeys: { value: 'detail.valueReview.valueTitle', retrospective: 'detail.valueReview.retrospectiveTitle' },
    blocks: [
      { key: 'results', kind: 'form', titleKey: 'detail.valueReview.valueTitle', hintKey: 'detail.valueReview.valueHint', columns: ['result', 'actualResult'], columnKeys: { result: 'detail.valueReview.result', actualResult: 'detail.valueReview.actualResult' } },
      { key: 'review', kind: 'form', titleKey: 'detail.valueReview.retrospectiveTitle', hintKey: 'detail.valueReview.retrospectiveHint', columns: ['retrospectiveConclusion', 'followUpActions'], columnKeys: { retrospectiveConclusion: 'detail.valueReview.retrospectiveConclusion', followUpActions: 'detail.valueReview.followUpActions' } },
    ],
  },
  'knowledge-standard': {
    metrics: ['assets', 'actions', 'completion'],
    blocks: [
      { key: 'assets', kind: 'table', titleKey: 'admin.workflow.workbenchPreview.layouts.knowledge-standard.blocks.assets', hintKey: 'admin.workflow.workbenchPreview.layouts.knowledge-standard.blocks.assetsHint', actionKey: 'admin.workflow.workbenchPreview.layouts.knowledge-standard.actions.addAsset', columns: ['asset', 'type', 'improvement', 'status'], columnKeys: { asset: 'admin.workflow.workbenchPreview.layouts.knowledge-standard.columns.asset', type: 'admin.workflow.workbenchPreview.layouts.knowledge-standard.columns.type', improvement: 'admin.workflow.workbenchPreview.layouts.knowledge-standard.columns.improvement', status: 'admin.workflow.workbenchPreview.layouts.knowledge-standard.columns.status' } },
      { key: 'actions', kind: 'table', titleKey: 'admin.workflow.workbenchPreview.layouts.knowledge-standard.blocks.actions', hintKey: 'admin.workflow.workbenchPreview.layouts.knowledge-standard.blocks.actionsHint', actionKey: 'admin.workflow.workbenchPreview.layouts.knowledge-standard.actions.addAction', columns: ['action', 'owner', 'dueDate', 'status'], columnKeys: { action: 'admin.workflow.workbenchPreview.layouts.knowledge-standard.columns.action', owner: 'admin.workflow.workbenchPreview.layouts.knowledge-standard.columns.owner', dueDate: 'admin.workflow.workbenchPreview.layouts.knowledge-standard.columns.dueDate', status: 'admin.workflow.workbenchPreview.layouts.knowledge-standard.columns.status' } },
    ],
  },
  'story-split': {
    metrics: ['stories', 'inProgress', 'completed'],
    blocks: [{ key: 'stories', kind: 'table', columns: ['story', 'owner', 'status'] }],
  },
}

const layout = computed<PreviewLayout>(() => PREVIEW_LAYOUTS[props.componentKey] || {
  metrics: ['items', 'progress', 'status'],
  blocks: [{ key: 'content', kind: 'table', columns: ['item', 'owner', 'status'] }],
})

function previewText(path: string): string {
  return t(`admin.workflow.workbenchPreview.layouts.${props.componentKey}.${path}`)
}

function textForKey(key: string): string {
  return t(key)
}

function layoutTitle(): string {
  return layout.value.titleKey ? textForKey(layout.value.titleKey) : t('admin.workflow.workbenchPreview.structureTitle')
}

function layoutHint(): string {
  return layout.value.hintKey ? textForKey(layout.value.hintKey) : componentHint()
}

function metricText(metric: string): string {
  return layout.value.metricKeys?.[metric] ? textForKey(layout.value.metricKeys[metric]) : previewText(`metrics.${metric}`)
}

function blockTitle(block: PreviewBlock): string {
  return block.titleKey ? textForKey(block.titleKey) : previewText(`blocks.${block.key}`)
}

function blockHint(block: PreviewBlock): string | undefined {
  return block.hintKey ? textForKey(block.hintKey) : undefined
}

function blockAction(block: PreviewBlock): string | undefined {
  return block.actionKey ? textForKey(block.actionKey) : undefined
}

function blockEmpty(block: PreviewBlock): string {
  return block.emptyKey ? textForKey(block.emptyKey) : t('admin.workflow.workbenchPreview.emptyState')
}

function columnText(block: PreviewBlock, column: string): string {
  const key = block.columnKeys?.[column]
  return key ? textForKey(key) : previewText(`columns.${column}`)
}

function componentLabel(): string {
  return t(`admin.workflow.componentLabels.${props.componentKey}`)
}

function componentHint(): string {
  return t(`admin.workflow.componentHints.${props.componentKey}`)
}
</script>

<template>
  <section class="workflow-workbench-preview" :data-workbench-preview="componentKey" :aria-label="componentLabel()">
    <header class="workflow-workbench-preview__header">
      <div class="workflow-workbench-preview__heading">
        <span>{{ componentLabel() }}</span>
        <strong>{{ isRequirementScope ? $t('detail.requirementScope.scopeTitle') : layoutTitle() }}</strong>
        <p>{{ isRequirementScope ? $t('detail.requirementScope.scopeHint') : layoutHint() }}</p>
      </div>
      <a-tag color="blue">{{ $t('admin.workflow.workbenchPreview.readOnly') }}</a-tag>
    </header>

    <p v-if="!isRequirementScope" class="workflow-workbench-preview__hint">{{ $t('admin.workflow.workbenchPreview.readOnlyHint') }}</p>

    <template v-if="isRequirementScope">
      <span class="workflow-workbench-preview__actual-count">0 {{ $t('detail.requirementScope.items') }}</span>

      <section class="workflow-workbench-preview__actual-block">
        <div class="workflow-workbench-preview__actual-heading">
          <strong>{{ $t('detail.requirementScope.scopeTitle') }}</strong>
          <span>{{ $t('admin.workflow.workbenchPreview.structureOnly') }}</span>
        </div>
        <div class="workflow-workbench-preview__scope-columns">
          <div class="workflow-workbench-preview__scope-list">
            <div class="workflow-workbench-preview__scope-heading">
              <strong>{{ $t('detail.requirementScope.inScope') }}</strong>
              <span class="workflow-workbench-preview__disabled-action">+ {{ $t('detail.requirementScope.add') }}</span>
            </div>
            <span class="workflow-workbench-preview__empty">{{ $t('detail.requirementScope.empty') }}</span>
          </div>
          <div class="workflow-workbench-preview__scope-list workflow-workbench-preview__scope-list--out">
            <div class="workflow-workbench-preview__scope-heading">
              <strong>{{ $t('detail.requirementScope.outScope') }}</strong>
              <span class="workflow-workbench-preview__disabled-action">+ {{ $t('detail.requirementScope.add') }}</span>
            </div>
            <span class="workflow-workbench-preview__empty">{{ $t('detail.requirementScope.empty') }}</span>
          </div>
        </div>
      </section>

      <section class="workflow-workbench-preview__actual-block workflow-workbench-preview__actual-block--requirements">
        <div class="workflow-workbench-preview__actual-heading">
          <div>
            <strong>{{ $t('detail.requirementScope.requirementsTitle') }}</strong>
            <p>{{ $t('detail.requirementScope.requirementsHint') }}</p>
          </div>
          <span class="workflow-workbench-preview__disabled-primary">+ {{ $t('detail.requirementScope.addRequirement') }}</span>
        </div>
        <div class="workflow-workbench-preview__requirements-table">
          <div class="workflow-workbench-preview__requirements-head">
            <span>{{ $t('detail.requirementScope.code') }}</span>
            <span>{{ $t('detail.requirementScope.name') }}</span>
            <span>{{ $t('detail.requirementScope.type') }}</span>
            <span>{{ $t('detail.requirementScope.priority') }}</span>
            <span>{{ $t('detail.requirementScope.acceptance') }}</span>
            <span>{{ $t('detail.requirementScope.statusLabel') }}</span>
            <span>{{ $t('detail.requirementScope.actions') }}</span>
          </div>
          <span class="workflow-workbench-preview__empty">{{ $t('detail.requirementScope.noRequirements') }}</span>
        </div>
      </section>
    </template>

    <template v-else>
      <div class="workflow-workbench-preview__metrics">
        <div v-for="metric in layout.metrics" :key="metric">
          <span>{{ metricText(metric) }}</span>
          <strong>—</strong>
        </div>
      </div>

      <div class="workflow-workbench-preview__blocks">
        <section v-for="block in layout.blocks" :key="block.key" class="workflow-workbench-preview__block">
          <div class="workflow-workbench-preview__block-heading">
            <div>
              <strong>{{ blockTitle(block) }}</strong>
              <p v-if="blockHint(block)">{{ blockHint(block) }}</p>
            </div>
            <span v-if="blockAction(block)" class="workflow-workbench-preview__disabled-action">+ {{ blockAction(block) }}</span>
            <span v-else>{{ $t('admin.workflow.workbenchPreview.structureOnly') }}</span>
          </div>

          <div v-if="block.kind === 'table'" class="workflow-workbench-preview__table" :style="{ '--preview-columns': block.columns.length }">
            <div class="workflow-workbench-preview__table-head">
              <span v-for="column in block.columns" :key="column">{{ columnText(block, column) }}</span>
            </div>
            <div class="workflow-workbench-preview__table-row" aria-hidden="true">
              <i v-for="column in block.columns" :key="column" />
            </div>
            <small>{{ blockEmpty(block) }}</small>
          </div>

          <div v-else-if="block.kind === 'split'" class="workflow-workbench-preview__split">
            <div v-for="column in block.columns" :key="column">
              <strong>{{ columnText(block, column) }}</strong>
              <span>{{ blockEmpty(block) }}</span>
            </div>
          </div>

          <div v-else-if="block.kind === 'board'" class="workflow-workbench-preview__board">
            <div v-for="column in block.columns" :key="column">
              <strong>{{ columnText(block, column) }}</strong>
              <span>{{ blockEmpty(block) }}</span>
            </div>
          </div>

          <div v-else class="workflow-workbench-preview__form">
            <div v-for="column in block.columns" :key="column">
              <span>{{ columnText(block, column) }}</span>
              <i>{{ $t('admin.workflow.workbenchPreview.readOnlyValue') }}</i>
            </div>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.workflow-workbench-preview { display: grid; gap: var(--pms-space-3); min-width: 0; padding: var(--pms-space-3); background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: var(--pms-radius); }
.workflow-workbench-preview__header, .workflow-workbench-preview__block-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--pms-space-3); }
.workflow-workbench-preview__heading { display: grid; gap: var(--pms-space-2); min-width: 0; }
.workflow-workbench-preview__heading > span { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.workflow-workbench-preview__heading strong { color: var(--pms-text); font-size: var(--pms-font-size-compact); }
.workflow-workbench-preview__heading p, .workflow-workbench-preview__hint { margin: 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); line-height: var(--pms-line-height-normal); }
.workflow-workbench-preview__header :deep(.ant-tag) { flex: 0 0 auto; margin: 0; font-size: var(--pms-font-size-caption); }
.workflow-workbench-preview__hint { padding: var(--pms-space-2) var(--pms-space-3); color: var(--pms-primary); background: var(--pms-primary-soft); border-radius: var(--pms-radius-sm); }
.workflow-workbench-preview__actual-count { justify-self: end; color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.workflow-workbench-preview__actual-block { display: grid; gap: var(--pms-space-3); padding: var(--pms-space-3); background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); }
.workflow-workbench-preview__actual-block--requirements { padding-top: var(--pms-space-2); }
.workflow-workbench-preview__actual-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--pms-space-3); }
.workflow-workbench-preview__actual-heading > div { display: grid; gap: var(--pms-space-2); min-width: 0; }
.workflow-workbench-preview__actual-heading strong { color: var(--pms-text); font-size: var(--pms-font-size-compact); }
.workflow-workbench-preview__actual-heading p { margin: 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); line-height: var(--pms-line-height-normal); }
.workflow-workbench-preview__actual-heading > span { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); white-space: nowrap; }
.workflow-workbench-preview__scope-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--pms-space-2); }
.workflow-workbench-preview__scope-list { display: grid; align-content: start; gap: var(--pms-space-2); min-height: var(--pms-space-8); padding: var(--pms-space-3); border: 1px solid var(--pms-border); border-top: 3px solid var(--pms-primary); border-radius: var(--pms-radius-sm); }
.workflow-workbench-preview__scope-list--out { border-top-color: var(--pms-border-strong); }
.workflow-workbench-preview__scope-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--pms-space-2); padding-bottom: var(--pms-space-2); border-bottom: 1px solid var(--pms-border); }
.workflow-workbench-preview__scope-heading strong { color: var(--pms-text); font-size: var(--pms-font-size-caption); }
.workflow-workbench-preview__disabled-action, .workflow-workbench-preview__disabled-primary { color: var(--pms-primary); font-size: var(--pms-font-size-caption); }
.workflow-workbench-preview__disabled-primary { padding: var(--pms-space-2); background: var(--pms-primary-soft); border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); }
.workflow-workbench-preview__empty { display: grid; min-height: var(--pms-space-8); place-items: center; color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); text-align: center; }
.workflow-workbench-preview__requirements-table { display: grid; overflow: hidden; border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); }
.workflow-workbench-preview__requirements-head { display: grid; grid-template-columns: repeat(7, minmax(72px, 1fr)); gap: var(--pms-space-2); padding: var(--pms-space-2); color: var(--pms-text-muted); background: var(--pms-surface-muted); font-size: var(--pms-font-size-caption); font-weight: 650; }
.workflow-workbench-preview__requirements-table > .workflow-workbench-preview__empty { min-height: var(--pms-space-8); padding: var(--pms-space-2); border-top: 1px solid var(--pms-border); }
.workflow-workbench-preview__metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); overflow: hidden; background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); }
.workflow-workbench-preview__metrics > div { display: grid; gap: var(--pms-space-2); min-width: 0; padding: var(--pms-space-2) var(--pms-space-3); border-left: 1px solid var(--pms-border); }
.workflow-workbench-preview__metrics > div:first-child { border-left: 0; }
.workflow-workbench-preview__metrics span, .workflow-workbench-preview__block-heading span { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.workflow-workbench-preview__metrics strong { color: var(--pms-text); font-size: var(--pms-font-size-body); }
.workflow-workbench-preview__blocks { display: grid; gap: var(--pms-space-2); }
.workflow-workbench-preview__block { display: grid; gap: var(--pms-space-2); min-width: 0; padding: var(--pms-space-3); background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); }
.workflow-workbench-preview__block-heading strong { color: var(--pms-text); font-size: var(--pms-font-size-compact); }
.workflow-workbench-preview__block-heading p { margin: var(--pms-space-1) 0 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); line-height: var(--pms-line-height-normal); }
.workflow-workbench-preview__table { display: grid; gap: 0; overflow-x: auto; border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); }
.workflow-workbench-preview__table-head, .workflow-workbench-preview__table-row { display: grid; grid-template-columns: repeat(var(--preview-columns, 4), minmax(96px, 1fr)); min-width: max-content; gap: var(--pms-space-2); align-items: center; padding: var(--pms-space-2); }
.workflow-workbench-preview__table-head { color: var(--pms-text-muted); background: var(--pms-surface-muted); font-size: var(--pms-font-size-caption); font-weight: 650; }
.workflow-workbench-preview__table-row { border-top: 1px solid var(--pms-border); }
.workflow-workbench-preview__table-row i { display: block; height: var(--pms-space-2); background: var(--pms-border); border-radius: var(--pms-radius-sm); }
.workflow-workbench-preview__table small { padding: var(--pms-space-2); color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.workflow-workbench-preview__split, .workflow-workbench-preview__board { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--pms-space-2); }
.workflow-workbench-preview__split > div, .workflow-workbench-preview__board > div { display: grid; gap: var(--pms-space-2); min-height: var(--pms-space-8); padding: var(--pms-space-2); background: var(--pms-surface-muted); border: 1px dashed var(--pms-border-strong); border-radius: var(--pms-radius-sm); }
.workflow-workbench-preview__split strong, .workflow-workbench-preview__board strong { color: var(--pms-text); font-size: var(--pms-font-size-caption); }
.workflow-workbench-preview__split span, .workflow-workbench-preview__board span { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.workflow-workbench-preview__form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--pms-space-2); }
.workflow-workbench-preview__form > div { display: grid; gap: var(--pms-space-2); min-width: 0; padding: var(--pms-space-2); background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); }
.workflow-workbench-preview__form span { color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); }
.workflow-workbench-preview__form i { overflow: hidden; color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); font-style: normal; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 700px) {
  .workflow-workbench-preview__scope-columns { grid-template-columns: minmax(0, 1fr); }
  .workflow-workbench-preview__requirements-table { overflow-x: auto; }
  .workflow-workbench-preview__requirements-head { min-width: 560px; }
  .workflow-workbench-preview__metrics, .workflow-workbench-preview__form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .workflow-workbench-preview__table { overflow-x: auto; }
  .workflow-workbench-preview__table-head, .workflow-workbench-preview__table-row { min-width: 420px; }
}
</style>
