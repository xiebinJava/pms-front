<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { message, Modal } from 'ant-design-vue'
import { ArrowLeftOutlined, FolderOpenOutlined, InfoCircleOutlined, RollbackOutlined } from '@ant-design/icons-vue'
import { getDevelopmentItemWorkflow, updateDevelopmentItemNode, completeDevelopmentItemNode, rollbackDevelopmentItemNode } from '/@/api/development-item'
import { getProjectOrgTree } from '/@/api/admin-org'
import type {
  DevelopmentItemType,
  DevelopmentItemWorkflowDetail,
  DevelopmentItemWorkflowNode,
  OrgUnit,
  RequirementReceivingAnalysisConfig,
  RequirementReceivingAnalysisState,
  RequirementExecutionTargetType,
} from '/@/types/domain'
import { buildBusinessLineOptions } from '/@/views/project/detail/workflow'
import type { BusinessLineOption, PersonOption } from '/@/views/project/detail/workflow'
import PersonSelect from '/@/views/project/detail/components/PersonSelect.vue'
import DevelopmentItemFlow from './components/DevelopmentItemFlow.vue'
import DevelopmentItemWorkflowFields from './components/DevelopmentItemWorkflowFields.vue'
import DevelopmentItemTaskBoard from './components/DevelopmentItemTaskBoard.vue'
import DevelopmentStorySplitComponent from './DevelopmentStorySplitComponent.vue'
import DevelopmentStoryListComponent from './DevelopmentStoryListComponent.vue'
import RequirementExecutionComponent from './RequirementExecutionComponent.vue'
import RequirementDevelopmentTreeComponent from './RequirementDevelopmentTreeComponent.vue'
import RequirementReceivingAnalysisComponent from './RequirementReceivingAnalysisComponent.vue'
import RequirementNodeWorkbenchComponent from './RequirementNodeWorkbenchComponent.vue'
import WorkflowNodeShell from '/@/components/workflow/WorkflowNodeShell.vue'
import WorkflowRuntimeComponentHost from '/@/components/workflow/WorkflowRuntimeComponentHost.vue'
import SourceRequirementList from '/@/components/development/SourceRequirementList.vue'
import { WorkflowRuntimeComponentKey } from '/@/components/workflow/workflow-component-registry'
import { isNodeReadOnly, shouldAutoSaveProfile } from '/@/views/project/detail/workflow'
import { shouldAutoSaveOnBlur } from '/@/views/project/detail/workflow-config.mjs'
import { useUserStore } from '/@/store/user'

const props = defineProps<{ itemType: DevelopmentItemType }>()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const userStore = useUserStore()
const detail = ref<DevelopmentItemWorkflowDetail>()
const members = ref<PersonOption[]>([])
const orgTree = ref<OrgUnit[]>([])
const businessLineOptions = computed<BusinessLineOption[]>(() => buildBusinessLineOptions(orgTree.value))
const loading = ref(false)
const loadError = ref(false)
const savingNode = ref(false)
const nodeFormDirty = ref(false)
const completingNode = ref(false)
const autoCompletedDevelopmentNodeKey = ref('')
const rollingBack = ref(false)
const rollbackModalOpen = ref(false)
const rollbackReason = ref('')
const selectedNodeId = ref<number>()
const selectedNode = computed(() => detail.value?.nodes.find((node) => node.id === selectedNodeId.value))
const requirementTargetSpecification = computed<RequirementExecutionTargetType | undefined>(() => {
  if (props.itemType !== 'requirement' || !detail.value || !selectedNode.value) return undefined
  const orderedNodes = [...detail.value.nodes].sort((left, right) => left.sort - right.sort)
  const currentIndex = orderedNodes.findIndex((node) => node.id === selectedNode.value?.id)
  const previousNode = currentIndex > 0 ? orderedNodes[currentIndex - 1] : undefined
  const components = previousNode?.fieldValues?.__components
  const state = components && typeof components === 'object' && !Array.isArray(components)
    ? (components as Record<string, unknown>)['requirement-node-workbench']
    : undefined
  const specification = state && typeof state === 'object' && !Array.isArray(state)
    ? (state as Record<string, unknown>).requirementSpecification
    : undefined
  return specification === 'PROJECT' || specification === 'TOPIC' || specification === 'STORY' ? specification : undefined
})
const requirementDevelopmentTarget = computed<{ targetType: RequirementExecutionTargetType; targetId: number } | undefined>(() => {
  if (props.itemType !== 'requirement' || !detail.value || !selectedNode.value) return undefined
  const orderedNodes = [...detail.value.nodes].sort((left, right) => left.sort - right.sort)
  const currentIndex = orderedNodes.findIndex((node) => node.id === selectedNode.value?.id)
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const components = orderedNodes[index]?.fieldValues?.__components
    const workbenchState = components && typeof components === 'object' && !Array.isArray(components)
      ? (components as Record<string, unknown>)['requirement-node-workbench']
      : undefined
    if (!workbenchState || typeof workbenchState !== 'object' || Array.isArray(workbenchState)) continue
    const state = workbenchState as Record<string, unknown>
    const targetType = state.targetType
    const targetId = Number(state.targetId)
    if ((targetType === 'PROJECT' || targetType === 'TOPIC' || targetType === 'STORY') && Number.isFinite(targetId)) {
      return { targetType, targetId }
    }
  }
  return undefined
})
const selectedNodeEditable = computed(() => selectedNode.value != null
  && !isNodeReadOnly(selectedNode.value.status) && !detail.value?.terminalStatus)
const requirementTargetWritable = computed(() => props.itemType !== 'requirement' || userStore.can('requirement:write'))
const requirementTargetManageable = computed(() => props.itemType !== 'requirement' || userStore.can('requirement:manage'))
const activeNode = computed(() => detail.value?.nodes.find((node) => node.status === 1))
const itemId = computed(() => Number(route.params.id))
const pageTitle = computed(() => detail.value?.title || t(props.itemType === 'topic'
  ? 'developmentDetail.topicTitle'
  : props.itemType === 'story' ? 'developmentDetail.storyTitle' : 'developmentDetail.requirementTitle'))
const listPath = computed(() => props.itemType === 'topic'
  ? '/development/topics'
  : props.itemType === 'story' ? '/development/stories' : '/development/requirements')
const progressPercent = computed(() => Math.max(0, Math.min(100, detail.value?.workflowProgress || 0)))
const sourceRequirements = computed(() => {
  const current = detail.value
  if (!current) return []
  if (current.sourceRequirements?.length) return current.sourceRequirements
  return current.sourceRequirement ? [current.sourceRequirement] : []
})
const nodeForm = reactive({ ownerId: undefined as number | undefined, startDate: '', endDate: '', fieldValues: {} as Record<string, unknown> })
const nodeFieldsContainer = ref<HTMLElement | null>(null)
let nodeFormEditRevision = 0
let activeNodeSave: Promise<boolean> | null = null
let queuedNodeSave = false

function onScheduleChange(_dates: unknown, dateStrings: string[]) {
  nodeForm.startDate = dateStrings[0] || ''
  nodeForm.endDate = dateStrings[1] || ''
  markNodeFormDirty()
  void saveNode()
}

function setSelectedNode(node?: DevelopmentItemWorkflowNode) {
  selectedNodeId.value = node?.id
  nodeForm.ownerId = node?.ownerId
  nodeForm.startDate = node?.startDate || ''
  nodeForm.endDate = node?.endDate || ''
  nodeForm.fieldValues = { ...(node?.fieldValues || {}) }
  nodeFormDirty.value = false
}

function collectDetailPeople(workflow: DevelopmentItemWorkflowDetail): PersonOption[] {
  const options = new Map<number, PersonOption>()
  const add = (id?: number, label?: string) => {
    if (id == null || !label) return
    options.set(id, { value: id, label })
  }
  const addTasks = (tasks: DevelopmentItemWorkflowNode['tasks']) => {
    tasks.forEach((task) => {
      add(task.assigneeId, task.assigneeName)
      addTasks(task.children || [])
    })
  }
  add(workflow.ownerId, workflow.ownerName)
  workflow.nodes.forEach((node) => {
    add(node.ownerId, node.ownerName)
    addTasks(node.tasks || [])
  })
  return Array.from(options.values())
}

function markNodeFormDirty() {
  nodeFormEditRevision += 1
  nodeFormDirty.value = true
}

function onNodeOwnerChange() {
  markNodeFormDirty()
  void saveNode()
}

function onNodeFieldValuesChange(values: Record<string, unknown>) {
  nodeForm.fieldValues = values
  markNodeFormDirty()
}

function isNodeOverlayTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && Boolean(target.closest('.ant-select-dropdown, .ant-picker-dropdown, .ant-dropdown, .ant-popover, .ant-modal-wrap'))
}

function onDocumentPointerDown(event: PointerEvent) {
  const target = event.target
  const clickedInsideNodeFields = target instanceof Node && Boolean(nodeFieldsContainer.value?.contains(target))
  const clickedInsideOverlay = isNodeOverlayTarget(target)
  if (shouldAutoSaveProfile(nodeFormDirty.value, clickedInsideNodeFields, clickedInsideOverlay)) {
    void saveNode()
  }
}

function onNodeFieldsFocusOut() {
  window.setTimeout(() => {
    if (!shouldAutoSaveOnBlur(nodeFormDirty.value, isNodeOverlayTarget(document.activeElement))) return
    void saveNode()
  }, 0)
}

async function onWorkflowNodeSelect(nodeId: number) {
  if (nodeId === selectedNodeId.value) return
  if (!(await saveNode())) return
  setSelectedNode(detail.value?.nodes.find((node) => node.id === nodeId))
}

async function loadData() {
  const id = itemId.value
  if (!Number.isSafeInteger(id) || id <= 0) {
    loadError.value = true
    message.error(t('developmentDetail.loadFailed'))
    return
  }
  loading.value = true
  loadError.value = false
  try {
    const result = await getDevelopmentItemWorkflow(props.itemType, id)
    orgTree.value = props.itemType === 'requirement' ? await getProjectOrgTree().catch(() => []) : []
    detail.value = result
    setSelectedNode(result.nodes.find((node) => node.status === 1) || result.nodes[0])
    members.value = collectDetailPeople(result)
  } catch (error) {
    loadError.value = true
    message.error(errorMessage(error, t('developmentDetail.loadFailed')))
  } finally {
    loading.value = false
  }
}

function statusKey(status?: string) {
  if (status === 'DONE' || status === 'COMPLETED') return 'done'
  if (status === 'IN_PROGRESS') return 'inProgress'
  if (status === 'TESTING') return 'testing'
  if (status === 'BLOCKED') return 'blocked'
  return 'notStarted'
}

function statusColor(status?: string) {
  if (status === 'DONE' || status === 'COMPLETED') return 'green'
  if (status === 'BLOCKED') return 'red'
  if (status === 'TESTING') return 'blue'
  if (status === 'IN_PROGRESS') return 'orange'
  return 'default'
}

function errorMessage(error: unknown, fallback: string) {
  const text = (error as Error)?.message || ''
  if (text.includes('已被其他人修改') || text.includes('刷新后重试')) return t('developmentDetail.conflict')
  return text || fallback
}

function openSource() {
  if (!detail.value || detail.value.projectId == null || detail.value.sourceNodeId == null) return
  void router.push({ path: `/projects/${detail.value.projectId}`, query: { node: String(detail.value.sourceNodeId) } })
}

function openTopic() {
  if (detail.value?.topicId) void router.push(`/development/topics/${detail.value.topicId}`)
}

function openSourceRequirement(requirementId: number) {
  if (requirementId > 0) void router.push(`/development/requirements/${requirementId}`)
}

function openRequirementTarget() {
  const target = detail.value?.executionTarget
  if (!target || target.navigationId == null) return
  const id = target.navigationId
  const type = target.navigationType || target.targetType.toLowerCase()
  void router.push(type === 'project' ? `/projects/${id}` : type === 'topic' ? `/development/topics/${id}` : `/development/stories/${id}`)
}

function saveNode(): Promise<boolean> {
  if (activeNodeSave) {
    queuedNodeSave = true
    return activeNodeSave
  }
  if (!nodeFormDirty.value) return Promise.resolve(true)
  const node = selectedNode.value
  if (!detail.value || !node || isNodeReadOnly(node.status)) return Promise.resolve(false)
  const requestItemId = detail.value.id
  const requestNodeId = node.id
  const requestItemType = props.itemType
  const editRevision = nodeFormEditRevision
  const payload = {
    ownerId: nodeForm.ownerId,
    startDate: nodeForm.startDate || undefined,
    endDate: nodeForm.endDate || undefined,
    fieldValues: { ...nodeForm.fieldValues },
    version: node.version,
  }
  savingNode.value = true
  let request: Promise<boolean> = Promise.resolve(false)
  request = (async () => {
    try {
      const updated = await updateDevelopmentItemNode(requestItemType, requestItemId, requestNodeId, payload)
      if (detail.value?.id !== requestItemId || props.itemType !== requestItemType) return true
      detail.value = updated
      const savedNode = updated.nodes.find((item) => item.id === requestNodeId)
      if (savedNode && selectedNodeId.value === requestNodeId && nodeFormEditRevision === editRevision) {
        setSelectedNode(savedNode)
      } else if (nodeFormEditRevision === editRevision) {
        nodeFormDirty.value = false
      }
      message.success(t('developmentDetail.nodeSaved'))
      return true
    } catch (error) {
      message.error(errorMessage(error, t('developmentDetail.saveFailed')))
      return false
    } finally {
      savingNode.value = false
      if (activeNodeSave === request) activeNodeSave = null
      if (queuedNodeSave) {
        queuedNodeSave = false
        if (nodeFormDirty.value) void saveNode()
      }
    }
  })()
  activeNodeSave = request
  return request
}

function confirmCompleteNode() {
  const node = selectedNode.value
  if (!detail.value || !node || node.status !== 1) return
  Modal.confirm({
    title: t('developmentDetail.completeNodeTitle'),
    content: t('developmentDetail.completeNodeContent', { name: node.name }),
    okText: t('developmentDetail.completeNodeAction'),
    cancelText: t('common.cancel'),
    onOk: async () => {
      if (!(await saveNode())) return
      completingNode.value = true
      try {
        detail.value = await completeDevelopmentItemNode(props.itemType, detail.value!.id, node.id)
        const next = detail.value.nodes.find((item) => item.status === 1) || node
        setSelectedNode(next)
        message.success(t('developmentDetail.nodeCompleted'))
      } catch (error) {
        message.error(errorMessage(error, t('developmentDetail.completeFailed')))
      } finally {
        completingNode.value = false
      }
    },
  })
}

async function autoCompleteDevelopmentNode() {
  const node = selectedNode.value
  const currentDetail = detail.value
  const target = requirementDevelopmentTarget.value
  if (props.itemType !== 'requirement'
    || !currentDetail
    || !node
    || node.status !== 1
    || currentDetail.terminalStatus
    || !String(node.name || '').includes('需求开发')
    || !target
    || !requirementTargetWritable.value
    || completingNode.value) return

  const completionKey = `${currentDetail.id}:${node.id}:${target.targetType}:${target.targetId}`
  if (autoCompletedDevelopmentNodeKey.value === completionKey) return
  if (!(await saveNode())) return
  if (selectedNode.value?.id !== node.id || selectedNode.value.status !== 1) return

  autoCompletedDevelopmentNodeKey.value = completionKey
  completingNode.value = true
  try {
    detail.value = await completeDevelopmentItemNode(props.itemType, currentDetail.id, node.id)
    const next = detail.value.nodes.find((item) => item.status === 1) || node
    setSelectedNode(next)
    message.success(t('developmentDetail.nodeCompleted'))
  } catch (error) {
    autoCompletedDevelopmentNodeKey.value = ''
    message.error(errorMessage(error, t('developmentDetail.completeFailed')))
  } finally {
    completingNode.value = false
  }
}

function confirmRollbackNode() {
  const node = selectedNode.value
  if (!detail.value || !node || node.status !== 2) return
  rollbackReason.value = ''
  rollbackModalOpen.value = true
}

function closeRollbackModal() {
  if (rollingBack.value) return
  rollbackModalOpen.value = false
  rollbackReason.value = ''
}

async function submitRollbackNode() {
  const reason = rollbackReason.value.trim()
  if (!reason) {
    message.warning(t('developmentDetail.rollbackReasonRequired'))
    return
  }
  const node = selectedNode.value
  if (!detail.value || !node || node.status !== 2) return
  rollingBack.value = true
  try {
    detail.value = await rollbackDevelopmentItemNode(props.itemType, detail.value.id, node.id, reason)
    const target = detail.value.nodes.find((item) => item.id === node.id)
      || detail.value.nodes.find((item) => item.status === 1)
      || detail.value.nodes[0]
    setSelectedNode(target)
    rollbackModalOpen.value = false
    rollbackReason.value = ''
    message.success(t('developmentDetail.nodeRolledBack'))
  } catch (error) {
    message.error(errorMessage(error, t('developmentDetail.rollbackFailed')))
  } finally {
    rollingBack.value = false
  }
}

function onDetailUpdated(next: DevelopmentItemWorkflowDetail) {
  const currentId = selectedNodeId.value
  detail.value = next
  if (!nodeFormDirty.value) {
    setSelectedNode(next.nodes.find((node) => node.id === currentId)
      || next.nodes.find((node) => node.status === 1)
      || next.nodes[0])
  }
}

function onReceivingAnalysisUpdated() {
  void loadData()
}

const receivingAnalysisState = computed(() => {
  const values = selectedNode.value?.fieldValues as { __components?: Record<string, unknown> } | undefined
  return values?.__components?.[WorkflowRuntimeComponentKey.REQUIREMENT_RECEIVING_ANALYSIS] as RequirementReceivingAnalysisState | undefined
})

const receivingAnalysisConfig = computed<RequirementReceivingAnalysisConfig>(() => {
  return {
    showFilter: false,
    showAnalysis: true,
    showDecision: true,
    requireCategory: true,
    showFeasibilityScore: false,
    requireFeasibilityScore: false,
    showRoiScore: false,
    requireRoiScore: false,
    showStrategicFitScore: true,
    requireStrategicFitScore: true,
    requireAnalysisConclusion: false,
    allowReject: true,
  }
})

watch(() => [props.itemType, route.params.id], () => { void loadData() }, { immediate: true })

onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown))
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  if (nodeFormDirty.value) void saveNode()
})
</script>

<template>
  <div class="development-item-detail project-detail-root pms-detail-page">
    <a-spin :spinning="loading">
      <div class="project-detail-page pms-page-stack">
        <div class="detail-breadcrumb">
          <button type="button" class="detail-breadcrumb__back" @click="router.push(listPath)">
            <ArrowLeftOutlined /> {{ t('developmentDetail.backToList') }}
          </button>
          <span class="detail-breadcrumb__separator">/</span>
          <span>{{ t('developmentDetail.eyebrow') }}</span>
        </div>

        <a-alert v-if="loadError && !detail" class="development-item-detail__unconfigured" type="error" show-icon>
          <template #message>{{ t('developmentDetail.loadErrorTitle') }}</template>
          <template #description>{{ t('developmentDetail.loadErrorHint') }} <a-button type="link" size="small" @click="loadData">{{ t('developmentDetail.retry') }}</a-button></template>
        </a-alert>

        <template v-if="detail">
          <section class="development-item-detail__summary project-header pms-detail-panel pms-detail-hero card-surface">
            <div class="project-header__top">
              <div class="project-header__identity">
                <h1>{{ pageTitle }}</h1>
                <a-tag :color="statusColor(detail.developmentStatus)">{{ t(`developmentDetail.developmentStatus.${statusKey(detail.developmentStatus)}`) }}</a-tag>
                <a-tag v-if="detail.workflowConfigured" :color="statusColor(detail.workflowStatus)">{{ t(`developmentDetail.workflowStatus.${detail.workflowStatus}`) }}</a-tag>
              </div>
            </div>

            <div class="project-header__meta development-item-detail__context">
              <div class="project-header__meta-item project-header__meta-item--divider">
                <span>{{ t('developmentDetail.owner') }}：</span><strong>{{ detail.ownerName || t('common.unset') }}</strong>
              </div>
              <div class="project-header__meta-item project-header__meta-item--wide">
                <template v-if="props.itemType === 'requirement' && detail.executionTarget">
                  <span>{{ t('developmentDetail.requirementExecution.targetLabel') }}：</span>
                  <button v-if="detail.executionTarget.navigationId != null" type="button" class="development-item-detail__context-link" @click="openRequirementTarget">{{ detail.executionTarget.title || t('common.unset') }}</button>
                  <span v-else class="development-item-detail__context-unbound">{{ detail.executionTarget.title || t('common.unset') }}</span>
                </template>
                <template v-else-if="detail.projectId != null && detail.sourceNodeId != null">
                  <FolderOpenOutlined />
                  <button type="button" class="development-item-detail__context-link" @click="openSource">{{ detail.projectName || t('common.unset') }}</button>
                  <span class="development-item-detail__context-separator">/</span>
                  <button type="button" class="development-item-detail__context-link" @click="openSource">{{ detail.sourceNodeName || t('common.unset') }}</button>
                </template>
                <span v-else class="development-item-detail__context-unbound">{{ t('developmentList.unboundProject') }}</span>
                <template v-if="props.itemType === 'story' && detail.topicId">
                  <span class="development-item-detail__context-separator">/</span>
                  <button type="button" class="development-item-detail__context-link" @click="openTopic">{{ detail.topicTitle || t('developmentDetail.topicTitle') }}</button>
                </template>
              </div>
              <div v-if="props.itemType !== 'requirement' && sourceRequirements.length" class="project-header__meta-item project-header__meta-item--wide">
                <SourceRequirementList :items="sourceRequirements" @open="openSourceRequirement" />
              </div>
            </div>

            <div class="project-header__insights">
              <div class="project-header__insight development-item-detail__progress">
                <span>{{ t('developmentDetail.workflowProgress') }}</span>
                <strong>{{ detail.workflowProgress }}%</strong>
                <a-progress :percent="progressPercent" :show-info="false" size="small" />
              </div>
              <div class="project-header__insight">
                <span>{{ t('developmentDetail.currentNode') }}</span>
                <strong>{{ activeNode?.name || t('developmentDetail.noActiveNode') }}</strong>
              </div>
              <div v-if="detail.templateVersionNo" class="project-header__insight">
                <span>{{ t('developmentDetail.templateVersion') }}</span>
                <strong>v{{ detail.templateVersionNo }}</strong>
              </div>
            </div>
          </section>

          <a-alert v-if="!detail.workflowConfigured" class="development-item-detail__unconfigured" type="warning" show-icon>
            <template #message>{{ t('developmentDetail.workflowNotConfiguredTitle') }}</template>
            <template #description>{{ t('developmentDetail.workflowNotConfiguredHint') }}</template>
          </a-alert>

          <DevelopmentItemFlow
            v-if="detail.workflowConfigured"
            :nodes="detail.nodes"
            :selected-node-id="selectedNodeId"
            @select="onWorkflowNodeSelect"
          />

          <WorkflowNodeShell
            v-if="detail.workflowConfigured && selectedNode"
            class="node-detail-card pms-detail-panel pms-section-panel card-surface"
            :node-name="selectedNode.name"
            :node-status="selectedNode.status"
            :description="selectedNode.description"
            :deliverable="selectedNode.deliverable"
          >
            <template #header>
              <div class="node-detail-header">
                <div class="node-detail-title">
                  <span class="node-detail-title__dot" :class="`node-detail-title__dot--${selectedNode.status}`" />
                  <div class="node-detail-title__copy">
                    <div class="node-detail-title__heading">
                      <h2>{{ selectedNode.name }}</h2>
                      <a-tag :color="selectedNode.status === 2 ? 'green' : selectedNode.status === 1 ? 'blue' : 'default'">{{ t(`developmentDetail.nodeStatus.${selectedNode.status === 2 ? 'completed' : selectedNode.status === 1 ? 'active' : 'locked'}`) }}</a-tag>
                    </div>
                    <p v-if="selectedNode.description" class="node-detail-title__description">{{ selectedNode.description }}</p>
                    <p v-if="selectedNode.deliverable" class="development-item-detail__deliverable"><InfoCircleOutlined />{{ t('developmentDetail.deliverable') }}：{{ selectedNode.deliverable }}</p>
                  </div>
                </div>
                <div class="node-detail-actions">
                  <a-button
                    v-if="selectedNode.status === 2"
                    class="pms-project-button pms-project-button--secondary"
                    :loading="rollingBack"
                    @click="confirmRollbackNode"
                  ><RollbackOutlined />{{ t('developmentDetail.rollbackNodeAction') }}</a-button>
                  <a-button
                    v-else-if="selectedNode.status === 1 && !detail.terminalStatus"
                    type="primary"
                    class="pms-primary-button pms-project-button pms-project-button--primary"
                    :loading="completingNode"
                    @click="confirmCompleteNode"
                  >{{ t('developmentDetail.completeNodeAction') }}</a-button>
                </div>
              </div>
            </template>

            <template #assignments>
              <div class="node-assignment-row pms-assignment-grid">
              <div class="node-owner-row" role="group" :aria-label="t('developmentDetail.nodeOwner')">
                <span class="node-owner-row__label">{{ t('developmentDetail.nodeOwner') }}</span>
                <div class="node-owner-row__control">
                  <PersonSelect
                    v-model="nodeForm.ownerId"
                    class="node-owner-row__select"
                    :options="members"
                    :remote-search="true"
                    allow-clear
                    :placeholder="t('developmentDetail.assigneePlaceholder')"
                    :disabled="!selectedNodeEditable || savingNode"
                    @change="onNodeOwnerChange"
                  />
                </div>
              </div>

              <div class="node-owner-row node-schedule-row" role="group" :aria-label="t('developmentDetail.nodeSchedule')">
                <span class="node-owner-row__label">{{ t('developmentDetail.nodeSchedule') }}</span>
                <div class="node-owner-row__control">
                  <a-range-picker
                    :value="[nodeForm.startDate || null, nodeForm.endDate || null]"
                    value-format="YYYY-MM-DD"
                    class="node-schedule-picker"
                    :placeholder="[t('developmentDetail.startDate'), t('developmentDetail.endDate')]"
                    :disabled="!selectedNodeEditable || savingNode"
                    @change="onScheduleChange"
                  />
                </div>
              </div>
              </div>
            </template>

            <template #fields>
              <div v-if="selectedNode.fields?.length" ref="nodeFieldsContainer" @focusout.capture="onNodeFieldsFocusOut">
                <DevelopmentItemWorkflowFields
                  :model-value="nodeForm.fieldValues"
                  :fields="selectedNode.fields"
                  :bound-values="selectedNode.boundFieldValues || {}"
                  :person-options="members"
                  :business-line-options="businessLineOptions"
                  :disabled="!selectedNodeEditable || savingNode"
                  @update:model-value="onNodeFieldValuesChange"
                />
              </div>
            </template>

            <template #components>
              <template v-for="componentKey in selectedNode.runtimeComponents || []" :key="componentKey">
                <WorkflowRuntimeComponentHost
                  v-if="props.itemType === 'topic' && componentKey === WorkflowRuntimeComponentKey.STORY_LIST"
                  :component-key="componentKey"
                >
                  <DevelopmentStoryListComponent :topic-id="detail.id" :node-id="selectedNode.id" :can-edit="selectedNodeEditable" />
                </WorkflowRuntimeComponentHost>
                <WorkflowRuntimeComponentHost
                  v-else-if="props.itemType === 'topic' && componentKey === WorkflowRuntimeComponentKey.STORY_SPLIT"
                  :component-key="componentKey"
                >
                  <DevelopmentStorySplitComponent :topic-id="detail.id" :node-id="selectedNode.id" :can-edit="selectedNodeEditable" />
                </WorkflowRuntimeComponentHost>
                <WorkflowRuntimeComponentHost
                  v-else-if="props.itemType === 'requirement' && componentKey === WorkflowRuntimeComponentKey.REQUIREMENT_EXECUTION"
                  :component-key="componentKey"
                >
                  <RequirementDevelopmentTreeComponent
                    v-if="String(selectedNode.name || '').includes('需求开发')"
                    :target-type="requirementDevelopmentTarget?.targetType"
                    :target-id="requirementDevelopmentTarget?.targetId"
                    @all-completed="autoCompleteDevelopmentNode"
                  />
                  <RequirementExecutionComponent
                    v-else
                    :item-id="detail.id"
                    :target="detail.executionTarget"
                    :target-history="detail.executionTargetHistory"
                    :requirement-version="detail.version"
                    :can-write="selectedNodeEditable && requirementTargetWritable"
                    :can-manage="selectedNodeEditable && requirementTargetManageable"
                    @updated="onDetailUpdated"
                  />
                </WorkflowRuntimeComponentHost>
                <WorkflowRuntimeComponentHost
                  v-else-if="props.itemType === 'requirement' && componentKey === WorkflowRuntimeComponentKey.REQUIREMENT_RECEIVING_ANALYSIS"
                  :component-key="componentKey"
                >
                  <RequirementReceivingAnalysisComponent
                    :requirement-id="detail.id"
                    :node-id="selectedNode.id"
                    :node-version="selectedNode.version"
                    :node-status="selectedNode.status"
                    :state="receivingAnalysisState"
                    :config="receivingAnalysisConfig"
                    :terminal-status="detail.terminalStatus"
                    :can-write="requirementTargetWritable && selectedNode.status !== 2"
                    :can-manage="requirementTargetManageable"
                    @updated="onReceivingAnalysisUpdated"
                  />
                </WorkflowRuntimeComponentHost>
                <WorkflowRuntimeComponentHost
                  v-else-if="props.itemType === 'requirement' && componentKey === WorkflowRuntimeComponentKey.REQUIREMENT_NODE_WORKBENCH"
                  :component-key="componentKey"
                >
                  <RequirementDevelopmentTreeComponent
                    v-if="String(selectedNode.name || '').includes('需求开发')"
                    :target-type="requirementDevelopmentTarget?.targetType"
                    :target-id="requirementDevelopmentTarget?.targetId"
                    @all-completed="autoCompleteDevelopmentNode"
                  />
                  <RequirementNodeWorkbenchComponent
                    v-else
                    :node="selectedNode"
                    :component-config="selectedNode.componentConfigs?.[componentKey]"
                    :model-value="nodeForm.fieldValues"
                    :current-requirement-id="detail.id"
                    :target-specification="requirementTargetSpecification"
                    :disabled="!selectedNodeEditable || savingNode"
                    @update:model-value="onNodeFieldValuesChange"
                    @commit="saveNode"
                  />
                </WorkflowRuntimeComponentHost>
                <WorkflowRuntimeComponentHost v-else :component-key="componentKey" />
              </template>
            </template>

            <template #tasks>
              <div class="development-item-detail__task-section">
                <DevelopmentItemTaskBoard :item-type="props.itemType" :item-id="detail.id" :node="selectedNode" :members="members" @updated="onDetailUpdated" />
              </div>
            </template>
          </WorkflowNodeShell>

          <a-modal
            v-model:open="rollbackModalOpen"
            class="pms-project-modal"
            :title="t('developmentDetail.rollbackNodeTitle')"
            :ok-text="t('developmentDetail.rollbackNodeAction')"
            :confirm-loading="rollingBack"
            :mask-closable="!rollingBack"
            :closable="!rollingBack"
            @ok="submitRollbackNode"
            @cancel="closeRollbackModal"
          >
            <p class="rollback-modal__description">{{ t('developmentDetail.rollbackNodeContent') }}</p>
            <div class="rollback-modal__field">
              <div class="rollback-modal__label"><span>*</span> {{ t('developmentDetail.rollbackReasonLabel') }}</div>
              <a-textarea
                v-model:value="rollbackReason"
                :rows="4"
                :maxlength="200"
                show-count
                :disabled="rollingBack"
                :placeholder="t('developmentDetail.rollbackReasonPlaceholder')"
              />
            </div>
          </a-modal>

          <section v-if="props.itemType === 'story' && (detail.blocker || detail.iterationPlanName || detail.storyPoints || detail.latestBuildVersion || detail.testStatus)" class="management-card pms-detail-panel pms-section-panel card-surface">
            <div class="section-title-row pms-section-heading"><h2>{{ t('developmentDetail.developmentInfo') }}</h2></div>
            <div class="development-item-detail__info-grid">
              <div v-if="detail.iterationPlanName"><span>{{ t('developmentDetail.iterationPlan') }}</span><strong>{{ detail.iterationPlanName }}</strong></div>
              <div v-if="detail.storyPoints"><span>{{ t('developmentDetail.storyPoints') }}</span><strong>{{ detail.storyPoints }}</strong></div>
              <div v-if="detail.blocker"><span>{{ t('developmentDetail.blocker') }}</span><strong>{{ detail.blocker }}</strong></div>
            </div>
          </section>
        </template>
      </div>
    </a-spin>
  </div>
</template>

<style scoped>
.development-item-detail { min-width: 0; }
.development-item-detail__summary { padding: 24px 26px 19px; border-radius: var(--pms-detail-radius); box-shadow: var(--pms-detail-shadow); }
.project-header__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.project-header__identity { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; min-width: 0; }
.project-header__identity h1 { overflow: hidden; margin: 0; color: var(--pms-text); font-size: 24px; font-weight: 720; letter-spacing: -.02em; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.project-header__meta,.project-header__insights { display: flex; align-items: baseline; justify-content: flex-start; }
.project-header__meta { flex-wrap: wrap; gap: 9px 25px; min-width: 0; margin-top: 13px; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.project-header__meta-item { display: flex; align-items: baseline; min-width: 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); white-space: nowrap; }
.project-header__meta-item > span { flex: 0 0 auto; }
.project-header__meta-item strong { min-width: 0; overflow: hidden; color: var(--pms-text-strong); font-weight: 650; text-overflow: ellipsis; }
.project-header__meta-item--wide { flex: 0 1 auto; max-width: min(100%, 620px); }
.project-header__meta-item--divider { padding-right: 20px; border-right: 1px solid var(--pms-border-soft); }
.development-item-detail__context { align-items: center; gap: 7px; }
.development-item-detail__context-link { padding: 0; border: 0; background: none; color: var(--pms-primary); cursor: pointer; }
.development-item-detail__context-link:hover { text-decoration: underline; }
.development-item-detail__context-separator { color: var(--pms-text-faint); }
.project-header__insights { align-items: center; flex-wrap: wrap; gap: 24px; margin-top: 19px; padding-top: 17px; border-top: 1px solid var(--pms-border); }
.project-header__insight { display: flex; align-items: baseline; min-width: 0; gap: 8px; }
.project-header__insight > span { color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.project-header__insight > strong { color: var(--pms-text-strong); font-size: 14px; font-weight: 720; }
.development-item-detail__progress { display: grid; grid-template-columns: auto auto; align-items: center; gap: 4px 9px; }
.development-item-detail__progress :deep(.ant-progress) { grid-column: 1 / -1; width: min(260px, 40vw); margin: 0; }
.development-item-detail__unconfigured { border-radius: 8px; }
.detail-breadcrumb { display: flex; align-items: center; gap: 9px; margin-bottom: 14px; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.detail-breadcrumb__back { padding: 0; color: var(--pms-text-muted); font: inherit; background: none; border: 0; cursor: pointer; }
.detail-breadcrumb__back:hover { color: var(--pms-primary); }
.detail-breadcrumb__separator { color: var(--pms-text-faint); }
.node-detail-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; }
.node-detail-title { display: flex; align-items: center; flex: 1 1 auto; gap: 12px; min-width: 0; }
.node-detail-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 8px; }
.node-detail-actions .ant-btn { margin-left: auto; }
.node-detail-title__copy { flex: 1 1 auto; min-width: 0; }
.node-detail-title__heading { display: flex; align-items: center; gap: 10px; min-width: 0; }
.node-detail-title h2 { margin: 0; color: var(--pms-text); font-size: 17px; font-weight: 600; line-height: var(--pms-line-height-tight); }
.node-detail-title__dot { display: inline-flex; flex: 0 0 12px; align-items: center; justify-content: center; width: 12px; height: 12px; border-radius: 50%; }
.node-detail-title__dot--0 { background: var(--pms-status-neutral); }
.node-detail-title__dot--1 { background: var(--pms-status-active); }
.node-detail-title__dot--2 { background: var(--pms-success); }
    .node-detail-title__description { max-width: 100%; margin: 4px 0 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-normal); }
.development-item-detail__deliverable { margin: 7px 0 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-normal); }
.node-assignment-row { display: flex; align-items: flex-end; gap: 24px; margin-top: 16px; }
.node-owner-row { display: flex; align-items: center; flex: 1 1 0; gap: 12px; width: auto; min-width: 0; min-height: 58px; padding: 10px 12px; background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: 8px; }
.node-owner-row__label { flex: 0 0 76px; color: var(--pms-text-muted); font-size: var(--pms-font-size-body); }
.node-owner-row__control { display: flex; flex: 1 1 auto; align-items: center; gap: 8px; width: auto; min-width: 0; }
.node-owner-row__control strong { color: var(--pms-text); font-weight: 600; }
.node-owner-row__select { width: 100%; }
.node-schedule-row { margin-top: 0; }
.node-schedule-picker { width: min(100%, 360px); }
.development-item-detail__task-section { margin-top: 14px; padding-top: 17px; border-top: 1px solid var(--pms-border); }
.development-item-detail__info-grid { display: flex; flex-wrap: wrap; gap: 10px 28px; }
.development-item-detail__info-grid > div { display: grid; gap: 3px; }
.development-item-detail__info-grid span { color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.development-item-detail__info-grid strong { color: var(--pms-text); }
.rollback-modal__description { margin-bottom: 16px; color: var(--pms-text-muted); }
.rollback-modal__field { display: grid; gap: 7px; }
.rollback-modal__label { color: var(--pms-text); font-weight: 600; }
.rollback-modal__label span { color: var(--pms-danger); }
@media (min-width: 1100px) { .development-item-detail__summary { margin-inline: -7px; } }
@media (max-width: 900px) { .project-header__meta,.project-header__insights { align-items: flex-start; flex-wrap: wrap; } .project-header__meta-item--wide { flex: 1 1 100%; } .project-header__meta-item--divider { padding-right: 0; border-right: 0; } }
@media (max-width: 640px) {
  .development-item-detail__summary,.node-detail-card,.management-card { padding: 18px 16px; }
  .project-header__identity,.project-header__meta,.project-header__insights { gap: 12px; }
  .project-header__identity h1 { max-width: 100%; font-size: 21px; white-space: normal; }
  .project-header__meta { display: grid; grid-template-columns: 1fr; gap: 8px; }
  .project-header__meta-item--wide { min-width: 0; flex-wrap: wrap; white-space: normal; }
  .project-header__insights { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .development-item-detail__progress :deep(.ant-progress) { width: min(100%, 360px); }
  .node-detail-header,.section-title-row { align-items: flex-start; flex-direction: column; }
  .node-detail-actions { align-self: stretch; justify-content: flex-end; }
  .node-assignment-row { align-items: stretch; flex-direction: column; gap: 10px; }
  .node-owner-row { align-items: flex-start; flex: 0 1 auto; flex-direction: column; gap: 8px; width: 100%; min-width: 0; min-height: auto; }
  .node-owner-row__label { flex: 0 0 auto; }
  .node-owner-row__control,.node-owner-row__select { width: 100%; }
  .node-schedule-picker { width: 100%; }
}
</style>
