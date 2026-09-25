<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { Component } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  PlusOutlined, EyeOutlined, SaveOutlined, SendOutlined, ArrowUpOutlined, ArrowDownOutlined, DeleteOutlined,
  CloseOutlined, FileTextOutlined, AlignLeftOutlined, FieldNumberOutlined, CheckCircleOutlined, DownOutlined,
  UnorderedListOutlined, UserOutlined, TeamOutlined, CalendarOutlined, SwapOutlined, PaperClipOutlined, CheckOutlined, InfoCircleOutlined,
} from '@ant-design/icons-vue'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
import { useUserStore } from '/@/store/user'
import {
  createWorkflowProjectType,
  createWorkflowTemplate,
  archiveWorkflowTemplate,
  archiveWorkflowTemplateVersion,
  getWorkflowProjectNodeOptions,
  getWorkflowTopicNodeOptions,
  getWorkflowTemplate,
  listWorkflowProjectTypes,
  listWorkflowTemplates,
  publishWorkflowTemplate,
  saveWorkflowTemplateDraft,
  setWorkflowDefault,
} from '/@/api/admin-workflow'
import type { ProjectType, WorkflowContentOrderItem, WorkflowFieldBinding, WorkflowFieldDefinition, WorkflowFieldType, WorkflowNodeDefinitionV2, WorkflowProjectNodeOption, WorkflowTemplateDefinitionV2, WorkflowTemplateSummary, WorkflowTemplateVersionSummary } from '/@/types/workflow'
import { isWorkflowFieldFullWidth } from '/@/utils/workflow-field-layout.mjs'
import {
  FIXED_NODE_BLOCKS,
  addWorkflowField,
  buildProjectTypeCreatePayload,
  createWorkflowNode,
  getWorkflowTemplateEntryStep,
  normalizeWorkflowDefinitionForProcessType,
  moveWorkflowContentItem,
  moveWorkflowField,
  moveWorkflowNode,
  removeWorkflowField,
  removeWorkflowNode,
  setTopicSourceProjectNodeKey,
  setStorySourceTopicNodeKey,
} from './workflow-template-model.mjs'
import { PROJECT_FIELD_BINDINGS } from './workflow-template-schema.mjs'

const { t } = useI18n()
const userStore = useUserStore()
const canWrite = computed(() => userStore.can('admin:workflow:write'))
const loading = ref(false)
const saving = ref(false)
const types = ref<ProjectType[]>([])
const templates = ref<WorkflowTemplateSummary[]>([])
const workflowProjectNodeOptions = ref<WorkflowProjectNodeOption[]>([])
const workflowProjectNodeOptionsLoading = ref(false)
const workflowTopicNodeOptions = ref<WorkflowProjectNodeOption[]>([])
const workflowTopicNodeOptionsLoading = ref(false)
const selectedTypeId = ref<number>()
const selectedTemplateId = ref<number | null>(null)
const selectedNodeKey = ref('')
const selectedFieldKey = ref('')
const templateName = ref('')
const templateDescription = ref('')
const definition = ref<WorkflowTemplateDefinitionV2>({ schemaVersion: 2, nodes: [] })
const dirty = ref(false)
const dragKey = ref<string>()
const deleteHoverKey = ref<string>()
const contentDragItem = ref<WorkflowContentOrderItem>()
const fieldDragKey = ref<string>()
const previewOpen = ref(false)
const versionModalOpen = ref(false)
const typeModalOpen = ref(false)
const mobileInspectorOpen = ref(false)
const mobileInspectorPanel = ref<HTMLElement>()
const mobileInspectorTrigger = ref<HTMLElement>()
const typeForm = reactive({ name: '', description: '' })
let typeListRequestSequence = 0
let templateListRequestSequence = 0
let templateDetailRequestSequence = 0
let typeChangeRequestSequence = 0
let templateEditSequence = 0
let workflowProjectNodeOptionsRequest: Promise<void> | undefined
let workflowTopicNodeOptionsRequest: Promise<void> | undefined

const COMPONENTS = [
  { key: 'requirement-scope' }, { key: 'solution-design' },
  { key: 'plan-resource-risk' }, { key: 'development-control' }, { key: 'business-acceptance' },
  { key: 'release-handover' }, { key: 'value-review' }, { key: 'knowledge-standard' },
]
const fieldTypes: WorkflowFieldType[] = ['TEXT', 'TEXTAREA', 'NUMBER', 'RADIO', 'SINGLE_SELECT', 'MULTI_SELECT', 'PERSON', 'PERSON_MULTI', 'DATE', 'DATE_RANGE', 'ATTACHMENT']
const FIELD_TYPE_ICONS: Record<WorkflowFieldType, Component> = {
  TEXT: FileTextOutlined,
  TEXTAREA: AlignLeftOutlined,
  NUMBER: FieldNumberOutlined,
  RADIO: CheckCircleOutlined,
  SINGLE_SELECT: DownOutlined,
  MULTI_SELECT: UnorderedListOutlined,
  PERSON: UserOutlined,
  PERSON_MULTI: TeamOutlined,
  DATE: CalendarOutlined,
  DATE_RANGE: SwapOutlined,
  ATTACHMENT: PaperClipOutlined,
}
const selectedType = computed(() => types.value.find((type) => type.id === selectedTypeId.value))
const selectedTemplateSummary = computed(() => templates.value.find((template) => template.id === selectedTemplateId.value))
const workflowEntryStep = computed(() => getWorkflowTemplateEntryStep({
  typeCount: types.value.length,
  selectedTypeId: selectedTypeId.value,
  templateCount: templates.value.length,
  selectedTemplateId: selectedTemplateId.value,
  creatingTemplate: selectedTemplateId.value == null && dirty.value && definition.value.nodes.length > 0,
}))
const currentNode = computed(() => definition.value.nodes.find((node) => node.key === selectedNodeKey.value))
const selectedField = computed(() => currentNode.value?.fields.find((field) => field.key === selectedFieldKey.value))
const configuredComponents = computed(() => (currentNode.value?.contentOrder || [])
  .filter((item) => item.startsWith('component:'))
  .map((item) => item.slice('component:'.length)))
const availableBindings = computed(() => Object.entries(PROJECT_FIELD_BINDINGS)
  .filter(([, binding]) => !currentNode.value?.fields.some((field) => field.binding === binding.binding)))
const selectedNodeIndex = computed(() => definition.value.nodes.findIndex((node) => node.key === selectedNodeKey.value))
const publishedVersion = computed(() => selectedTemplateSummary.value?.publishedVersionNo)
const workflowVersions = computed(() => [...(selectedTemplateSummary.value?.versions || [])]
  .sort((left, right) => right.versionNo - left.versionNo))

watch(selectedTypeId, (typeId) => {
  const processTypeCode = types.value.find((type) => type.id === typeId)?.code
  if (processTypeCode === 'topic-management') {
    void loadWorkflowProjectNodeOptions()
  } else if (processTypeCode === 'story-management') {
    void loadWorkflowTopicNodeOptions()
  }
})

function loadWorkflowProjectNodeOptions(): Promise<void> {
  if (workflowProjectNodeOptions.value.length) return Promise.resolve()
  if (workflowProjectNodeOptionsRequest) return workflowProjectNodeOptionsRequest
  workflowProjectNodeOptionsLoading.value = true
  workflowProjectNodeOptionsRequest = getWorkflowProjectNodeOptions()
    .then((options) => { workflowProjectNodeOptions.value = Array.isArray(options) ? options : [] })
    .catch((error) => { message.error((error as Error).message || t('admin.workflow.topicSourceProjectNodeLoadFailed')) })
    .finally(() => {
      workflowProjectNodeOptionsLoading.value = false
      workflowProjectNodeOptionsRequest = undefined
    })
  return workflowProjectNodeOptionsRequest
}

function loadWorkflowTopicNodeOptions(): Promise<void> {
  if (workflowTopicNodeOptions.value.length) return Promise.resolve()
  if (workflowTopicNodeOptionsRequest) return workflowTopicNodeOptionsRequest
  workflowTopicNodeOptionsLoading.value = true
  workflowTopicNodeOptionsRequest = getWorkflowTopicNodeOptions()
    .then((options) => { workflowTopicNodeOptions.value = Array.isArray(options) ? options : [] })
    .catch((error) => { message.error((error as Error).message || t('admin.workflow.storySourceTopicNodeLoadFailed')) })
    .finally(() => {
      workflowTopicNodeOptionsLoading.value = false
      workflowTopicNodeOptionsRequest = undefined
    })
  return workflowTopicNodeOptionsRequest
}

function updateTopicSourceProjectNodeKey(value: unknown) {
  if (selectedType.value?.code !== 'topic-management') return
  definition.value = setTopicSourceProjectNodeKey(definition.value, String(value || ''))
  markDirty()
}

function updateStorySourceTopicNodeKey(value: unknown) {
  if (selectedType.value?.code !== 'story-management') return
  definition.value = setStorySourceTopicNodeKey(definition.value, String(value || ''))
  markDirty()
}

function defaultVersionLabel(template: WorkflowTemplateSummary): string {
  const versionNo = template.publishedVersions?.find((version) => version.id === template.defaultTemplateVersionId)?.versionNo
  return versionNo == null
    ? t('admin.workflow.default')
    : t('admin.workflow.defaultVersion', { version: versionNo })
}

function contentItemLabel(contentItem: WorkflowContentOrderItem): string {
  if (contentItem === 'fields') return t('admin.workflow.fieldsSection')
  if (contentItem === 'legacy-custom-fields') return t('admin.workflow.legacyCustomFieldsSection')
  return componentLabel(contentItem.slice('component:'.length))
}

function fieldsForContentItem(node: WorkflowNodeDefinitionV2, contentItem: WorkflowContentOrderItem, includeHidden = false): WorkflowFieldDefinition[] {
  const fields = includeHidden ? node.fields : node.fields.filter((field) => field.visible !== false)
  const splitLegacyFields = node.contentOrder.includes('legacy-custom-fields')
  if (!splitLegacyFields) return contentItem === 'fields' ? fields : []
  if (contentItem === 'fields') return fields.filter((field) => Boolean(field.binding))
  if (contentItem === 'legacy-custom-fields') return fields.filter((field) => !field.binding)
  return []
}

function markDirty() {
  templateEditSequence += 1
  dirty.value = true
}

async function loadTypes(preferredTypeId?: number) {
  const requestSequence = ++typeListRequestSequence
  loading.value = true
  try {
    const loadedTypes = await listWorkflowProjectTypes()
    if (requestSequence !== typeListRequestSequence) return
    types.value = loadedTypes
    if (!types.value.length) {
      selectedTypeId.value = undefined
      templates.value = []
      templateListRequestSequence += 1
      templateDetailRequestSequence += 1
      clearEditor()
      return
    }
    selectedTypeId.value = types.value.some((type) => type.id === preferredTypeId)
      ? preferredTypeId
      : undefined
    if (selectedTypeId.value) await loadTemplates()
    else {
      templates.value = []
      templateListRequestSequence += 1
      templateDetailRequestSequence += 1
      clearEditor()
    }
  } catch (error) {
    if (requestSequence === typeListRequestSequence) message.error((error as Error).message || t('admin.workflow.loadFailed'))
  } finally {
    if (requestSequence === typeListRequestSequence) loading.value = false
  }
}

async function loadTemplates(preferredTemplateId?: number) {
  const typeId = selectedTypeId.value
  if (!typeId) {
    templateListRequestSequence += 1
    templateDetailRequestSequence += 1
    templates.value = []
    clearEditor()
    return
  }
  const requestSequence = ++templateListRequestSequence
  templateDetailRequestSequence += 1
  loading.value = true
  try {
    const loadedTemplates = await listWorkflowTemplates(typeId)
    if (requestSequence !== templateListRequestSequence || typeId !== selectedTypeId.value) return
    templates.value = loadedTemplates
    const selected = loadedTemplates.find((template) => template.id === preferredTemplateId)
    if (selected) await selectTemplate(selected.id)
    else clearEditor()
  } catch (error) {
    if (requestSequence === templateListRequestSequence) message.error((error as Error).message || t('admin.workflow.loadFailed'))
  } finally {
    if (requestSequence === templateListRequestSequence) loading.value = false
  }
}

function clearEditor() {
  selectedTemplateId.value = null
  templateName.value = ''
  templateDescription.value = ''
  definition.value = { schemaVersion: 2, nodes: [] }
  selectedNodeKey.value = ''
  selectedFieldKey.value = ''
  dirty.value = false
}

function upsertTemplateSummary(template: WorkflowTemplateSummary) {
  const existingIndex = templates.value.findIndex((item) => item.id === template.id)
  const existing = existingIndex >= 0 ? templates.value[existingIndex] : undefined
  const next: WorkflowTemplateSummary = {
    ...existing,
    id: template.id,
    code: template.code,
    projectTypeId: template.projectTypeId,
    name: template.name,
    description: template.description,
    draftVersionNo: template.draftVersionNo,
    draftRevision: template.draftRevision,
    publishedVersionNo: template.publishedVersionNo,
    publishedVersionId: template.publishedVersionId,
    publishedVersions: template.publishedVersions ?? existing?.publishedVersions,
    versions: template.versions ?? existing?.versions,
    defaultTemplateVersionId: template.defaultTemplateVersionId ?? existing?.defaultTemplateVersionId,
    defaultTemplate: template.defaultTemplate ?? existing?.defaultTemplate ?? false,
  }
  if (existingIndex >= 0) {
    templates.value = templates.value.map((item, index) => index === existingIndex ? next : item)
  } else {
    templates.value = [...templates.value, next]
  }
}

async function selectTemplate(id: number) {
  if (saving.value) return
  const requestSequence = ++templateDetailRequestSequence
  templateListRequestSequence += 1
  const typeId = selectedTypeId.value
  if (!(await confirmDiscard())) return
  if (requestSequence !== templateDetailRequestSequence || typeId !== selectedTypeId.value) return
  loading.value = true
  try {
    const template = await getWorkflowTemplate(id)
    if (requestSequence !== templateDetailRequestSequence || typeId !== selectedTypeId.value || template.projectTypeId !== typeId) return
    selectedTemplateId.value = template.id
    templateName.value = template.name
    templateDescription.value = template.description || ''
    definition.value = normalizeWorkflowDefinitionForProcessType(template.definition, selectedType.value?.code)
    selectedNodeKey.value = definition.value.nodes[0]?.key || ''
    selectedFieldKey.value = firstFieldKey(definition.value.nodes[0])
    dirty.value = false
  } catch (error) {
    if (requestSequence === templateDetailRequestSequence) message.error((error as Error).message || t('admin.workflow.loadFailed'))
  } finally {
    if (requestSequence === templateDetailRequestSequence) loading.value = false
  }
}

function firstFieldKey(node?: WorkflowNodeDefinitionV2): string {
  return node?.fields.find((field) => field.visible !== false)?.key || node?.fields[0]?.key || ''
}

function selectNode(nodeKey: string) {
  const node = definition.value.nodes.find((item) => item.key === nodeKey)
  if (!node) return
  selectedNodeKey.value = nodeKey
  selectedFieldKey.value = firstFieldKey(node)
}

function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches
}

function openMobileInspector(trigger?: EventTarget | null) {
  if (!isMobileViewport()) return
  if (trigger instanceof HTMLElement) mobileInspectorTrigger.value = trigger
  const alreadyOpen = mobileInspectorOpen.value
  mobileInspectorOpen.value = true
  if (!alreadyOpen) window.requestAnimationFrame(() => {
    mobileInspectorPanel.value?.querySelector<HTMLElement>('[data-mobile-inspector-close]')?.focus()
  })
}

function closeMobileInspector() {
  if (!mobileInspectorOpen.value) return
  mobileInspectorOpen.value = false
  window.requestAnimationFrame(() => mobileInspectorTrigger.value?.focus())
}

function openNodeSettings(event?: MouseEvent) {
  selectedFieldKey.value = ''
  openMobileInspector(event?.currentTarget)
}

async function confirmDiscard(): Promise<boolean> {
  if (!dirty.value) return true
  return new Promise<boolean>((resolve) => Modal.confirm({
    title: t('admin.workflow.discardTitle'), content: t('admin.workflow.discardContent'),
    okText: t('admin.workflow.discard'), cancelText: t('common.cancel'), onOk: () => { dirty.value = false; resolve(true) }, onCancel: () => resolve(false),
  }))
}

onBeforeRouteLeave(async () => {
  if (saving.value) return false
  return confirmDiscard()
})

async function changeProjectType(typeId: number) {
  if (saving.value || typeId === selectedTypeId.value) return
  const requestSequence = ++typeChangeRequestSequence
  if (!(await confirmDiscard())) return
  if (requestSequence !== typeChangeRequestSequence || saving.value) return
  templateListRequestSequence += 1
  templateDetailRequestSequence += 1
  selectedTypeId.value = typeId
  templates.value = []
  clearEditor()
  await loadTemplates()
}

async function newTemplate() {
  if (saving.value || loading.value) return
  if (!selectedTypeId.value) { message.warning(t('admin.workflow.chooseTypeFirst')); return }
  const hadUnsavedChanges = dirty.value
  if (!(await confirmDiscard())) return
  const typeId = selectedTypeId.value
  const requestSequence = ++templateDetailRequestSequence
  templateListRequestSequence += 1
  const base = templates.value.find((template) => template.defaultTemplate) || templates.value[0]
  let baseDefinition: WorkflowTemplateDefinitionV2 | undefined
  if (base) {
    loading.value = true
    try {
      const baseTemplate = await getWorkflowTemplate(base.id)
      if (requestSequence !== templateDetailRequestSequence || typeId !== selectedTypeId.value) return
      baseDefinition = normalizeWorkflowDefinitionForProcessType(baseTemplate.definition, selectedType.value?.code)
    } catch (error) {
      dirty.value = hadUnsavedChanges
      message.error((error as Error).message || t('admin.workflow.loadFailed'))
      return
    } finally { if (requestSequence === templateDetailRequestSequence) loading.value = false }
  }
  if (requestSequence !== templateDetailRequestSequence || typeId !== selectedTypeId.value) return
  selectedTemplateId.value = null
  templateName.value = t('admin.workflow.newTemplateName')
  templateDescription.value = ''
  const initialDefinition: WorkflowTemplateDefinitionV2 = baseDefinition
    ? { ...baseDefinition, nodes: baseDefinition.nodes }
    : { schemaVersion: 2, nodes: [createWorkflowNode([], { name: t('admin.workflow.newNodeName'), key: 'stage-1' })] }
  definition.value = normalizeWorkflowDefinitionForProcessType(initialDefinition, selectedType.value?.code)
  selectedNodeKey.value = definition.value.nodes[0]?.key || ''
  selectedFieldKey.value = firstFieldKey(definition.value.nodes[0])
  dirty.value = true
}

function addNode() {
  const next = createWorkflowNode(definition.value.nodes, { name: t('admin.workflow.newNodeName') })
  definition.value.nodes = [...definition.value.nodes, next]
  selectedNodeKey.value = next.key
  selectedFieldKey.value = ''
  markDirty()
}

function removeNode(node: WorkflowNodeDefinitionV2) {
  Modal.confirm({
    title: t('admin.workflow.removeNodeTitle', { name: node.name }),
    content: t('admin.workflow.removeNodeContent'), okType: 'danger', okText: t('common.delete'), cancelText: t('common.cancel'),
    onOk: () => {
      try {
        definition.value.nodes = removeWorkflowNode(definition.value.nodes, node.key)
        const nextNode = definition.value.nodes[0]
        selectedNodeKey.value = nextNode?.key || ''
        selectedFieldKey.value = firstFieldKey(nextNode)
        markDirty()
      } catch (error) { message.warning((error as Error).message) }
    },
  })
}

function reorder(nodeKey: string, targetIndex: number) {
  definition.value.nodes = moveWorkflowNode(definition.value.nodes, nodeKey, targetIndex)
  selectedNodeKey.value = nodeKey
  markDirty()
}

function onDrop(targetIndex: number) {
  if (!dragKey.value) return
  reorder(dragKey.value, targetIndex)
  dragKey.value = undefined
}

function toggleComponent(componentKey: string, checked: boolean) {
  const node = currentNode.value
  if (!node) return
  const contentItem = `component:${componentKey}` as WorkflowContentOrderItem
  node.contentOrder = checked
    ? (node.contentOrder.includes(contentItem) ? node.contentOrder : [...node.contentOrder, contentItem])
    : node.contentOrder.filter((item) => item !== contentItem)
  markDirty()
}

function addField(type: WorkflowFieldType = 'TEXT', event?: MouseEvent) {
  const node = currentNode.value
  if (!node) return
  const next = addWorkflowField(node, { label: t('admin.workflow.newFieldName'), type })
  selectedFieldKey.value = next.fields.at(-1)?.key || ''
  replaceCurrentNode(next)
  openMobileInspector(event?.currentTarget)
}

function addBoundField(projectFieldKey: string, event?: MouseEvent) {
  const node = currentNode.value
  const binding = PROJECT_FIELD_BINDINGS[projectFieldKey]
  if (!node || !binding) return
  const next = addWorkflowField(node, {
    key: `project-${projectFieldKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
    label: t(`admin.workflow.projectFieldLabels.${projectFieldKey}`),
    type: binding.type,
    binding: binding.binding,
  })
  selectedFieldKey.value = next.fields.at(-1)?.key || ''
  replaceCurrentNode(next)
  openMobileInspector(event?.currentTarget)
}

function replaceCurrentNode(next: WorkflowNodeDefinitionV2) {
  const index = definition.value.nodes.findIndex((node) => node.key === next.key)
  if (index >= 0) definition.value.nodes[index] = next
  markDirty()
}

function moveContentItem(contentItem: WorkflowContentOrderItem, delta: number) {
  const node = currentNode.value
  if (!node) return
  const index = node.contentOrder.indexOf(contentItem)
  const target = index + delta
  if (index < 0 || target < 0 || target >= node.contentOrder.length) return
  replaceCurrentNode(moveWorkflowContentItem(node, contentItem, target))
}

function onContentDrop(targetIndex: number) {
  if (!contentDragItem.value) return
  const source = contentDragItem.value
  contentDragItem.value = undefined
  const node = currentNode.value
  if (node && node.contentOrder.indexOf(source) !== targetIndex) {
    replaceCurrentNode(moveWorkflowContentItem(node, source, targetIndex))
  }
}

function moveField(fieldKey: string, delta: number, contentItem: WorkflowContentOrderItem) {
  const node = currentNode.value
  if (!node) return
  const groupFields = fieldsForContentItem(node, contentItem, true)
  const index = groupFields.findIndex((field) => field.key === fieldKey)
  const targetField = groupFields[index + delta]
  if (index < 0 || !targetField) return
  const targetIndex = node.fields.findIndex((field) => field.key === targetField.key)
  replaceCurrentNode(moveWorkflowField(node, fieldKey, targetIndex))
}

function onFieldDrop(targetIndex: number) {
  if (!fieldDragKey.value) return
  const source = fieldDragKey.value
  fieldDragKey.value = undefined
  const node = currentNode.value
  if (node && node.fields.findIndex((field) => field.key === source) !== targetIndex) {
    replaceCurrentNode(moveWorkflowField(node, source, targetIndex))
  }
}

function removeField(fieldKey: string) {
  const node = currentNode.value
  if (!node) return
  const next = removeWorkflowField(node, fieldKey)
  replaceCurrentNode(next)
  if (selectedFieldKey.value === fieldKey) selectedFieldKey.value = firstFieldKey(next)
}

function selectField(fieldKey: string, event?: MouseEvent) {
  selectedFieldKey.value = fieldKey
  openMobileInspector(event?.currentTarget)
}

function fieldIndex(fieldKey: string): number {
  return currentNode.value?.fields.findIndex((field) => field.key === fieldKey) ?? -1
}

function fieldIndexInContentItem(fieldKey: string, contentItem: WorkflowContentOrderItem): number {
  return currentNode.value ? fieldsForContentItem(currentNode.value, contentItem, true).findIndex((field) => field.key === fieldKey) : -1
}

function removeContentItem(contentItem: WorkflowContentOrderItem) {
  const componentKey = contentItem.replace(/^component:/, '')
  if (componentKey) toggleComponent(componentKey, false)
}

function setFieldOptions(field: WorkflowFieldDefinition, text: string) {
  field.options = [...new Set(text.split(',').map((option) => option.trim()).filter(Boolean))]
  markDirty()
}

function updateFieldType(field: WorkflowFieldDefinition, type: WorkflowFieldType) {
  if (field.binding) return
  field.type = type
  if (!['RADIO', 'SINGLE_SELECT', 'MULTI_SELECT'].includes(type)) field.options = []
  markDirty()
}

function updateFieldVisibility(field: WorkflowFieldDefinition, visible: boolean) {
  field.visible = visible
  if (!visible) field.required = false
  markDirty()
}

function updateFieldWidth(field: WorkflowFieldDefinition, fullWidth: boolean) {
  field.fullWidth = fullWidth
  markDirty()
}

async function saveDraft(): Promise<boolean> {
  if (saving.value || loading.value) return false
  if (!selectedTypeId.value || !templateName.value.trim() || !definition.value.nodes.length) {
    message.warning(t('admin.workflow.completeBeforeSave'))
    return false
  }
  const editRevision = templateEditSequence
  const typeId = selectedTypeId.value
  const previousTemplateId = selectedTemplateId.value
  saving.value = true
  try {
    const payload = {
      name: templateName.value.trim(),
      description: templateDescription.value.trim(),
      definition: JSON.parse(JSON.stringify(definition.value)) as WorkflowTemplateDefinitionV2,
      expectedDraftRevision: selectedTemplateSummary.value?.draftRevision ?? null,
    }
    const saved = previousTemplateId
      ? await saveWorkflowTemplateDraft(previousTemplateId, payload)
      : await createWorkflowTemplate({ ...payload, projectTypeId: typeId })
    if (selectedTypeId.value !== typeId || selectedTemplateId.value !== previousTemplateId) return false
    selectedTemplateId.value = saved.id
    upsertTemplateSummary(saved)
    dirty.value = templateEditSequence !== editRevision
    const listRequestSequence = ++templateListRequestSequence
    try {
      const refreshedTemplates = await listWorkflowTemplates(typeId)
      if (listRequestSequence === templateListRequestSequence && selectedTypeId.value === typeId) templates.value = refreshedTemplates
    } catch {
      // The draft was saved successfully; a failed summary refresh must not report the save as failed.
    }
    if (dirty.value) message.warning(t('admin.workflow.saveChangesRemain'))
    else message.success(t('admin.workflow.draftSaved'))
    return true
  } catch (error) {
    message.error((error as Error).message || t('admin.workflow.saveFailed'))
    return false
  } finally { saving.value = false }
}

async function publish() {
  if (!canWrite.value || saving.value || loading.value) return
  if (dirty.value && !(await saveDraft())) return
  if (dirty.value) { message.warning(t('admin.workflow.saveChangesBeforePublish')); return }
  if (!selectedTemplateId.value) return
  const templateId = selectedTemplateId.value
  const typeId = selectedTypeId.value
  saving.value = true
  try {
    const published = await publishWorkflowTemplate(templateId)
    upsertTemplateSummary(published)
    message.success(t('admin.workflow.published'))
    try {
      const requestSequence = ++templateListRequestSequence
      const refreshedTemplates = typeId ? await listWorkflowTemplates(typeId) : []
      if (requestSequence === templateListRequestSequence && selectedTypeId.value === typeId) templates.value = refreshedTemplates
    } catch {
      message.warning(t('admin.workflow.publishedRefreshFailed'))
    }
  } catch (error) { message.error((error as Error).message || t('admin.workflow.publishFailed')) }
  finally { saving.value = false }
}

async function setAsDefault() {
  if (saving.value || loading.value) return
  const typeId = selectedTypeId.value
  const templateId = selectedTemplateId.value
  const versionId = selectedTemplateSummary.value?.publishedVersionId
  if (!typeId || !templateId || !versionId) { message.warning(t('admin.workflow.publishBeforeDefault')); return }
  saving.value = true
  try {
    const updatedType = await setWorkflowDefault(typeId, versionId)
    types.value = types.value.map((type) => type.id === typeId ? updatedType : type)
    templates.value = templates.value.map((template) => ({
      ...template,
      defaultTemplateVersionId: updatedType.defaultTemplateVersionId,
      versions: template.versions?.map((version) => ({
        ...version,
        isDefault: version.id === updatedType.defaultTemplateVersionId,
      })),
      defaultTemplate: template.publishedVersions?.some((version) => version.id === versionId)
        ?? template.id === templateId,
    }))
    message.success(t('admin.workflow.defaultUpdated'))
    try {
      const refreshedTemplates = await listWorkflowTemplates(typeId)
      if (selectedTypeId.value === typeId && selectedTemplateId.value === templateId) {
        templates.value = refreshedTemplates
      }
    } catch {
      message.warning(t('admin.workflow.defaultUpdatedRefreshFailed'))
    }
  } catch (error) { message.error((error as Error).message || t('admin.workflow.defaultFailed')) }
  finally { saving.value = false }
}

function confirmAction(title: string, content: string, okText: string, danger = false): Promise<boolean> {
  return new Promise<boolean>((resolve) => Modal.confirm({
    title,
    content,
    okText,
    okType: danger ? 'danger' : 'primary',
    cancelText: t('common.cancel'),
    onOk: () => resolve(true),
    onCancel: () => resolve(false),
  }))
}

async function setVersionAsDefault(version: WorkflowTemplateVersionSummary) {
  if (!canWrite.value || saving.value || loading.value || version.status !== 'PUBLISHED' || version.isDefault) return
  const typeId = selectedTypeId.value
  const templateId = selectedTemplateId.value
  if (!typeId || !templateId) return
  const confirmed = await confirmAction(
    t('admin.workflow.setDefaultVersionTitle', { version: version.versionNo }),
    t('admin.workflow.setDefaultVersionContent', { version: version.versionNo }),
    t('admin.workflow.setDefaultVersion'),
  )
  if (!confirmed) return
  saving.value = true
  try {
    const updatedType = await setWorkflowDefault(typeId, version.id)
    types.value = types.value.map((type) => type.id === typeId ? updatedType : type)
    templates.value = templates.value.map((template) => ({
      ...template,
      defaultTemplateVersionId: updatedType.defaultTemplateVersionId,
      versions: template.versions?.map((item) => ({
        ...item,
        isDefault: item.id === updatedType.defaultTemplateVersionId,
      })),
      defaultTemplate: template.publishedVersions?.some((item) => item.id === updatedType.defaultTemplateVersionId) ?? false,
    }))
    message.success(t('admin.workflow.defaultUpdated'))
    try {
      const refreshedTemplates = await listWorkflowTemplates(typeId)
      if (selectedTypeId.value === typeId && selectedTemplateId.value === templateId) templates.value = refreshedTemplates
    } catch {
      message.warning(t('admin.workflow.defaultUpdatedRefreshFailed'))
    }
  } catch (error) { message.error((error as Error).message || t('admin.workflow.defaultFailed')) }
  finally { saving.value = false }
}

async function archiveVersion(version: WorkflowTemplateVersionSummary) {
  if (!canWrite.value || saving.value || loading.value || version.status !== 'PUBLISHED' || version.isDefault) return
  const templateId = selectedTemplateId.value
  const typeId = selectedTypeId.value
  if (!templateId || !typeId) return
  const preserveLocalEdits = dirty.value
  const confirmed = await confirmAction(
    t('admin.workflow.archiveVersionTitle', { version: version.versionNo }),
    t('admin.workflow.archiveVersionContent'),
    t('admin.workflow.archiveVersion'),
    true,
  )
  if (!confirmed) return
  saving.value = true
  try {
    const updated = await archiveWorkflowTemplateVersion(templateId, version.id)
    upsertTemplateSummary(updated)
    try {
      const refreshedTemplates = await listWorkflowTemplates(typeId)
      if (selectedTypeId.value === typeId && selectedTemplateId.value === templateId) templates.value = refreshedTemplates
    } catch {
      message.warning(t('admin.workflow.defaultUpdatedRefreshFailed'))
    }
    message.success(t('admin.workflow.versionArchived'))
    if (selectedTypeId.value === typeId && selectedTemplateId.value === templateId) {
      if (preserveLocalEdits) {
        message.warning(t('admin.workflow.versionArchivedWithUnsavedEdits'))
      } else {
        saving.value = false
        await selectTemplate(templateId)
      }
    }
  } catch (error) { message.error((error as Error).message || t('admin.workflow.versionArchiveFailed')) }
  finally { saving.value = false }
}

async function archiveSelectedTemplate() {
  if (!canWrite.value || saving.value || loading.value) return
  const template = selectedTemplateSummary.value
  const typeId = selectedTypeId.value
  if (!template || !typeId || template.code === 'current-process') return
  const confirmed = await confirmAction(
    t('admin.workflow.archiveTemplateTitle', { name: template.name }),
    t('admin.workflow.archiveTemplateContent'),
    t('admin.workflow.archiveTemplate'),
    true,
  )
  if (!confirmed) return
  saving.value = true
  try {
    await archiveWorkflowTemplate(template.id)
    dirty.value = false
    templates.value = []
    clearEditor()
    versionModalOpen.value = false
    message.success(t('admin.workflow.templateArchived'))
    saving.value = false
    await loadTemplates()
  } catch (error) { message.error((error as Error).message || t('admin.workflow.templateArchiveFailed')) }
  finally { saving.value = false }
}

async function saveType() {
  if (!typeForm.name.trim()) { message.warning(t('admin.workflow.typeRequired')); return }
  if (!(await confirmDiscard())) return
  try {
    const created = await createWorkflowProjectType(buildProjectTypeCreatePayload(typeForm, types.value.length))
    typeModalOpen.value = false
    Object.assign(typeForm, { name: '', description: '' })
    await loadTypes(created.id)
  } catch (error) { message.error((error as Error).message || t('admin.workflow.typeSaveFailed')) }
}

function openTypeModal() {
  Object.assign(typeForm, { name: '', description: '' })
  typeModalOpen.value = true
}

function componentLabel(key: string) { return t(`admin.workflow.componentLabels.${key}`) }
function fieldTypeLabel(type: WorkflowFieldType) { return t(`admin.workflow.fieldTypes.${type}`) }
function bindingLabel(binding: WorkflowFieldBinding) { return t(`admin.workflow.bindingLabels.${binding}`) }
function fieldTypeIcon(type: WorkflowFieldType): Component { return FIELD_TYPE_ICONS[type] }
function visibleFieldCount(node: WorkflowNodeDefinitionV2) { return node.fields.filter((field) => field.visible !== false).length }
function setFieldOptionsFromEvent(field: WorkflowFieldDefinition, event: unknown) {
  setFieldOptions(field, String((event as { target?: { value?: string } })?.target?.value || ''))
}
function checkboxChecked(event: unknown): boolean {
  return Boolean((event as { target?: { checked?: boolean } })?.target?.checked)
}
onMounted(async () => {
  loading.value = true
  try { await loadTypes() }
  catch (error) { message.error((error as Error).message || t('admin.workflow.loadFailed')) }
  finally { loading.value = false }
})
</script>

<template>
  <section class="workflow-admin-page">
    <PmsPageHeader :title="$t('admin.workflow.configTitle')" :description="$t('admin.workflow.description')">
      <template #actions>
        <div v-if="workflowEntryStep === 'editor'" class="workflow-page-actions">
          <div class="workflow-page-actions__secondary">
            <a-button @click="previewOpen = true" :disabled="!definition.nodes.length"><EyeOutlined /> {{ $t('admin.workflow.preview') }}</a-button>
          </div>
          <div v-if="canWrite" class="workflow-page-actions__primary">
            <a-button type="primary" :loading="saving" @click="saveDraft"><SaveOutlined /> {{ $t('admin.workflow.saveDraft') }}</a-button>
            <a-button v-if="selectedTemplateId" type="primary" ghost :loading="saving" @click="publish"><SendOutlined /> {{ $t('admin.workflow.publish') }}</a-button>
          </div>
        </div>
      </template>
    </PmsPageHeader>

    <div class="workflow-editor" :aria-busy="loading || saving" :inert="saving || loading">
      <a-spin :spinning="loading">
        <div class="workflow-entry-stack">
          <section class="workflow-type-picker" data-testid="workflow-type-picker" role="group" :aria-label="$t('admin.workflow.processTypes')">
            <div class="workflow-entry-heading">
              <div class="workflow-entry-heading__copy">
                <h2>{{ $t('admin.workflow.processTypes') }}</h2>
                <p>{{ $t('admin.workflow.typeHint') }}</p>
              </div>
              <a-button v-if="canWrite && types.length" @click="openTypeModal"><PlusOutlined /> {{ $t('admin.workflow.addProcessType') }}</a-button>
            </div>
            <div v-if="types.length" class="workflow-choice-grid">
              <button
                v-for="type in types"
                :key="type.id"
                type="button"
                class="workflow-choice-card"
                :class="{ 'is-selected': selectedTypeId === type.id }"
                :aria-pressed="selectedTypeId === type.id"
                @click="changeProjectType(type.id)"
              >
                <span class="workflow-choice-card__title"><strong>{{ type.name }}</strong><a-tag v-if="selectedTypeId === type.id" color="blue">{{ $t('admin.workflow.selected') }}</a-tag></span>
                <small>{{ type.description || $t('admin.workflow.typeHint') }}</small>
              </button>
            </div>
          </section>

          <section v-if="workflowEntryStep === 'empty-types'" class="workflow-empty-state" data-testid="workflow-empty-types">
            <a-empty :description="$t('admin.workflow.noTypes')">
              <a-button v-if="canWrite" type="primary" @click="openTypeModal"><PlusOutlined /> {{ $t('admin.workflow.addProcessType') }}</a-button>
            </a-empty>
          </section>

          <section v-else-if="selectedTypeId" class="workflow-template-picker" data-testid="workflow-template-picker" role="group" :aria-label="$t('admin.workflow.templates')">
            <div class="workflow-entry-heading">
              <div class="workflow-entry-heading__copy">
                <h2>{{ $t('admin.workflow.templates') }} <span>· {{ selectedType?.name }}</span></h2>
                <p>{{ $t('admin.workflow.templatesHint') }}</p>
              </div>
            </div>
            <div v-if="templates.length" class="workflow-choice-grid workflow-choice-grid--templates">
              <button
                v-for="template in templates"
                :key="template.id"
                type="button"
                class="workflow-choice-card workflow-template-choice"
                :class="{ 'is-selected': selectedTemplateId === template.id }"
                :aria-pressed="selectedTemplateId === template.id"
                @click="selectTemplate(template.id)"
              >
                <span class="workflow-choice-card__title"><strong>{{ template.name }}</strong><span class="workflow-choice-card__tags"><a-tag v-if="template.defaultTemplate" color="blue">{{ defaultVersionLabel(template) }}</a-tag><a-tag v-if="template.draftVersionNo" color="orange">{{ $t('admin.workflow.draftVersion', { version: template.draftVersionNo }) }}</a-tag><a-tag v-if="template.publishedVersionNo" color="green">{{ $t('admin.workflow.publishedVersion', { version: template.publishedVersionNo }) }}</a-tag><a-tag v-if="!template.publishedVersionNo">{{ $t('admin.workflow.notPublished') }}</a-tag></span></span>
                <small>{{ template.description || $t('admin.workflow.templatesHint') }}</small>
              </button>
              <button v-if="canWrite" type="button" class="workflow-choice-card workflow-template-choice workflow-template-choice--create" @click="newTemplate">
                <span class="workflow-template-create-icon"><PlusOutlined /></span>
                <span class="workflow-choice-card__title"><strong>{{ $t('admin.workflow.newTemplate') }}</strong></span>
                <small>{{ $t('admin.workflow.chooseOrCreate') }}</small>
              </button>
            </div>
            <section v-if="workflowEntryStep === 'empty-templates'" class="workflow-empty-state" data-testid="workflow-empty-templates">
              <a-empty :description="$t('admin.workflow.noTemplates')">
                <a-button v-if="canWrite" type="primary" @click="newTemplate"><PlusOutlined /> {{ $t('admin.workflow.newTemplate') }}</a-button>
              </a-empty>
            </section>
            <p v-else-if="workflowEntryStep === 'select-template'" class="workflow-selection-hint">{{ $t('admin.workflow.chooseOrCreate') }}</p>
          </section>

          <template v-if="workflowEntryStep === 'editor'">
            <section class="workflow-template-bar" data-testid="workflow-template-bar">
              <div class="template-selectors">
                <div class="template-current">
                  <div class="template-current__heading">
                    <span class="template-current__eyebrow">{{ $t('admin.workflow.currentTemplate') }}</span>
                    <div class="template-current__status">
                      <a-tag v-if="selectedTemplateSummary?.defaultTemplate" color="blue">{{ defaultVersionLabel(selectedTemplateSummary) }}</a-tag>
                      <a-tag v-if="dirty" color="orange">{{ $t('admin.workflow.unsaved') }}</a-tag>
                      <a-tag v-else-if="selectedTemplateSummary?.draftVersionNo" color="orange">{{ $t('admin.workflow.draftVersion', { version: selectedTemplateSummary.draftVersionNo }) }}</a-tag>
                      <a-tag v-if="publishedVersion" color="green">{{ $t('admin.workflow.publishedVersion', { version: publishedVersion }) }}</a-tag>
                    </div>
                  </div>
                  <div class="template-current__name"><a-input v-model:value="templateName" :placeholder="$t('admin.workflow.templateName')" :disabled="!canWrite" :aria-label="$t('admin.workflow.templateName')" @input="markDirty" /></div>
                </div>
                <div class="template-selector template-selector--workflow">
                  <div class="template-selector__heading">
                    <span>{{ selectedType?.name }}</span>
                    <div class="template-selector__heading-actions">
                      <a-button v-if="canWrite && selectedTemplateId" size="small" data-testid="workflow-version-manager" @click="versionModalOpen = true">{{ $t('admin.workflow.versionManager') }}</a-button>
                      <a-button v-if="canWrite && selectedTemplateSummary?.publishedVersionId && selectedTemplateSummary.defaultTemplateVersionId !== selectedTemplateSummary.publishedVersionId" class="template-selector__default-action" size="small" :disabled="dirty" @click="setAsDefault">{{ $t('admin.workflow.setDefault') }}</a-button>
                      <a-button v-if="canWrite && selectedTemplateSummary && selectedTemplateSummary.code !== 'current-process' && !selectedTemplateSummary.defaultTemplate" size="small" danger data-testid="archive-workflow-template" @click="archiveSelectedTemplate">{{ $t('admin.workflow.archiveTemplate') }}</a-button>
                    </div>
                  </div>
                  <div class="template-selector__selected">{{ $t('admin.workflow.currentTemplate') }}：{{ selectedTemplateSummary?.name || templateName }}</div>
                </div>
              </div>
              <div class="workflow-template-version-guidance" role="note" data-testid="workflow-template-version-guidance">
                <InfoCircleOutlined aria-hidden="true" />
                <span>{{ $t('admin.workflow.versionGuidance') }}</span>
              </div>
              <section v-if="selectedType?.code === 'topic-management'" class="workflow-topic-binding" data-testid="workflow-topic-binding">
                <div class="workflow-topic-binding__copy">
                  <strong>{{ $t('admin.workflow.topicSourceProjectNodeKey') }}</strong>
                  <p>{{ $t('admin.workflow.topicSourceProjectNodeKeyHint') }}</p>
                </div>
                <div class="workflow-topic-binding__control">
                  <a-select
                    :value="definition.sourceProjectNodeKey"
                    :options="workflowProjectNodeOptions.map((option) => ({ value: option.key, label: option.name }))"
                    :loading="workflowProjectNodeOptionsLoading"
                    :disabled="!canWrite || workflowProjectNodeOptionsLoading || !workflowProjectNodeOptions.length"
                    :placeholder="$t('admin.workflow.topicSourceProjectNodeKeyPlaceholder')"
                    :aria-label="$t('admin.workflow.topicSourceProjectNodeKey')"
                    show-search
                    option-filter-prop="label"
                    @change="updateTopicSourceProjectNodeKey"
                  />
                  <small v-if="!workflowProjectNodeOptionsLoading && !workflowProjectNodeOptions.length">
                    {{ $t('admin.workflow.topicSourceProjectNodeKeyNoOptions') }}
                  </small>
                </div>
              </section>
              <section v-if="selectedType?.code === 'story-management'" class="workflow-topic-binding" data-testid="workflow-story-binding">
                <div class="workflow-topic-binding__copy">
                  <strong>{{ $t('admin.workflow.storySourceTopicNodeKey') }}</strong>
                  <p>{{ $t('admin.workflow.storySourceTopicNodeKeyHint') }}</p>
                </div>
                <div class="workflow-topic-binding__control">
                  <a-select
                    :value="definition.sourceTopicNodeKey"
                    :options="workflowTopicNodeOptions.map((option) => ({ value: option.key, label: option.name }))"
                    :loading="workflowTopicNodeOptionsLoading"
                    :disabled="!canWrite || workflowTopicNodeOptionsLoading || !workflowTopicNodeOptions.length"
                    :placeholder="$t('admin.workflow.storySourceTopicNodeKeyPlaceholder')"
                    :aria-label="$t('admin.workflow.storySourceTopicNodeKey')"
                    show-search
                    option-filter-prop="label"
                    @change="updateStorySourceTopicNodeKey"
                  />
                  <small v-if="!workflowTopicNodeOptionsLoading && !workflowTopicNodeOptions.length">
                    {{ $t('admin.workflow.storySourceTopicNodeKeyNoOptions') }}
                  </small>
                </div>
              </section>
            </section>

            <section class="workflow-canvas-panel" :aria-label="$t('admin.workflow.canvasAria')">
              <div class="canvas-caption">
                <div class="canvas-caption__meta"><strong>{{ selectedType?.name }}</strong><span>{{ $t('admin.workflow.sequentialOnly') }}</span></div>
                <div class="canvas-caption__controls"><span class="canvas-scroll-hint">{{ $t('admin.workflow.canvasScrollHint') }}</span><a-button v-if="canWrite" size="small" @click="addNode"><PlusOutlined /> {{ $t('admin.workflow.addStage') }}</a-button></div>
              </div>
              <div class="workflow-canvas-scroll">
                <div class="workflow-canvas">
                  <template v-for="(node, index) in definition.nodes" :key="node.key">
                    <div v-if="index" class="workflow-connector" aria-hidden="true"><span /></div>
                    <article
                      class="workflow-node-card"
                      :class="{ selected: selectedNodeKey === node.key, dragging: dragKey === node.key, 'delete-hovered': deleteHoverKey === node.key }"
                      :draggable="canWrite"
                      @click="selectNode(node.key)"
                      @dragstart.stop="dragKey = node.key"
                      @dragend.stop="dragKey = undefined"
                      @dragover.prevent
                      @drop.prevent="onDrop(index)"
                    >
                      <span class="stage-index">{{ String(index + 1).padStart(2, '0') }}</span>
                      <button type="button" class="workflow-node-card__copy workflow-node-select" :aria-pressed="selectedNodeKey === node.key" :aria-label="node.name || $t('admin.workflow.unnamedNode')" @click="selectNode(node.key)"><strong>{{ node.name || $t('admin.workflow.unnamedNode') }}</strong><span class="workflow-node-card__meta"><span class="workflow-node-card__stat" :class="{ 'workflow-node-card__stat--empty': visibleFieldCount(node) === 0 }">{{ $t('admin.workflow.fieldCount', { count: visibleFieldCount(node) }) }}</span></span></button>
                      <button type="button" class="workflow-node-card__remove" :disabled="!canWrite || definition.nodes.length <= 1" :aria-label="$t('admin.workflow.removeNode')" :title="$t('admin.workflow.removeNode')" @mouseenter="deleteHoverKey = node.key" @mouseleave="deleteHoverKey = undefined" @click.stop="removeNode(node)"><DeleteOutlined /></button>
                    </article>
                  </template>
                </div>
              </div>
            </section>

            <section v-if="currentNode" class="workflow-node-designer" data-testid="node-designer">
              <header class="designer-node-heading">
                <div class="designer-node-heading__copy"><span>{{ $t('admin.workflow.editingStage', { index: selectedNodeIndex + 1 }) }}</span><h2>{{ currentNode.name || $t('admin.workflow.unnamedNode') }}</h2><p>{{ currentNode.description || $t('admin.workflow.noNodeDescription') }}</p></div>
              </header>

              <div class="designer-grid">
                <aside class="designer-panel designer-palette" data-testid="designer-palette" :aria-label="$t('admin.workflow.fieldPaletteAria')">
                  <div class="designer-panel-heading"><h3>{{ $t('admin.workflow.fieldComponents') }}</h3><p>{{ $t('admin.workflow.addFieldHint') }}</p></div>
                  <div class="designer-palette-list">
                    <button v-for="type in fieldTypes" :key="type" type="button" class="designer-palette-item" :data-testid="`add-workflow-field-${type}`" :aria-label="`${$t('admin.workflow.addField')}：${fieldTypeLabel(type)}`" :disabled="!canWrite" @click="addField(type, $event)">
                      <span class="field-type-symbol"><component :is="fieldTypeIcon(type)" /></span><span class="designer-palette-item__copy"><strong>{{ fieldTypeLabel(type) }}</strong><small>{{ $t(`admin.workflow.fieldTypeHints.${type}`) }}</small></span><PlusOutlined />
                    </button>
                  </div>
                  <div class="designer-palette-section">
                    <div class="designer-subheading"><strong>{{ $t('admin.workflow.projectFields') }}</strong><small>{{ $t('admin.workflow.projectFieldsHint') }}</small></div>
                    <button v-for="[key, binding] in availableBindings" :key="binding.binding" type="button" class="designer-palette-item designer-palette-item--compact" :disabled="!canWrite" @click="addBoundField(key, $event)"><span class="field-type-symbol"><component :is="fieldTypeIcon(binding.type)" /></span><span class="designer-palette-item__copy"><strong>{{ $t(`admin.workflow.projectFieldLabels.${key}`) }}</strong><small>{{ fieldTypeLabel(binding.type) }}</small></span><PlusOutlined /></button>
                    <a-empty v-if="!availableBindings.length" :description="$t('admin.workflow.noAvailableProjectFields')" />
                  </div>
                  <div class="designer-palette-section">
                    <div class="designer-subheading"><strong>{{ $t('admin.workflow.workbenchComponents') }}</strong><small>{{ $t('admin.workflow.workbenchComponentsHint') }}</small></div>
                    <button v-for="component in COMPONENTS" :key="component.key" type="button" class="designer-palette-item designer-palette-item--compact" :data-testid="`add-workflow-component-${component.key}`" :class="{ 'is-added': configuredComponents.includes(component.key) }" :aria-pressed="configuredComponents.includes(component.key)" :disabled="!canWrite" @click="toggleComponent(component.key, !configuredComponents.includes(component.key))"><span class="field-type-symbol"><CheckOutlined v-if="configuredComponents.includes(component.key)" /><PlusOutlined v-else /></span><span class="designer-palette-item__copy"><strong>{{ componentLabel(component.key) }}</strong><small>{{ $t(`admin.workflow.componentHints.${component.key}`) }}</small></span><span class="palette-state">{{ configuredComponents.includes(component.key) ? $t('admin.workflow.added') : $t('admin.workflow.add') }}</span></button>
                  </div>
                </aside>

                <section class="designer-panel designer-canvas" data-testid="designer-canvas" :aria-label="$t('admin.workflow.nodeCanvasAria')">
                  <div class="designer-canvas-heading"><div><span>{{ $t('admin.workflow.nodeDetailCanvas') }}</span><h3>{{ currentNode.name || $t('admin.workflow.unnamedNode') }}</h3><p>{{ currentNode.description || $t('admin.workflow.noNodeDescription') }}</p></div><div class="designer-canvas-heading__actions"><span class="designer-canvas-heading__hint">{{ $t('admin.workflow.dragFieldsHint') }}</span><a-button size="small" type="link" aria-controls="workflow-inspector-panel" @click="openNodeSettings($event)">{{ $t('admin.workflow.nodeSettings') }}</a-button></div></div>
                  <div class="designer-fixed-grid">
                    <section class="designer-fixed-module" data-testid="designer-fixed-owner"><div class="designer-fixed-module__heading"><strong>{{ $t('admin.workflow.fixedBlocks.owner') }}</strong><a-tag color="blue">{{ $t('admin.workflow.fixed') }}</a-tag></div><a-select disabled :placeholder="$t('admin.workflow.previewPerson')" /></section>
                    <section class="designer-fixed-module" data-testid="designer-fixed-schedule"><div class="designer-fixed-module__heading"><strong>{{ $t('admin.workflow.fixedBlocks.schedule') }}</strong><a-tag color="blue">{{ $t('admin.workflow.fixed') }}</a-tag></div><a-range-picker disabled /></section>
                  </div>

                  <div class="designer-content-stack">
                    <template v-for="(contentItem, contentIndex) in currentNode.contentOrder" :key="contentItem">
                      <section v-if="contentItem === 'fields' || contentItem === 'legacy-custom-fields'" class="designer-content-item designer-fields-section" :data-content-item="contentItem" :draggable="canWrite" @dragstart="contentDragItem = contentItem" @dragover.prevent @drop.prevent="onContentDrop(contentIndex)" @dragend="contentDragItem = undefined">
                        <div class="designer-content-heading"><div><strong>{{ contentItemLabel(contentItem) }}</strong><small>{{ $t('admin.workflow.individualFieldHint') }}</small></div><div class="designer-fields-section__tools"><span>{{ fieldsForContentItem(currentNode, contentItem, true).filter((field) => field.visible !== false).length }} / {{ fieldsForContentItem(currentNode, contentItem, true).length }}</span><a-button size="small" type="text" :disabled="!canWrite || contentIndex === 0" :data-testid="`move-workflow-section-up-${contentItem}`" :aria-label="`${$t('admin.workflow.moveUp')}：${contentItemLabel(contentItem)}`" @click="moveContentItem(contentItem, -1)"><ArrowUpOutlined /></a-button><a-button size="small" type="text" :disabled="!canWrite || contentIndex === currentNode.contentOrder.length - 1" :data-testid="`move-workflow-section-down-${contentItem}`" :aria-label="`${$t('admin.workflow.moveDown')}：${contentItemLabel(contentItem)}`" @click="moveContentItem(contentItem, 1)"><ArrowDownOutlined /></a-button></div></div>
                        <div class="designer-field-grid">
                          <article v-for="field in fieldsForContentItem(currentNode, contentItem, true)" :key="field.key" class="designer-field-card" :class="{ selected: selectedFieldKey === field.key, 'is-hidden': field.visible === false, 'designer-field-card--wide': isWorkflowFieldFullWidth(field) }" data-testid="designer-field-card" :data-field-key="field.key" :aria-label="`${field.label}，${fieldTypeLabel(field.type)}`" role="group" :draggable="canWrite" @dragstart.stop="fieldDragKey = field.key" @dragover.prevent @drop.prevent.stop="onFieldDrop(fieldIndex(field.key))" @dragend.stop="fieldDragKey = undefined">
                            <div class="designer-field-card__top"><span>{{ fieldTypeLabel(field.type) }}</span><a-tag v-if="field.visible === false" color="default">{{ $t('admin.workflow.hidden') }}</a-tag><span v-else-if="field.binding" class="designer-field-binding">{{ $t('admin.workflow.projectBinding') }}</span><a-tag v-else-if="field.required" color="red">{{ $t('admin.workflow.required') }}</a-tag></div>
                            <div class="designer-field-card__name"><button type="button" class="designer-field-select" :aria-pressed="selectedFieldKey === field.key" aria-controls="workflow-inspector-panel" :aria-label="`${field.label}，${fieldTypeLabel(field.type)}`" @click="selectField(field.key, $event)"><strong>{{ field.label || $t('admin.workflow.unnamedField') }}</strong><em v-if="field.required">*</em></button><div class="designer-field-card__actions"><a-button size="small" type="text" :disabled="!canWrite || fieldIndexInContentItem(field.key, contentItem) === 0" :data-testid="`move-workflow-field-${field.key}-up`" :aria-label="`${$t('admin.workflow.moveUp')}：${field.label}`" @click.stop="moveField(field.key, -1, contentItem)"><ArrowUpOutlined /></a-button><a-button size="small" type="text" :disabled="!canWrite || fieldIndexInContentItem(field.key, contentItem) === fieldsForContentItem(currentNode, contentItem, true).length - 1" :data-testid="`move-workflow-field-${field.key}-down`" :aria-label="`${$t('admin.workflow.moveDown')}：${field.label}`" @click.stop="moveField(field.key, 1, contentItem)"><ArrowDownOutlined /></a-button></div></div>
                            <small class="designer-field-card__key">{{ field.binding ? bindingLabel(field.binding) : `${$t('admin.workflow.nodeField')} · ${field.key}` }}</small>
                            <div class="designer-field-control">
                              <a-input v-if="field.type === 'TEXT'" disabled :placeholder="$t('admin.workflow.previewValue')" />
                              <a-textarea v-else-if="field.type === 'TEXTAREA'" disabled :placeholder="$t('admin.workflow.previewValue')" :rows="2" />
                              <a-input v-else-if="field.type === 'NUMBER'" disabled type="number" :placeholder="$t('admin.workflow.previewValue')" />
                              <a-radio-group v-else-if="field.type === 'RADIO'" disabled><a-radio v-for="option in field.options" :key="option" :value="option">{{ option }}</a-radio><a-radio v-if="!field.options.length" disabled>{{ $t('admin.workflow.optionPlaceholder') }}</a-radio></a-radio-group>
                              <a-select v-else-if="field.type === 'SINGLE_SELECT'" disabled :placeholder="$t('admin.workflow.previewValue')"><a-select-option v-for="option in field.options" :key="option" :value="option">{{ option }}</a-select-option></a-select>
                              <a-select v-else-if="field.type === 'MULTI_SELECT'" mode="multiple" disabled :placeholder="$t('admin.workflow.previewValue')"><a-select-option v-for="option in field.options" :key="option" :value="option">{{ option }}</a-select-option></a-select>
                              <a-select v-else-if="field.type === 'PERSON'" disabled :placeholder="$t('admin.workflow.previewPerson')" />
                              <a-select v-else-if="field.type === 'PERSON_MULTI'" mode="multiple" disabled :placeholder="$t('admin.workflow.previewPeople')" />
                              <a-date-picker v-else-if="field.type === 'DATE'" disabled />
                              <a-range-picker v-else-if="field.type === 'DATE_RANGE'" disabled />
                              <div v-else class="designer-attachment-placeholder">{{ $t('admin.workflow.previewAttachment') }}</div>
                            </div>
                          </article>
                          <a-empty v-if="!fieldsForContentItem(currentNode, contentItem, true).length" :description="$t('admin.workflow.noCustomFields')" />
                        </div>
                      </section>
                      <section v-else class="designer-content-item designer-workbench-card" :data-content-item="contentItem" :draggable="canWrite" @dragstart="contentDragItem = contentItem" @dragover.prevent @drop.prevent="onContentDrop(contentIndex)" @dragend="contentDragItem = undefined">
                        <div><strong>{{ contentItemLabel(contentItem) }}</strong><p>{{ $t(`admin.workflow.componentHints.${contentItem.slice('component:'.length)}`) }}</p><div class="designer-workbench-placeholder">{{ $t('admin.workflow.reusedComponent') }}</div></div>
                        <div class="designer-workbench-actions"><a-button size="small" :disabled="!canWrite || contentIndex === 0" :aria-label="$t('admin.workflow.moveUp')" @click="moveContentItem(contentItem, -1)"><ArrowUpOutlined /></a-button><a-button size="small" :disabled="!canWrite || contentIndex === currentNode.contentOrder.length - 1" :aria-label="$t('admin.workflow.moveDown')" @click="moveContentItem(contentItem, 1)"><ArrowDownOutlined /></a-button><a-button size="small" danger :disabled="!canWrite" :aria-label="$t('admin.workflow.removeComponent')" @click="removeContentItem(contentItem)"><DeleteOutlined /></a-button></div>
                      </section>
                    </template>
                    <a-empty v-if="!currentNode.contentOrder.length" :description="$t('admin.workflow.noContentItems')" />
                  </div>

                  <section class="designer-fixed-module designer-task-board" data-testid="designer-fixed-task-board"><div class="designer-fixed-module__heading"><strong>{{ $t('admin.workflow.fixedBlocks.task-board') }}</strong><a-tag color="blue">{{ $t('admin.workflow.fixed') }}</a-tag></div><div class="designer-task-columns"><div v-for="column in ['todo', 'inProgress', 'done']" :key="column"><span>{{ $t(`admin.workflow.taskColumns.${column}`) }}</span><small>+ {{ $t('admin.workflow.addTask') }}</small></div></div></section>
                </section>

                <aside id="workflow-inspector-panel" ref="mobileInspectorPanel" class="designer-panel designer-inspector" :class="{ 'designer-inspector--mobile-open': mobileInspectorOpen }" data-testid="designer-inspector" :aria-label="selectedField ? $t('admin.workflow.fieldProperties') : $t('admin.workflow.nodeProperties')" @keydown.esc.stop.prevent="closeMobileInspector">
                  <div class="designer-panel-heading"><div><h3>{{ selectedField ? $t('admin.workflow.fieldProperties') : $t('admin.workflow.nodeProperties') }}</h3><p>{{ selectedField?.label || currentNode.name }}</p></div><div class="designer-inspector__heading-actions"><a-button v-if="selectedField" type="text" size="small" :aria-label="$t('admin.workflow.nodeSettings')" @click="selectedFieldKey = ''">{{ $t('admin.workflow.nodeSettings') }}</a-button><a-button v-else type="text" size="small" :aria-label="$t('admin.workflow.fieldProperties')" :disabled="!currentNode.fields.length" @click="selectedFieldKey = firstFieldKey(currentNode)">{{ $t('admin.workflow.fieldProperties') }}</a-button><a-button class="designer-inspector__close" type="text" size="small" data-mobile-inspector-close :aria-label="$t('admin.workflow.closeInspector')" @click="closeMobileInspector"><CloseOutlined /></a-button></div></div>
                  <a-form v-if="selectedField" layout="vertical" class="designer-property-form">
                    <a-form-item :label="$t('admin.workflow.fieldLabel')"><a-input id="workflow-field-label" v-model:value="selectedField.label" :disabled="!canWrite" :maxlength="60" @input="markDirty" /></a-form-item>
                    <a-form-item :label="$t('admin.workflow.fieldKey')"><a-input :value="selectedField.key" disabled /></a-form-item>
                    <a-form-item :label="selectedField.binding ? $t('admin.workflow.binding') : $t('admin.workflow.fieldType')"><a-input v-if="selectedField.binding" :value="`${bindingLabel(selectedField.binding)} · ${fieldTypeLabel(selectedField.type)}`" disabled /><a-select v-else :value="selectedField.type" :disabled="!canWrite" @change="updateFieldType(selectedField, $event)"><a-select-option v-for="type in fieldTypes" :key="type" :value="type">{{ fieldTypeLabel(type) }}</a-select-option></a-select></a-form-item>
                    <a-form-item v-if="['RADIO', 'SINGLE_SELECT', 'MULTI_SELECT'].includes(selectedField.type)" :label="$t('admin.workflow.fieldOptions')"><a-textarea id="workflow-field-options" :value="selectedField.options.join(', ')" :disabled="!canWrite" :placeholder="$t('admin.workflow.optionsComma')" :rows="3" @change="setFieldOptionsFromEvent(selectedField, $event)" /></a-form-item>
                    <div class="designer-property-switches"><a-checkbox :checked="selectedField.visible !== false" :disabled="!canWrite" @change="updateFieldVisibility(selectedField, checkboxChecked($event))">{{ $t('admin.workflow.visible') }}</a-checkbox><a-checkbox id="workflow-field-required" v-model:checked="selectedField.required" :disabled="!canWrite || selectedField.visible === false" @change="markDirty">{{ $t('admin.workflow.required') }}</a-checkbox><a-checkbox id="workflow-field-full-width" :checked="isWorkflowFieldFullWidth(selectedField)" :disabled="!canWrite" @change="updateFieldWidth(selectedField, checkboxChecked($event))">{{ $t('admin.workflow.fullWidth') }}</a-checkbox></div>
                    <small class="designer-field-width-hint">{{ $t('admin.workflow.fieldWidthHint') }}</small>
                    <a-button v-if="canWrite" block danger class="designer-remove-field" @click="removeField(selectedField.key)"><DeleteOutlined /> {{ $t('admin.workflow.removeField') }}</a-button>
                  </a-form>
                  <a-form v-else layout="vertical" class="designer-property-form">
                    <a-form-item :label="$t('admin.workflow.nodeName')"><a-input v-model:value="currentNode.name" :disabled="!canWrite" :maxlength="80" @input="markDirty" /></a-form-item>
                    <a-form-item :label="$t('admin.workflow.nodeKey')"><a-input :value="currentNode.key" disabled /><small>{{ $t('admin.workflow.nodeKeyHint') }}</small></a-form-item>
                    <a-form-item :label="$t('admin.workflow.nodeDescription')"><a-textarea v-model:value="currentNode.description" :disabled="!canWrite" :rows="3" @input="markDirty" /></a-form-item>
                    <a-form-item :label="$t('admin.workflow.deliverables')"><a-textarea v-model:value="currentNode.deliverable" :disabled="!canWrite" :rows="3" @input="markDirty" /></a-form-item>
                    <a-form-item :label="$t('admin.workflow.roles')"><a-textarea v-model:value="currentNode.roles" :disabled="!canWrite" :rows="3" @input="markDirty" /></a-form-item>
                  </a-form>
                </aside>
              </div>
            </section>

            <a-empty v-if="!currentNode" :description="$t('admin.workflow.chooseOrCreate')" />
          </template>
        </div>
      </a-spin>
    </div>

    <a-modal v-model:open="previewOpen" :title="$t('admin.workflow.previewTitle')" width="780px" :footer="null">
      <div class="template-preview-flow"><div v-for="(node, index) in definition.nodes" :key="node.key" class="template-preview-node"><span>{{ String(index + 1).padStart(2, '0') }}</span><strong>{{ node.name }}</strong><small>{{ node.contentOrder.map((item) => contentItemLabel(item)).join(' · ') || $t('admin.workflow.custom') }}</small><div>{{ $t('admin.workflow.fixedBlocksTitle') }}：{{ FIXED_NODE_BLOCKS.map((block) => t(`admin.workflow.fixedBlocks.${block}`)).join('、') }}</div><template v-for="contentItem in node.contentOrder" :key="contentItem"><div v-if="contentItem === 'fields' || contentItem === 'legacy-custom-fields'" class="template-preview-content-item"><b>{{ contentItemLabel(contentItem) }}</b><div v-for="field in fieldsForContentItem(node, contentItem)" :key="field.key" class="preview-field-line">{{ field.label }} · {{ fieldTypeLabel(field.type) }}<b v-if="field.required">*</b></div></div><div v-else class="template-preview-content-item"><b>{{ contentItemLabel(contentItem) }}</b><small>{{ $t(`admin.workflow.componentHints.${contentItem.slice('component:'.length)}`) }}</small></div></template></div></div>
    </a-modal>

    <a-modal v-model:open="typeModalOpen" :title="$t('admin.workflow.addProcessType')" :ok-text="$t('common.save')" :cancel-text="$t('common.cancel')" @ok="saveType">
      <a-form layout="vertical"><a-form-item :label="$t('admin.workflow.typeName')" required><a-input v-model:value="typeForm.name" /></a-form-item><a-form-item :label="$t('admin.workflow.typeDescription')"><a-textarea v-model:value="typeForm.description" :rows="2" /></a-form-item></a-form>
    </a-modal>

    <a-modal v-model:open="versionModalOpen" :title="$t('admin.workflow.versionManager')" width="680px" :footer="null" data-testid="workflow-version-modal">
      <div class="workflow-version-manager">
        <p class="workflow-version-manager__description">{{ $t('admin.workflow.versionManagerDescription') }}</p>
        <div v-if="workflowVersions.length" class="workflow-version-list">
          <article v-for="version in workflowVersions" :key="version.id" class="workflow-version-row" :data-version-id="version.id">
            <div class="workflow-version-row__summary">
              <strong>v{{ version.versionNo }}</strong>
              <a-tag v-if="version.isDefault" color="blue">{{ $t('admin.workflow.default') }}</a-tag>
              <a-tag v-if="version.status === 'ARCHIVED'">{{ $t('admin.workflow.archivedVersion') }}</a-tag>
              <a-tag v-else-if="version.status === 'PUBLISHED'" color="green">{{ $t('admin.workflow.publishedVersionStatus') }}</a-tag>
              <a-tag v-else-if="version.status === 'DRAFT'" color="orange">{{ $t('admin.workflow.draftVersionStatus') }}</a-tag>
            </div>
            <div class="workflow-version-row__actions">
              <a-button v-if="canWrite && version.status === 'PUBLISHED' && !version.isDefault" size="small" :disabled="saving || loading" @click="setVersionAsDefault(version)">{{ $t('admin.workflow.setDefaultVersion') }}</a-button>
              <a-button v-if="canWrite && version.status === 'PUBLISHED' && !version.isDefault" size="small" danger :disabled="saving || loading" @click="archiveVersion(version)">{{ $t('admin.workflow.archiveVersion') }}</a-button>
            </div>
          </article>
        </div>
        <a-empty v-else :description="$t('admin.workflow.noWorkflowVersions')" />
        <div class="workflow-version-manager__footer"><a-button @click="versionModalOpen = false">{{ $t('admin.workflow.versionManagerClose') }}</a-button></div>
      </div>
    </a-modal>
  </section>
</template>

<style scoped>
.workflow-admin-page { display: grid; gap: var(--pms-space-4); min-width: 0; }
.workflow-admin-page :deep(.workflow-page-actions) { display: flex; align-items: center; justify-content: flex-end; gap: var(--pms-space-3); flex-wrap: wrap; }
.workflow-admin-page :deep(.workflow-page-actions__secondary), .workflow-admin-page :deep(.workflow-page-actions__primary) { display: flex; align-items: center; gap: var(--pms-space-2); flex-wrap: nowrap; flex: 0 0 auto; }
.workflow-admin-page :deep(.workflow-page-actions__primary) { padding-inline-start: var(--pms-space-3); border-inline-start: 1px solid var(--pms-border); }
.workflow-admin-layout { display: grid; grid-template-columns: minmax(240px, 260px) minmax(0, 1fr); align-items: start; gap: var(--pms-space-4); }
.workflow-library, .workflow-editor, .workflow-canvas-panel, .node-inspector { background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: var(--pms-radius); box-shadow: var(--pms-shadow-sm); }
.workflow-library { position: sticky; top: calc(var(--pms-topbar-height) + var(--pms-space-4)); max-height: calc(100vh - var(--pms-topbar-height) - var(--pms-space-8)); padding: var(--pms-space-4); overflow-y: auto; }
.library-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--pms-space-2); padding: 0 0 var(--pms-space-3); }
.library-heading strong, .library-heading small { display: block; }
.library-heading strong { color: var(--pms-text); font-size: var(--pms-font-size-body); font-weight: 680; }
.library-heading small { margin-top: var(--pms-space-2); color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); line-height: var(--pms-line-height-normal); }
.template-heading { margin-top: var(--pms-space-4); padding-top: var(--pms-space-4); border-top: 1px solid var(--pms-border); }
.type-choice, .template-choice { display: grid; width: 100%; gap: var(--pms-space-2); padding: var(--pms-space-3); color: var(--pms-text); text-align: left; background: transparent; border: 1px solid transparent; border-radius: var(--pms-radius); cursor: pointer; }
.type-choice:hover, .template-choice:hover { background: var(--pms-surface-muted); }
.type-choice.active, .template-choice.active { background: var(--pms-primary-soft); border-color: var(--pms-primary); }
.type-choice small, .template-choice small { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); line-height: var(--pms-line-height-normal); }
.template-choice__title { display: flex; align-items: center; justify-content: space-between; gap: var(--pms-space-2); font-size: var(--pms-font-size-body); font-weight: 650; }
.workflow-editor { min-width: 0; padding: var(--pms-space-5); }
.editor-topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--pms-space-4); margin-bottom: var(--pms-space-4); }
.editor-meta { display: grid; flex: 1; gap: var(--pms-space-2); max-width: 580px; }
.editor-status { display: flex; align-items: center; gap: var(--pms-space-2); }
.workflow-canvas-panel { padding: var(--pms-space-4); overflow: hidden; background: var(--pms-surface-muted); }
.canvas-caption { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--pms-space-3); margin-bottom: var(--pms-space-3); }
.canvas-caption__meta, .canvas-caption__controls { display: flex; align-items: center; flex-wrap: wrap; gap: var(--pms-space-2); }
.canvas-caption strong { color: var(--pms-text); font-size: var(--pms-font-size-body); }
.canvas-caption__meta > span { color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.canvas-scroll-hint { color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); }
.workflow-canvas-scroll { overflow-x: auto; padding: var(--pms-space-2) var(--pms-space-2) var(--pms-space-4); }
.workflow-canvas { display: flex; align-items: center; min-width: max-content; }
.workflow-node-card { position: relative; display: flex; flex: 0 0 236px; flex-direction: column; min-height: 190px; padding: var(--pms-space-4); background: var(--pms-surface); border: 1px solid var(--pms-border-strong); border-radius: var(--pms-radius); box-shadow: var(--pms-shadow-sm); cursor: pointer; transition: border-color var(--pms-motion-fast) ease, box-shadow var(--pms-motion-fast) ease, transform var(--pms-motion-fast) ease; }
.workflow-node-card:hover { transform: translateY(-1px); }
.workflow-node-card:focus-visible { outline: 0; box-shadow: var(--pms-focus-ring), var(--pms-shadow-sm); }
.workflow-node-card.selected { border-color: var(--pms-primary); box-shadow: 0 0 0 3px var(--pms-primary-soft); }
.workflow-node-card.delete-hovered { border-color: var(--pms-danger); box-shadow: 0 0 0 3px var(--pms-danger-soft); }
.workflow-node-card.dragging { opacity: .5; }
.workflow-node-card__top { display: flex; align-items: center; justify-content: space-between; gap: var(--pms-space-2); margin-bottom: var(--pms-space-3); }
.stage-index { display: grid; width: 32px; height: 32px; flex: 0 0 32px; place-items: center; color: var(--pms-primary); background: var(--pms-primary-soft); border-radius: 50%; font-size: var(--pms-font-size-caption); font-weight: 750; }
.stage-status { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.workflow-node-card strong { color: var(--pms-text); font-size: var(--pms-font-size-body); line-height: var(--pms-line-height-tight); }
.workflow-node-card p { min-height: 38px; margin: var(--pms-space-2) 0 var(--pms-space-3); color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-relaxed); }
.node-component-chips { display: flex; flex-wrap: wrap; gap: var(--pms-space-2); min-height: 22px; }
.node-component-chips :deep(.ant-tag) { margin: 0; font-size: var(--pms-font-size-caption); }
.workflow-connector { position: relative; flex: 0 0 var(--pms-space-8); height: 1px; background: var(--pms-border-strong); }
.workflow-connector span { position: absolute; top: -4px; right: 0; width: 8px; height: 8px; border-top: 1px solid var(--pms-border-strong); border-right: 1px solid var(--pms-border-strong); transform: rotate(45deg); }
.fixed-blocks { display: flex; flex-wrap: wrap; align-items: center; gap: var(--pms-space-2); padding-top: var(--pms-space-3); border-top: 1px solid var(--pms-border); }
.fixed-blocks > span { margin-right: var(--pms-space-2); color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); }
.workflow-canvas-panel :deep(.ant-tag) { margin-inline-end: 0; }
.node-inspector { margin-top: var(--pms-space-4); padding: var(--pms-space-6); }
.inspector-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--pms-space-3); padding-bottom: var(--pms-space-4); border-bottom: 1px solid var(--pms-border); }
.inspector-header span { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.inspector-header h2 { margin: var(--pms-space-2) 0 0; color: var(--pms-text); font-size: var(--pms-font-size-title); font-weight: 700; line-height: var(--pms-line-height-tight); }
.inspector-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 300px); gap: var(--pms-space-6); padding-top: var(--pms-space-5); }
.inspector-main { min-width: 0; container-type: inline-size; }
.node-basic-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--pms-space-4); }
.node-basic-grid small { display: block; margin-top: var(--pms-space-2); color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); line-height: var(--pms-line-height-normal); }
.inspector-section { padding: var(--pms-space-4) 0; border-top: 1px solid var(--pms-border); }
.section-title { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--pms-space-3); margin-bottom: var(--pms-space-3); }
.section-title h3 { margin: 0; color: var(--pms-text); font-size: var(--pms-font-size-section); font-weight: 700; line-height: var(--pms-line-height-tight); }
.section-title p { margin: var(--pms-space-2) 0 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-relaxed); }
.component-option { display: grid; grid-template-columns: minmax(180px, .75fr) minmax(180px, 1fr); align-items: center; gap: var(--pms-space-3); padding: var(--pms-space-2) var(--pms-space-3); border-radius: var(--pms-radius-sm); }
.component-option:hover { background: var(--pms-surface-muted); }
.component-option small { color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-normal); }
.component-order-list { display: grid; gap: var(--pms-space-2); margin-top: var(--pms-space-4); padding: var(--pms-space-4); background: var(--pms-surface-muted); border-radius: var(--pms-radius); }
.component-order-list > span { color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.component-order-item { display: grid; grid-template-columns: minmax(0, 1fr) 32px 32px; align-items: center; gap: var(--pms-space-2); }
.component-order-item strong { color: var(--pms-text); font-size: var(--pms-font-size-compact); font-weight: 600; }
.field-order-tools { display: flex; align-items: center; gap: var(--pms-space-2); }
.field-order-tools :deep(.ant-btn) { width: 32px; min-width: 32px; height: var(--pms-control-height-compact); min-height: var(--pms-control-height-compact); padding: 0; border-radius: var(--pms-radius-sm); }
.project-field-option { display: grid; grid-template-columns: minmax(130px, 1fr) 82px 82px 72px; align-items: center; gap: var(--pms-space-2); padding: var(--pms-space-2) var(--pms-space-3); color: var(--pms-text); border-bottom: 1px solid var(--pms-border); font-size: var(--pms-font-size-compact); }
.component-library { display: grid; gap: var(--pms-space-3); }
.field-palette, .binding-palette { display: flex; flex-wrap: wrap; gap: var(--pms-space-2); }
.component-order-list { display: grid; gap: var(--pms-space-2); }
.content-order-item { display: flex; align-items: center; justify-content: space-between; gap: var(--pms-space-3); padding: var(--pms-space-3); color: var(--pms-text); background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); cursor: grab; font-size: var(--pms-font-size-compact); }
.content-order-item:focus-visible, .field-card:focus-visible { outline: 0; box-shadow: var(--pms-focus-ring); }
.custom-field-list { display: grid; gap: var(--pms-space-3); }
.custom-field-row { display: grid; grid-template-columns: minmax(120px, 1.1fr) minmax(110px, .9fr) minmax(110px, .9fr) minmax(84px, .6fr) minmax(84px, .6fr) minmax(140px, 1.2fr) auto; align-items: end; gap: var(--pms-space-3); padding: var(--pms-space-4); background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: var(--pms-radius); cursor: grab; }
.custom-field-cell { display: grid; min-width: 0; gap: var(--pms-space-2); color: var(--pms-text); font-size: var(--pms-font-size-compact); }
.custom-field-cell > span:first-child { color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); font-weight: 650; line-height: var(--pms-line-height-normal); }
.custom-field-cell :deep(.ant-input), .custom-field-cell :deep(.ant-select) { width: 100%; min-width: 0; }
.custom-field-required { align-content: start; }
.custom-field-required :deep(.ant-checkbox-wrapper) { min-height: var(--pms-control-height-compact); align-items: center; color: var(--pms-text); font-size: var(--pms-font-size-compact); }
.custom-field-no-options { min-height: var(--pms-control-height-compact); align-content: center; color: var(--pms-text-faint); }
.custom-field-actions { display: flex; align-items: center; gap: var(--pms-space-2); }
@container (max-width: 760px) {
  .custom-field-row { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-areas: "label key" "type options" "visible required" "actions actions"; align-items: start; }
  .custom-field-label { grid-area: label; }
  .custom-field-key { grid-area: key; }
  .custom-field-type { grid-area: type; }
  .custom-field-required { grid-area: required; align-self: end; }
  .custom-field-visible { grid-area: visible; align-self: end; }
  .custom-field-options { grid-area: options; }
  .custom-field-actions { grid-area: actions; align-self: end; justify-content: flex-end; }
}
.inspector-preview { align-self: start; min-width: 0; padding: var(--pms-space-4); background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: var(--pms-radius); }
.preview-sticky-title { display: flex; align-items: center; gap: var(--pms-space-2); color: var(--pms-primary); font-size: var(--pms-font-size-body); font-weight: 650; }
.preview-title { display: flex; gap: var(--pms-space-3); padding: var(--pms-space-4) 0; border-bottom: 1px solid var(--pms-border); }
.preview-title > span { display: grid; width: 32px; height: 32px; flex: 0 0 32px; place-items: center; color: var(--pms-primary); background: var(--pms-primary-soft); border-radius: 50%; font-size: var(--pms-font-size-caption); }
.preview-title strong, .preview-title small { display: block; }
.preview-title strong { color: var(--pms-text); font-size: var(--pms-font-size-body); }
.preview-title small { margin-top: var(--pms-space-2); color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-relaxed); }
.preview-fixed, .preview-section { display: grid; gap: var(--pms-space-2); padding: var(--pms-space-3) 0; color: var(--pms-text-muted); border-bottom: 1px solid var(--pms-border); font-size: var(--pms-font-size-compact); }
.preview-fixed b, .preview-section b { color: var(--pms-text); font-size: var(--pms-font-size-body); }
.preview-fixed span, .preview-section small { color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); }
.preview-section em, .preview-field-line b { color: var(--pms-danger); font-style: normal; }
.preview-owner-schedule { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--pms-space-2); }
.preview-owner-schedule > span, .preview-task-board, .preview-section label { display: grid; gap: var(--pms-space-2); padding: var(--pms-space-3); background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); }
.preview-task-board { gap: var(--pms-space-2); }
.preview-task-board i { color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); font-style: normal; }
.preview-section label { grid-template-columns: minmax(0, 1fr) auto; align-items: center; color: var(--pms-text-muted); }
.preview-section label input, .preview-section label textarea, .preview-module-placeholder { grid-column: 1 / -1; width: 100%; padding: var(--pms-space-2); color: var(--pms-text-faint); background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); font: inherit; }
.preview-section label textarea { min-height: var(--pms-control-height); resize: none; }
.preview-component-card p { margin: 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-relaxed); }
.template-preview-flow { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--pms-space-3); max-height: 65vh; overflow: auto; }
.template-preview-node { display: grid; gap: var(--pms-space-2); min-width: 0; padding: var(--pms-space-4); background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: var(--pms-radius); }
.template-preview-node > span { color: var(--pms-primary); font-size: var(--pms-font-size-caption); }
.template-preview-node strong { color: var(--pms-text); font-size: var(--pms-font-size-body); }
.template-preview-node small, .template-preview-node div { color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-relaxed); overflow-wrap: anywhere; }
.workflow-admin-page :deep(.ant-form-item) { margin-bottom: var(--pms-space-3); }
@media (max-width: 1200px) {
  .inspector-grid { grid-template-columns: minmax(0, 1fr); }
  .inspector-preview { display: grid; }
}
@media (max-width: 900px) {
  .workflow-admin-layout { grid-template-columns: minmax(0, 1fr); }
  .workflow-library { position: static; max-height: 300px; }
  .template-preview-flow { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 700px) {
  .workflow-editor { padding: var(--pms-space-3); }
  .editor-topbar { flex-direction: column; }
  .editor-status { flex-wrap: wrap; }
  .node-basic-grid { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .component-option { grid-template-columns: minmax(0, 1fr); gap: var(--pms-space-2); }
  .project-field-option { grid-template-columns: minmax(0, 1fr) auto auto; }
  .project-field-option .field-order-tools { grid-column: 1 / -1; justify-content: flex-end; }
  .workflow-node-card { flex-basis: 220px; }
}

.workflow-editor { min-width: 0; padding: 0; background: transparent; border: 0; box-shadow: none; }
.workflow-entry-stack { display: grid; gap: var(--pms-space-4); }
.workflow-type-picker, .workflow-template-picker, .workflow-empty-state { min-width: 0; padding: var(--pms-space-4); background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: var(--pms-radius); box-shadow: var(--pms-shadow-sm); }
.workflow-entry-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--pms-space-3); margin-bottom: var(--pms-space-3); }
.workflow-entry-heading__copy { display: grid; min-width: 0; gap: var(--pms-space-2); }
.workflow-entry-heading h2 { margin: 0; color: var(--pms-text); font-size: var(--pms-font-size-section); font-weight: 680; line-height: var(--pms-line-height-tight); }
.workflow-entry-heading h2 span { color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); font-weight: 500; }
.workflow-entry-heading p, .workflow-selection-hint { margin: 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-relaxed); }
.workflow-choice-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--pms-space-3); }
.workflow-choice-card { display: grid; align-content: start; gap: var(--pms-space-2); min-width: 0; min-height: 92px; padding: var(--pms-space-3); color: var(--pms-text); text-align: left; background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); cursor: pointer; transition: border-color var(--pms-motion-fast) ease, background var(--pms-motion-fast) ease, box-shadow var(--pms-motion-fast) ease; }
.workflow-choice-card:hover { border-color: var(--pms-border-strong); background: var(--pms-surface-muted); }
.workflow-choice-card:focus-visible { outline: 0; box-shadow: var(--pms-focus-ring); }
.workflow-choice-card.is-selected { background: var(--pms-primary-soft); border-color: var(--pms-primary); box-shadow: 0 0 0 2px var(--pms-primary-soft); }
.workflow-choice-card__title, .workflow-choice-card__tags { display: flex; align-items: center; flex-wrap: wrap; gap: var(--pms-space-2); }
.workflow-choice-card__title { justify-content: space-between; }
.workflow-choice-card__title strong { min-width: 0; color: var(--pms-text); font-size: var(--pms-font-size-body); font-weight: 680; }
.workflow-choice-card__title :deep(.ant-tag), .workflow-choice-card__tags :deep(.ant-tag) { margin-inline-end: 0; }
.workflow-choice-card > small { color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); line-height: var(--pms-line-height-relaxed); }
.workflow-template-choice { min-height: 112px; }
.workflow-template-choice--create { align-content: center; justify-items: start; border-style: dashed; }
.workflow-template-create-icon { display: grid; width: 32px; height: 32px; place-items: center; color: var(--pms-primary); background: var(--pms-primary-soft); border-radius: var(--pms-radius-sm); }
.workflow-empty-state { background: var(--pms-surface-muted); border-style: dashed; box-shadow: none; }
.workflow-selection-hint { padding-top: var(--pms-space-3); }
.workflow-template-bar { display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; gap: var(--pms-space-3); margin-bottom: var(--pms-space-4); padding: var(--pms-space-4); background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: var(--pms-radius); box-shadow: var(--pms-shadow-sm); }
.template-current { display: grid; min-width: 0; gap: var(--pms-space-2); }
.template-current__heading { display: flex; min-width: 0; min-height: 36px; align-items: center; flex-wrap: wrap; gap: var(--pms-space-2); }
.template-current__eyebrow, .template-selector__heading > span { display: flex; min-height: 24px; align-items: center; color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); font-weight: 650; }
.template-current__status { display: flex; align-items: center; flex-wrap: wrap; gap: var(--pms-space-1); }
.template-current__status :deep(.ant-tag) { margin-inline-end: 0; }
.template-current__name { display: flex; align-items: center; gap: var(--pms-space-2); min-width: 0; }
.template-current__name :deep(.ant-input) { min-width: 0; color: var(--pms-text); font-size: var(--pms-font-size-body); font-weight: 650; }
.template-selectors { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: var(--pms-space-3); }
.template-selector { display: grid; min-width: 0; gap: var(--pms-space-2); }
.template-selector__heading { display: flex; min-width: 0; min-height: 36px; align-items: center; justify-content: space-between; gap: var(--pms-space-2); }
.template-selector__heading-actions { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: var(--pms-space-1); }
.template-selector__default-action { flex: 0 0 auto; white-space: nowrap; }
.template-selector__control { display: flex; align-items: center; gap: var(--pms-space-2); min-width: 0; }
.template-selector__control :deep(.ant-select) { flex: 1; min-width: 0; }
.template-selector__selected { display: flex; min-height: 40px; align-items: center; padding: 0 var(--pms-space-3); color: var(--pms-text); background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); font-size: var(--pms-font-size-compact); }
.workflow-template-version-guidance { display: flex; grid-column: 1 / -1; align-items: flex-start; gap: var(--pms-space-2); padding: var(--pms-space-3); color: var(--pms-text-muted); background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-relaxed); }
.workflow-template-version-guidance :deep(.anticon) { flex: 0 0 auto; color: var(--pms-primary); }
.workflow-topic-binding { display: grid; grid-template-columns: minmax(220px, .72fr) minmax(280px, 1.28fr); align-items: center; gap: var(--pms-space-4); padding: var(--pms-space-3); background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); }
.workflow-topic-binding__copy strong { color: var(--pms-text); font-size: var(--pms-font-size-body); }
.workflow-topic-binding__copy p { margin: var(--pms-space-1) 0 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-relaxed); }
.workflow-topic-binding__control { display: grid; gap: var(--pms-space-1); }
.workflow-topic-binding__control small { color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); }
.workflow-topic-binding__control :deep(.ant-select) { width: 100%; }
.workflow-version-manager { display: grid; gap: var(--pms-space-3); }
.workflow-version-manager__description { margin: 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-relaxed); }
.workflow-version-list { display: grid; max-height: min(56vh, 520px); overflow: auto; border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); }
.workflow-version-row { display: flex; align-items: center; justify-content: space-between; gap: var(--pms-space-3); min-width: 0; padding: var(--pms-space-3); background: var(--pms-surface); }
.workflow-version-row + .workflow-version-row { border-top: 1px solid var(--pms-border); }
.workflow-version-row__summary, .workflow-version-row__actions { display: flex; align-items: center; flex-wrap: wrap; gap: var(--pms-space-2); }
.workflow-version-row__summary { min-width: 120px; }
.workflow-version-row__summary strong { color: var(--pms-text); font-size: var(--pms-font-size-body); }
.workflow-version-row__summary :deep(.ant-tag) { margin-inline-end: 0; }
.workflow-version-row__actions { justify-content: flex-end; }
.workflow-version-manager__footer { display: flex; justify-content: flex-end; padding-top: var(--pms-space-2); }
.workflow-canvas-panel { padding: var(--pms-space-4); background: var(--pms-surface); }
.canvas-caption { align-items: center; margin-bottom: var(--pms-space-2); }
.workflow-canvas-scroll { padding-bottom: var(--pms-space-3); }
.workflow-node-card { display: grid; grid-template-columns: 28px minmax(0, 1fr) 24px; grid-template-rows: auto; flex: 0 0 196px; align-items: start; column-gap: var(--pms-space-2); height: 84px; min-height: 84px; padding: var(--pms-space-3); cursor: grab; }
.workflow-node-card:active { cursor: grabbing; }
.workflow-node-card strong { display: -webkit-box; overflow: hidden; color: var(--pms-text); text-overflow: ellipsis; white-space: normal; -webkit-box-orient: vertical; -webkit-line-clamp: 2; font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-tight); }
.workflow-node-card__copy { display: grid; grid-column: 2; grid-row: 1; align-self: start; width: 100%; min-width: 0; gap: var(--pms-space-2); }
.workflow-node-select { padding: 0; color: inherit; text-align: left; background: transparent; border: 0; cursor: grab; font: inherit; }
.workflow-node-select:active { cursor: grabbing; }
.workflow-node-select:focus-visible { outline: 0; border-radius: var(--pms-radius-sm); box-shadow: var(--pms-focus-ring); }
.stage-index { grid-column: 1; grid-row: 1; width: 28px; height: 28px; flex-basis: 28px; }
.workflow-node-card__remove { position: absolute; top: -6px; right: -6px; z-index: 1; display: grid; width: 12px; min-width: 12px; height: 12px; padding: 0; place-items: center; color: var(--pms-text-faint); background: transparent; border: 0; border-radius: 0; cursor: pointer; opacity: 0; visibility: hidden; pointer-events: none; transition: color var(--pms-motion-fast) ease, opacity var(--pms-motion-fast) ease; }
.workflow-node-card:hover .workflow-node-card__remove { opacity: 1; visibility: visible; pointer-events: auto; }
.workflow-node-card__remove:focus-visible { opacity: 1; visibility: visible; pointer-events: auto; }
.workflow-node-card__remove:hover { color: var(--pms-danger); background: transparent; }
.workflow-node-card__remove:focus-visible { outline: 0; box-shadow: var(--pms-focus-ring); }
.workflow-node-card__remove:disabled { cursor: not-allowed; opacity: .45; }
.workflow-node-card__meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--pms-space-1); margin-top: var(--pms-space-2); }
.workflow-node-card__stat { display: inline-flex; max-width: 100%; align-items: center; min-height: 20px; padding: 0 var(--pms-space-1); overflow: hidden; color: var(--pms-text-muted); background: var(--pms-surface-muted); border-radius: var(--pms-radius-sm); font-size: var(--pms-font-size-caption); line-height: var(--pms-line-height-normal); white-space: nowrap; }
.workflow-node-card__stat--empty { color: var(--pms-text-faint); }
.workflow-node-card__stat--workbench { color: var(--pms-primary); background: var(--pms-primary-soft); }
.workflow-connector { flex-basis: var(--pms-space-5); }
.workflow-node-designer { margin-top: var(--pms-space-4); padding: var(--pms-space-4); background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: var(--pms-radius); box-shadow: var(--pms-shadow-sm); }
.designer-node-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--pms-space-4); margin-bottom: var(--pms-space-4); padding: 0 0 var(--pms-space-3); border-bottom: 1px solid var(--pms-border); }
.designer-node-heading__copy > span { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.designer-node-heading h2 { margin: var(--pms-space-2) 0; color: var(--pms-text); font-size: var(--pms-font-size-title); line-height: var(--pms-line-height-tight); }
.designer-node-heading p { margin: 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-relaxed); }
.designer-grid { display: grid; grid-template-columns: minmax(168px, .72fr) minmax(340px, 2.25fr) minmax(196px, .82fr); align-items: start; gap: var(--pms-space-3); }
.designer-panel { min-width: 0; padding: var(--pms-space-3); background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: var(--pms-radius); }
.designer-panel-heading { display: flex; flex-direction: column; gap: var(--pms-space-2); margin-bottom: var(--pms-space-3); }
.designer-panel-heading h3 { margin: 0; color: var(--pms-text); font-size: var(--pms-font-size-section); font-weight: 700; line-height: var(--pms-line-height-tight); }
.designer-panel-heading p { margin: 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); line-height: var(--pms-line-height-normal); }
.designer-palette { position: sticky; top: calc(var(--pms-topbar-height) + var(--pms-space-3)); max-height: calc(100vh - var(--pms-topbar-height) - var(--pms-space-8)); overflow: auto; }
.designer-palette-list, .designer-palette-section { display: grid; gap: var(--pms-space-2); }
.designer-palette-section { margin-top: var(--pms-space-4); padding-top: var(--pms-space-3); border-top: 1px solid var(--pms-border); }
.designer-subheading { display: grid; gap: var(--pms-space-2); padding: 0 var(--pms-space-2); }
.designer-subheading strong { color: var(--pms-text); font-size: var(--pms-font-size-compact); }
.designer-subheading small { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); line-height: var(--pms-line-height-normal); }
.designer-palette-item { display: grid; grid-template-columns: 28px minmax(0, 1fr) 16px; align-items: center; gap: var(--pms-space-2); width: 100%; min-height: 42px; padding: var(--pms-space-2); color: var(--pms-text); text-align: left; background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); cursor: pointer; font: inherit; }
.designer-palette-item:hover:not(:disabled), .designer-palette-item.is-added { background: var(--pms-primary-soft); border-color: var(--pms-border-strong); }
.designer-palette-item:focus-visible { outline: 0; box-shadow: var(--pms-focus-ring); }
.designer-palette-item:disabled { cursor: not-allowed; opacity: .6; }
.designer-palette-item--compact { min-height: 38px; }
.designer-palette-item__copy { display: grid; min-width: 0; gap: var(--pms-space-2); }
.designer-palette-item__copy strong { overflow: hidden; color: var(--pms-text); text-overflow: ellipsis; white-space: nowrap; font-size: var(--pms-font-size-compact); font-weight: 600; }
.designer-palette-item__copy small { overflow: hidden; color: var(--pms-text-faint); text-overflow: ellipsis; white-space: nowrap; font-size: var(--pms-font-size-caption); }
.field-type-symbol { display: grid; width: 26px; height: 26px; place-items: center; color: var(--pms-primary); background: var(--pms-primary-soft); border-radius: var(--pms-radius-sm); font-size: var(--pms-font-size-compact); font-weight: 700; }
.palette-state { color: var(--pms-primary); font-size: var(--pms-font-size-caption); white-space: nowrap; }
.designer-canvas { display: grid; gap: var(--pms-space-3); background: var(--pms-surface); }
.designer-canvas-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--pms-space-3); }
.designer-canvas-heading__actions { display: flex; align-items: center; gap: var(--pms-space-2); }
.designer-canvas-heading > div > span { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.designer-canvas-heading h3 { margin: var(--pms-space-2) 0; color: var(--pms-text); font-size: var(--pms-font-size-body); }
.designer-canvas-heading p { margin: 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); line-height: var(--pms-line-height-relaxed); }
.designer-canvas-heading__hint { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); text-align: right; }
.designer-fixed-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--pms-space-2); }
.designer-fixed-module { min-width: 0; padding: var(--pms-space-3); background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); }
.designer-fixed-module__heading { display: flex; align-items: center; justify-content: space-between; gap: var(--pms-space-2); margin-bottom: var(--pms-space-2); }
.designer-fixed-module__heading strong { color: var(--pms-text); font-size: var(--pms-font-size-compact); }
.designer-fixed-module :deep(.ant-select), .designer-fixed-module :deep(.ant-picker) { width: 100%; }
.designer-fixed-module :deep(.ant-tag) { margin: 0; font-size: var(--pms-font-size-caption); }
.designer-content-stack { display: grid; gap: 0; min-width: 0; }
.designer-content-item { min-width: 0; padding: var(--pms-space-3) 0 0; background: transparent; border: 0; border-top: 1px solid var(--pms-border); border-radius: 0; }
.designer-content-item[draggable="true"] { cursor: grab; }
.designer-content-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--pms-space-3); margin-bottom: var(--pms-space-3); }
.designer-content-heading > div { display: grid; gap: var(--pms-space-2); }
.designer-content-heading > .designer-fields-section__tools { display: flex; align-items: center; }
.designer-content-heading strong, .designer-workbench-card strong { color: var(--pms-text); font-size: var(--pms-font-size-compact); }
.designer-content-heading small { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.designer-fields-section__tools { display: flex; align-items: center; gap: var(--pms-space-2); }
.designer-fields-section__tools > span { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.designer-fields-section__tools :deep(.ant-btn), .designer-field-card__actions :deep(.ant-btn) { width: 32px; min-width: 32px; height: 32px; padding: 0; }
.designer-field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 var(--pms-space-2); }
.designer-field-card--wide { grid-column: 1 / -1; }
.designer-field-card { display: grid; align-content: start; gap: var(--pms-space-2); min-width: 0; padding: var(--pms-space-3); background: transparent; border: 0; border-bottom: 1px solid var(--pms-border); border-radius: 0; cursor: grab; transition: background-color var(--pms-motion-fast) ease, box-shadow var(--pms-motion-fast) ease; }
.designer-field-card:hover { background: var(--pms-surface-muted); }
.designer-field-card.selected { background: var(--pms-primary-soft); box-shadow: inset 3px 0 0 var(--pms-primary); }
.designer-field-card.is-hidden { opacity: .62; border-style: dashed; }
.designer-field-card:focus-visible { outline: 0; box-shadow: var(--pms-focus-ring); }
.designer-field-card__top { display: flex; align-items: center; justify-content: space-between; gap: var(--pms-space-2); color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.designer-field-card__top :deep(.ant-tag) { margin: 0; font-size: var(--pms-font-size-caption); }
.designer-field-card__name { display: flex; align-items: center; justify-content: space-between; gap: var(--pms-space-2); min-width: 0; }
.designer-field-select { display: flex; align-items: center; gap: var(--pms-space-2); min-width: 0; padding: 0; color: inherit; text-align: left; background: transparent; border: 0; cursor: pointer; font: inherit; }
.designer-field-select:focus-visible { outline: 0; border-radius: var(--pms-radius-sm); box-shadow: var(--pms-focus-ring); }
.designer-field-card__actions { display: flex; flex: 0 0 auto; }
.designer-field-card__name strong { overflow: hidden; color: var(--pms-text); text-overflow: ellipsis; white-space: nowrap; font-size: var(--pms-font-size-compact); font-weight: 650; }
.designer-field-card__name em { color: var(--pms-danger); font-style: normal; }
.designer-field-card__key { overflow: hidden; color: var(--pms-text-faint); text-overflow: ellipsis; white-space: nowrap; font-size: var(--pms-font-size-caption); }
.designer-field-binding { color: var(--pms-primary); font-size: var(--pms-font-size-caption); }
.designer-field-control { min-width: 0; }
.designer-field-control :deep(.ant-input), .designer-field-control :deep(.ant-input-number), .designer-field-control :deep(.ant-select), .designer-field-control :deep(.ant-picker) { width: 100%; min-width: 0; font-size: var(--pms-font-size-caption); }
.designer-field-control :deep(.ant-radio-group) { display: flex; flex-wrap: wrap; gap: var(--pms-space-2); font-size: var(--pms-font-size-caption); }
.designer-field-control :deep(.ant-radio-wrapper) { margin: 0; font-size: var(--pms-font-size-caption); }
.designer-attachment-placeholder, .designer-workbench-placeholder { padding: var(--pms-space-2); color: var(--pms-text-faint); background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); font-size: var(--pms-font-size-caption); }
.designer-workbench-card { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--pms-space-3); }
.designer-workbench-card p { margin: var(--pms-space-2) 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); line-height: var(--pms-line-height-normal); }
.designer-workbench-actions { display: flex; gap: var(--pms-space-2); }
.designer-inspector { position: sticky; top: calc(var(--pms-topbar-height) + var(--pms-space-3)); padding: var(--pms-space-2); }
.designer-inspector .designer-panel-heading { flex-direction: row; align-items: flex-start; justify-content: space-between; gap: var(--pms-space-2); padding-bottom: var(--pms-space-3); border-bottom: 1px solid var(--pms-border); }
.designer-inspector .designer-panel-heading p { margin: var(--pms-space-2) 0 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); }
.designer-inspector__heading-actions { display: flex; align-items: center; gap: var(--pms-space-2); }
.designer-inspector__close { display: none; }
.designer-property-form { display: grid; gap: var(--pms-space-2); }
.designer-property-form :deep(.ant-form-item) { margin-bottom: var(--pms-space-2); }
.designer-property-form :deep(.ant-form-item-label > label) { color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.designer-property-form :deep(.ant-input), .designer-property-form :deep(.ant-select) { width: 100%; font-size: var(--pms-font-size-compact); }
.designer-property-form :deep(.ant-form-item-extra), .designer-property-form small { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); line-height: var(--pms-line-height-normal); }
.designer-property-switches { display: grid; gap: var(--pms-space-3); margin: var(--pms-space-2) 0 var(--pms-space-4); padding: var(--pms-space-3) 0; border-top: 1px solid var(--pms-border); border-bottom: 1px solid var(--pms-border); }
.designer-property-switches :deep(.ant-checkbox-wrapper) { color: var(--pms-text); font-size: var(--pms-font-size-compact); }
.designer-field-width-hint { display: block; margin: 0 0 var(--pms-space-3); color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.designer-remove-field { font-size: var(--pms-font-size-compact); }
.designer-task-board { display: grid; gap: var(--pms-space-2); margin-top: var(--pms-space-3); border-style: solid; }
.designer-task-columns { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--pms-space-2); }
.designer-task-columns > div { display: flex; align-items: center; justify-content: space-between; gap: var(--pms-space-2); min-width: 0; padding: var(--pms-space-2); background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: var(--pms-radius-sm); }
.designer-task-columns span { overflow: hidden; color: var(--pms-text); text-overflow: ellipsis; white-space: nowrap; font-size: var(--pms-font-size-caption); }
.designer-task-columns small { color: var(--pms-primary); font-size: var(--pms-font-size-caption); white-space: nowrap; }
.workflow-admin-page :deep(.ant-empty) { margin: var(--pms-space-3) 0; }
@media (max-width: 1200px) {
  .template-selectors { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--pms-space-2); }
  .designer-grid { grid-template-columns: minmax(150px, .7fr) minmax(300px, 2fr) minmax(180px, .82fr); }
}
@media (max-width: 980px) {
  .template-selectors { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .template-selectors > .template-current { grid-column: 1 / -1; }
  .designer-grid { grid-template-columns: minmax(155px, 220px) minmax(0, 1fr); }
  .designer-inspector { position: static; grid-column: 1 / -1; }
}
@media (max-width: 700px) {
  .workflow-editor { padding: 0; }
  .workflow-admin-page :deep(.workflow-page-actions) { width: 100%; justify-content: flex-start; }
  .workflow-type-picker, .workflow-template-picker, .workflow-empty-state { padding: var(--pms-space-3); }
  .workflow-entry-heading { align-items: flex-start; flex-direction: column; }
  .workflow-entry-heading > :deep(.ant-btn) { width: 100%; }
  .workflow-choice-grid { grid-template-columns: minmax(0, 1fr); }
  .workflow-template-bar { padding: var(--pms-space-3); }
  .template-current__heading { align-items: flex-start; }
  .workflow-version-row { align-items: flex-start; flex-direction: column; }
  .workflow-version-row__actions { justify-content: flex-start; }
  .template-selectors { grid-template-columns: minmax(0, 1fr); }
  .template-selectors > .template-current { grid-column: auto; }
  .workflow-topic-binding { grid-template-columns: minmax(0, 1fr); gap: var(--pms-space-2); }
  .workflow-canvas-panel { padding: var(--pms-space-3); }
  .workflow-node-card { flex-basis: 220px; min-height: 84px; padding-bottom: var(--pms-space-3); }
  .workflow-node-designer { padding: var(--pms-space-3); }
  .designer-grid { grid-template-columns: minmax(0, 1fr); }
  .designer-palette { position: static; max-height: none; }
  .designer-palette-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .designer-palette-item { grid-template-columns: 28px minmax(0, 1fr) 16px; }
  .designer-canvas-heading { flex-direction: column; }
  .designer-canvas-heading__actions { width: 100%; justify-content: space-between; }
  .designer-fixed-grid, .designer-field-grid { grid-template-columns: minmax(0, 1fr); }
  .designer-task-columns { grid-template-columns: minmax(0, 1fr); }
  .designer-inspector { position: fixed; z-index: 1100; left: 50%; bottom: 0; width: min(520px, calc(100vw - var(--pms-space-8))); max-height: min(60vh, 520px); overflow: auto; grid-column: auto; border-radius: var(--pms-radius) var(--pms-radius) 0 0; box-shadow: 0 -12px 32px rgb(16 34 63 / 18%); visibility: hidden; transform: translate(-50%, calc(100% + var(--pms-space-3))); transition: transform var(--pms-motion-fast) ease, visibility 0s linear var(--pms-motion-fast); }
  .designer-inspector:not(.designer-inspector--mobile-open) { visibility: hidden; }
  .designer-inspector--mobile-open { visibility: visible; transform: translate(-50%, 0); transition-delay: 0s; }
  .designer-inspector__close { display: inline-flex; }
}
</style>
