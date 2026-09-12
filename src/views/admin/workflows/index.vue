<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { PlusOutlined, EyeOutlined, SaveOutlined, SendOutlined, ArrowUpOutlined, ArrowDownOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
import { useUserStore } from '/@/store/user'
import {
  createWorkflowProjectType,
  createWorkflowTemplate,
  getWorkflowTemplate,
  listWorkflowProjectTypes,
  listWorkflowTemplates,
  publishWorkflowTemplate,
  saveWorkflowTemplateDraft,
  setWorkflowDefault,
} from '/@/api/admin-workflow'
import type { ProjectType, WorkflowContentOrderItem, WorkflowFieldBinding, WorkflowFieldDefinition, WorkflowFieldType, WorkflowNodeDefinitionV2, WorkflowTemplateDefinitionV2, WorkflowTemplateSummary } from '/@/types/workflow'
import {
  FIXED_NODE_BLOCKS,
  addWorkflowField,
  createWorkflowNode,
  moveWorkflowContentItem,
  moveWorkflowField,
  moveWorkflowNode,
  removeWorkflowField,
  removeWorkflowNode,
} from './workflow-template-model.mjs'
import { normalizeWorkflowDefinition, PROJECT_FIELD_BINDINGS } from './workflow-template-schema.mjs'

const { t } = useI18n()
const userStore = useUserStore()
const canWrite = computed(() => userStore.can('admin:workflow:write'))
const loading = ref(false)
const saving = ref(false)
const types = ref<ProjectType[]>([])
const templates = ref<WorkflowTemplateSummary[]>([])
const selectedTypeId = ref<number>()
const selectedTemplateId = ref<number | null>(null)
const selectedNodeKey = ref('')
const templateName = ref('')
const templateDescription = ref('')
const definition = ref<WorkflowTemplateDefinitionV2>({ schemaVersion: 2, nodes: [] })
const dirty = ref(false)
const dragKey = ref<string>()
const contentDragItem = ref<WorkflowContentOrderItem>()
const fieldDragKey = ref<string>()
const previewOpen = ref(false)
const typeModalOpen = ref(false)
const typeForm = reactive({ code: '', name: '', description: '' })

const COMPONENTS = [
  { key: 'requirement-scope' }, { key: 'solution-design' },
  { key: 'plan-resource-risk' }, { key: 'development-control' }, { key: 'business-acceptance' },
  { key: 'release-handover' }, { key: 'value-review' }, { key: 'knowledge-standard' },
]
const fieldTypes: WorkflowFieldType[] = ['TEXT', 'TEXTAREA', 'NUMBER', 'RADIO', 'SINGLE_SELECT', 'MULTI_SELECT', 'PERSON', 'PERSON_MULTI', 'DATE', 'DATE_RANGE', 'ATTACHMENT']
const selectedType = computed(() => types.value.find((type) => type.id === selectedTypeId.value))
const selectedTemplateSummary = computed(() => templates.value.find((template) => template.id === selectedTemplateId.value))
const currentNode = computed(() => definition.value.nodes.find((node) => node.key === selectedNodeKey.value))
const configuredComponents = computed(() => (currentNode.value?.contentOrder || [])
  .filter((item) => item.startsWith('component:'))
  .map((item) => item.slice('component:'.length)))
const availableBindings = computed(() => Object.entries(PROJECT_FIELD_BINDINGS)
  .filter(([, binding]) => !currentNode.value?.fields.some((field) => field.binding === binding.binding)))
const selectedNodeIndex = computed(() => definition.value.nodes.findIndex((node) => node.key === selectedNodeKey.value))
const publishedVersion = computed(() => selectedTemplateSummary.value?.publishedVersionNo)

function contentItemLabel(contentItem: WorkflowContentOrderItem): string {
  if (contentItem === 'fields') return t('admin.workflow.fieldsSection')
  if (contentItem === 'legacy-custom-fields') return t('admin.workflow.legacyCustomFieldsSection')
  return componentLabel(contentItem.slice('component:'.length))
}

function fieldsForContentItem(node: WorkflowNodeDefinitionV2, contentItem: WorkflowContentOrderItem): WorkflowFieldDefinition[] {
  const fields = node.fields.filter((field) => field.visible !== false)
  const splitLegacyFields = node.contentOrder.includes('legacy-custom-fields')
  if (!splitLegacyFields) return contentItem === 'fields' ? fields : []
  if (contentItem === 'fields') return fields.filter((field) => Boolean(field.binding))
  if (contentItem === 'legacy-custom-fields') return fields.filter((field) => !field.binding)
  return []
}

function markDirty() { dirty.value = true }

async function loadTypes(preferredTypeId?: number) {
  types.value = await listWorkflowProjectTypes()
  if (!types.value.length) { selectedTypeId.value = undefined; templates.value = []; return }
  selectedTypeId.value = types.value.some((type) => type.id === preferredTypeId)
    ? preferredTypeId
    : types.value[0].id
  await loadTemplates()
}

async function loadTemplates(preferredTemplateId?: number) {
  if (!selectedTypeId.value) { templates.value = []; return }
  templates.value = await listWorkflowTemplates(selectedTypeId.value)
  const selected = templates.value.find((template) => template.id === preferredTemplateId)
    || templates.value.find((template) => template.defaultTemplate)
    || templates.value[0]
  if (selected) await selectTemplate(selected.id)
  else clearEditor()
}

function clearEditor() {
  selectedTemplateId.value = null
  templateName.value = ''
  templateDescription.value = ''
  definition.value = { schemaVersion: 2, nodes: [] }
  selectedNodeKey.value = ''
  dirty.value = false
}

async function selectTemplate(id: number) {
  if (!(await confirmDiscard())) return
  loading.value = true
  try {
    const template = await getWorkflowTemplate(id)
    selectedTemplateId.value = template.id
    selectedTypeId.value = template.projectTypeId
    templateName.value = template.name
    templateDescription.value = template.description || ''
    definition.value = normalizeWorkflowDefinition(template.definition)
    selectedNodeKey.value = definition.value.nodes[0]?.key || ''
    dirty.value = false
  } catch (error) {
    message.error((error as Error).message || t('admin.workflow.loadFailed'))
  } finally { loading.value = false }
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
  if (typeId === selectedTypeId.value || !(await confirmDiscard())) return
  selectedTypeId.value = typeId
  await loadTemplates()
}

async function newTemplate() {
  if (!selectedTypeId.value) { message.warning(t('admin.workflow.chooseTypeFirst')); return }
  const hadUnsavedChanges = dirty.value
  if (!(await confirmDiscard())) return
  const base = templates.value.find((template) => template.defaultTemplate) || templates.value[0]
  let nodes: WorkflowNodeDefinitionV2[] = []
  if (base) {
    loading.value = true
    try {
      const baseTemplate = await getWorkflowTemplate(base.id)
      nodes = normalizeWorkflowDefinition(baseTemplate.definition).nodes
    } catch (error) {
      dirty.value = hadUnsavedChanges
      message.error((error as Error).message || t('admin.workflow.loadFailed'))
      return
    } finally { loading.value = false }
  }
  selectedTemplateId.value = null
  templateName.value = t('admin.workflow.newTemplateName')
  templateDescription.value = ''
  definition.value = nodes.length
    ? { schemaVersion: 2, nodes }
    : { schemaVersion: 2, nodes: [createWorkflowNode([], { name: t('admin.workflow.newNodeName'), key: 'stage-1' })] }
  selectedNodeKey.value = definition.value.nodes[0]?.key || ''
  dirty.value = true
}

function addNode() {
  const next = createWorkflowNode(definition.value.nodes, { name: t('admin.workflow.newNodeName') })
  definition.value.nodes = [...definition.value.nodes, next]
  selectedNodeKey.value = next.key
  markDirty()
}

function removeNode(node: WorkflowNodeDefinitionV2) {
  Modal.confirm({
    title: t('admin.workflow.removeNodeTitle', { name: node.name }),
    content: t('admin.workflow.removeNodeContent'), okType: 'danger', okText: t('common.delete'), cancelText: t('common.cancel'),
    onOk: () => {
      try {
        definition.value.nodes = removeWorkflowNode(definition.value.nodes, node.key)
        selectedNodeKey.value = definition.value.nodes[0]?.key || ''
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

function addField(type: WorkflowFieldType = 'TEXT') {
  const node = currentNode.value
  if (!node) return
  replaceCurrentNode(addWorkflowField(node, { label: t('admin.workflow.newFieldName'), type }))
}

function addBoundField(projectFieldKey: string) {
  const node = currentNode.value
  const binding = PROJECT_FIELD_BINDINGS[projectFieldKey]
  if (!node || !binding) return
  replaceCurrentNode(addWorkflowField(node, {
    key: `project-${projectFieldKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
    label: t(`admin.workflow.projectFieldLabels.${projectFieldKey}`),
    type: binding.type,
    binding: binding.binding,
  }))
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

function moveField(fieldKey: string, delta: number) {
  const node = currentNode.value
  const index = node?.fields.findIndex((field) => field.key === fieldKey) ?? -1
  const target = index + delta
  if (!node || index < 0 || target < 0 || target >= node.fields.length) return
  replaceCurrentNode(moveWorkflowField(node, fieldKey, target))
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
  if (node) replaceCurrentNode(removeWorkflowField(node, fieldKey))
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

async function saveDraft(): Promise<boolean> {
  if (!selectedTypeId.value || !templateName.value.trim() || !definition.value.nodes.length) {
    message.warning(t('admin.workflow.completeBeforeSave'))
    return false
  }
  saving.value = true
  try {
    const payload = {
      name: templateName.value.trim(),
      description: templateDescription.value.trim(),
      definition: definition.value,
      expectedDraftRevision: selectedTemplateSummary.value?.draftRevision ?? null,
    }
    const saved = selectedTemplateId.value
      ? await saveWorkflowTemplateDraft(selectedTemplateId.value, payload)
      : await createWorkflowTemplate({ ...payload, projectTypeId: selectedTypeId.value })
    selectedTemplateId.value = saved.id
    dirty.value = false
    await loadTemplates(saved.id)
    message.success(t('admin.workflow.draftSaved'))
    return true
  } catch (error) {
    message.error((error as Error).message || t('admin.workflow.saveFailed'))
    return false
  } finally { saving.value = false }
}

async function publish() {
  if (!canWrite.value) return
  if (dirty.value && !(await saveDraft())) return
  if (!selectedTemplateId.value) return
  saving.value = true
  try {
    await publishWorkflowTemplate(selectedTemplateId.value)
    await loadTemplates(selectedTemplateId.value)
    message.success(t('admin.workflow.published'))
  } catch (error) { message.error((error as Error).message || t('admin.workflow.publishFailed')) }
  finally { saving.value = false }
}

async function setAsDefault() {
  const versionId = selectedTemplateSummary.value?.publishedVersionId
  if (!selectedTypeId.value || !versionId) { message.warning(t('admin.workflow.publishBeforeDefault')); return }
  try {
    const templateId = selectedTemplateId.value
    await setWorkflowDefault(selectedTypeId.value, versionId)
    types.value = await listWorkflowProjectTypes()
    templates.value = await listWorkflowTemplates(selectedTypeId.value)
    if (templateId != null) await selectTemplate(templateId)
    message.success(t('admin.workflow.defaultUpdated'))
  } catch (error) { message.error((error as Error).message || t('admin.workflow.defaultFailed')) }
}

async function saveType() {
  if (!typeForm.code.trim() || !typeForm.name.trim()) { message.warning(t('admin.workflow.typeRequired')); return }
  if (!(await confirmDiscard())) return
  try {
    const created = await createWorkflowProjectType({ ...typeForm, code: typeForm.code.trim(), name: typeForm.name.trim(), sort: types.value.length })
    typeModalOpen.value = false
    Object.assign(typeForm, { code: '', name: '', description: '' })
    await loadTypes(created.id)
  } catch (error) { message.error((error as Error).message || t('admin.workflow.typeSaveFailed')) }
}

function componentLabel(key: string) { return t(`admin.workflow.componentLabels.${key}`) }
function fieldTypeLabel(type: WorkflowFieldType) { return t(`admin.workflow.fieldTypes.${type}`) }
function bindingLabel(binding: WorkflowFieldBinding) { return t(`admin.workflow.bindingLabels.${binding}`) }
function setFieldOptionsFromEvent(field: WorkflowFieldDefinition, event: unknown) {
  setFieldOptions(field, String((event as { target?: { value?: string } })?.target?.value || ''))
}
function checkboxChecked(event: unknown): boolean {
  return Boolean((event as { target?: { checked?: boolean } })?.target?.checked)
}
function moveByKeyboard(node: WorkflowNodeDefinitionV2, delta: number) {
  const index = definition.value.nodes.findIndex((item) => item.key === node.key)
  reorder(node.key, Math.max(0, Math.min(definition.value.nodes.length - 1, index + delta)))
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
    <PmsPageHeader :title="$t('route.adminWorkflows')" :description="$t('admin.workflow.description')">
      <template #actions>
        <a-button @click="previewOpen = true" :disabled="!definition.nodes.length"><EyeOutlined /> {{ $t('admin.workflow.preview') }}</a-button>
        <a-button v-if="canWrite" @click="newTemplate">{{ $t('admin.workflow.newTemplate') }}</a-button>
        <a-button v-if="canWrite" type="primary" :loading="saving" @click="saveDraft"><SaveOutlined /> {{ $t('admin.workflow.saveDraft') }}</a-button>
        <a-button v-if="canWrite && selectedTemplateId" type="primary" ghost :loading="saving" @click="publish"><SendOutlined /> {{ $t('admin.workflow.publish') }}</a-button>
      </template>
    </PmsPageHeader>

    <div class="workflow-admin-layout">
      <aside class="workflow-library">
        <div class="library-heading">
          <div><strong>{{ $t('admin.workflow.projectTypes') }}</strong><small>{{ $t('admin.workflow.typeHint') }}</small></div>
          <a-button v-if="canWrite" size="small" @click="typeModalOpen = true"><PlusOutlined /></a-button>
        </div>
        <button v-for="type in types" :key="type.id" class="type-choice" :class="{ active: type.id === selectedTypeId }" @click="changeProjectType(type.id)">
          <span>{{ type.name }}</span><small>{{ type.defaultTemplateName || $t('admin.workflow.noDefault') }}</small>
        </button>
        <div class="library-heading template-heading"><div><strong>{{ $t('admin.workflow.templates') }}</strong><small>{{ $t('admin.workflow.templatesHint') }}</small></div></div>
        <button v-for="template in templates" :key="template.id" class="template-choice" :class="{ active: template.id === selectedTemplateId }" @click="selectTemplate(template.id)">
          <span class="template-choice__title">{{ template.name }} <a-tag v-if="template.defaultTemplate" color="blue">{{ $t('admin.workflow.default') }}</a-tag></span>
          <small>{{ template.publishedVersionNo ? `v${template.publishedVersionNo}` : $t('admin.workflow.notPublished') }}<span v-if="template.draftVersionNo"> · {{ $t('admin.workflow.draftVersion', { version: template.draftVersionNo }) }}</span></small>
        </button>
        <a-empty v-if="!loading && !templates.length" :description="$t('admin.workflow.noTemplates')" />
      </aside>

      <div class="workflow-editor" :aria-busy="loading">
        <a-spin :spinning="loading">
          <template v-if="selectedTypeId">
            <header class="editor-topbar">
              <div class="editor-meta">
                <a-input v-model:value="templateName" :placeholder="$t('admin.workflow.templateName')" :disabled="!canWrite" @input="markDirty" />
                <a-input v-model:value="templateDescription" :placeholder="$t('admin.workflow.templateDescription')" :disabled="!canWrite" @input="markDirty" />
              </div>
              <div class="editor-status">
                <a-tag v-if="dirty" color="orange">{{ $t('admin.workflow.unsaved') }}</a-tag>
                <a-tag v-else-if="publishedVersion" color="green">{{ $t('admin.workflow.publishedVersion', { version: publishedVersion }) }}</a-tag>
                <a-button v-if="canWrite && selectedTemplateSummary?.publishedVersionId && !selectedTemplateSummary.defaultTemplate" size="small" :disabled="dirty" @click="setAsDefault">{{ $t('admin.workflow.setDefault') }}</a-button>
              </div>
            </header>

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
                      :class="{ selected: selectedNodeKey === node.key, dragging: dragKey === node.key }"
                      :draggable="canWrite"
                      tabindex="0"
                      @click="selectedNodeKey = node.key"
                      @keydown.enter="selectedNodeKey = node.key"
                      @dragstart="dragKey = node.key"
                      @dragover.prevent
                      @drop.prevent="onDrop(index)"
                      @dragend="dragKey = undefined"
                    >
                      <div class="workflow-node-card__top"><span class="stage-index">{{ String(index + 1).padStart(2, '0') }}</span><span class="stage-status">{{ node.contentOrder.some((item) => item.startsWith('component:')) ? $t('admin.workflow.reuses') : $t('admin.workflow.custom') }}</span></div>
                      <strong>{{ node.name || $t('admin.workflow.unnamedNode') }}</strong>
                      <p>{{ node.description || $t('admin.workflow.noNodeDescription') }}</p>
                      <div class="node-component-chips"><a-tag v-for="contentItem in node.contentOrder.filter((item) => item.startsWith('component:'))" :key="contentItem">{{ componentLabel(contentItem.slice('component:'.length)) }}</a-tag><a-tag v-for="field in node.fields" :key="field.key" color="purple">{{ field.label }}</a-tag></div>
                      <div class="node-card-tools" @click.stop>
                        <a-button size="small" :disabled="!canWrite || index === 0" :aria-label="$t('admin.workflow.moveUp')" @click="moveByKeyboard(node, -1)"><ArrowUpOutlined /></a-button>
                        <a-button size="small" :disabled="!canWrite || index === definition.nodes.length - 1" :aria-label="$t('admin.workflow.moveDown')" @click="moveByKeyboard(node, 1)"><ArrowDownOutlined /></a-button>
                        <a-button size="small" danger :disabled="!canWrite || definition.nodes.length <= 1" :aria-label="$t('admin.workflow.removeNode')" @click="removeNode(node)"><DeleteOutlined /></a-button>
                      </div>
                    </article>
                  </template>
                </div>
              </div>
              <div class="fixed-blocks"><span>{{ $t('admin.workflow.alwaysShown') }}</span><a-tag v-for="block in FIXED_NODE_BLOCKS" :key="block" color="blue">{{ $t(`admin.workflow.fixedBlocks.${block}`) }}</a-tag></div>
            </section>

            <section v-if="currentNode" class="node-inspector">
              <div class="inspector-header"><div><span>{{ $t('admin.workflow.editingStage', { index: selectedNodeIndex + 1 }) }}</span><h2>{{ currentNode.name || $t('admin.workflow.unnamedNode') }}</h2></div><a-tag color="blue">{{ $t('admin.workflow.sequential') }}</a-tag></div>
              <div class="inspector-grid">
                <div class="inspector-main">
                  <a-form layout="vertical">
                    <div class="node-basic-grid">
                      <a-form-item :label="$t('admin.workflow.nodeName')"><a-input v-model:value="currentNode.name" :disabled="!canWrite" :maxlength="80" @input="markDirty" /></a-form-item>
                      <a-form-item :label="$t('admin.workflow.nodeKey')"><a-input :value="currentNode.key" disabled /><small>{{ $t('admin.workflow.nodeKeyHint') }}</small></a-form-item>
                    </div>
                    <a-form-item :label="$t('admin.workflow.nodeDescription')"><a-textarea v-model:value="currentNode.description" :disabled="!canWrite" :rows="2" @input="markDirty" /></a-form-item>
                    <div class="node-basic-grid">
                      <a-form-item :label="$t('admin.workflow.deliverables')"><a-textarea v-model:value="currentNode.deliverable" :disabled="!canWrite" :rows="2" @input="markDirty" /></a-form-item>
                      <a-form-item :label="$t('admin.workflow.roles')"><a-textarea v-model:value="currentNode.roles" :disabled="!canWrite" :rows="2" @input="markDirty" /></a-form-item>
                    </div>
                  </a-form>
                  <section class="inspector-section component-library">
                    <div class="section-title"><div><h3>{{ $t('admin.workflow.componentLibrary') }}</h3><p>{{ $t('admin.workflow.componentLibraryHint') }}</p></div></div>
                    <div class="field-palette" :aria-label="$t('admin.workflow.fieldPaletteAria')"><a-button v-for="type in fieldTypes" :key="type" size="small" :disabled="!canWrite" @click="addField(type)"><PlusOutlined /> {{ fieldTypeLabel(type) }}</a-button></div>
                    <div class="binding-palette" :aria-label="$t('admin.workflow.bindingPaletteAria')"><a-button v-for="[key, binding] in availableBindings" :key="binding.binding" size="small" :disabled="!canWrite" @click="addBoundField(key)"><PlusOutlined /> {{ $t(`admin.workflow.projectFieldLabels.${key}`) }}</a-button></div>
                    <label v-for="component in COMPONENTS" :key="component.key" class="component-option"><a-checkbox :checked="configuredComponents.includes(component.key)" :disabled="!canWrite" @change="toggleComponent(component.key, checkboxChecked($event))">{{ componentLabel(component.key) }}</a-checkbox><small>{{ $t(`admin.workflow.componentHints.${component.key}`) }}</small></label>
                  </section>

                  <section class="inspector-section">
                    <div class="section-title"><div><h3>{{ $t('admin.workflow.componentOrder') }}</h3><p>{{ $t('admin.workflow.contentOrderHint') }}</p></div></div>
                    <div v-if="currentNode.contentOrder.length" class="component-order-list">
                      <article v-for="(contentItem, index) in currentNode.contentOrder" :key="contentItem" class="content-order-item" :draggable="canWrite" tabindex="0" @dragstart="contentDragItem = contentItem" @dragover.prevent @drop.prevent="onContentDrop(index)" @dragend="contentDragItem = undefined">
                        <strong>{{ contentItemLabel(contentItem) }}</strong>
                        <div class="field-order-tools"><a-button size="small" :disabled="!canWrite || index === 0" :aria-label="$t('admin.workflow.moveUp')" @click="moveContentItem(contentItem, -1)"><ArrowUpOutlined /></a-button><a-button size="small" :disabled="!canWrite || index === currentNode.contentOrder.length - 1" :aria-label="$t('admin.workflow.moveDown')" @click="moveContentItem(contentItem, 1)"><ArrowDownOutlined /></a-button><a-button v-if="contentItem.startsWith('component:')" size="small" danger type="text" :disabled="!canWrite" :aria-label="$t('admin.workflow.removeComponent')" @click="removeContentItem(contentItem)"><DeleteOutlined /></a-button></div>
                      </article>
                    </div>
                    <a-empty v-else :description="$t('admin.workflow.noContentItems')" />
                  </section>

                  <section class="inspector-section">
                    <div class="section-title"><div><h3>{{ $t('admin.workflow.customFields') }}</h3><p>{{ $t('admin.workflow.customFieldsHint') }}</p></div><a-button v-if="canWrite" size="small" @click="addField"><PlusOutlined /> {{ $t('admin.workflow.addField') }}</a-button></div>
                    <div v-if="currentNode.fields.length" class="custom-field-list">
                      <article v-for="(field, index) in currentNode.fields" :key="field.key" class="field-card custom-field-row" :draggable="canWrite" tabindex="0" @dragstart="fieldDragKey = field.key" @dragover.prevent @drop.prevent="onFieldDrop(index)" @dragend="fieldDragKey = undefined">
                        <label class="custom-field-cell custom-field-label"><span>{{ $t('admin.workflow.fieldLabel') }}</span><a-input v-model:value="field.label" :disabled="!canWrite" :placeholder="$t('admin.workflow.fieldLabel')" :aria-label="$t('admin.workflow.fieldLabel')" @input="markDirty" /></label>
                        <label class="custom-field-cell custom-field-key"><span>{{ $t('admin.workflow.fieldKey') }}</span><a-input :value="field.key" readonly :aria-label="$t('admin.workflow.fieldKey')" /></label>
                        <label v-if="!field.binding" class="custom-field-cell custom-field-type"><span>{{ $t('admin.workflow.fieldType') }}</span><a-select :value="field.type" :disabled="!canWrite" :aria-label="$t('admin.workflow.fieldType')" @change="updateFieldType(field, $event)"><a-select-option v-for="type in fieldTypes" :key="type" :value="type">{{ fieldTypeLabel(type) }}</a-select-option></a-select></label>
                        <div v-else class="custom-field-cell custom-field-type"><span>{{ $t('admin.workflow.binding') }}</span><strong>{{ bindingLabel(field.binding) }} · {{ fieldTypeLabel(field.type) }}</strong></div>
                        <div class="custom-field-cell custom-field-visible"><a-checkbox :checked="field.visible !== false" :disabled="!canWrite" @change="updateFieldVisibility(field, checkboxChecked($event))">{{ $t('admin.workflow.visible') }}</a-checkbox></div>
                        <div class="custom-field-cell custom-field-required"><a-checkbox v-model:checked="field.required" :disabled="!canWrite || field.visible === false" @change="markDirty">{{ $t('admin.workflow.required') }}</a-checkbox></div>
                        <label class="custom-field-cell custom-field-options"><span>{{ $t('admin.workflow.fieldOptions') }}</span><a-input v-if="['RADIO', 'SINGLE_SELECT', 'MULTI_SELECT'].includes(field.type)" :value="field.options.join(', ')" :disabled="!canWrite" :placeholder="$t('admin.workflow.optionsComma')" :aria-label="$t('admin.workflow.fieldOptions')" @change="setFieldOptionsFromEvent(field, $event)" /><span v-else class="custom-field-no-options">—</span></label>
                        <div class="custom-field-actions"><div class="field-order-tools"><a-button size="small" :disabled="!canWrite || index === 0" :aria-label="$t('admin.workflow.moveUp')" @click="moveField(field.key, -1)"><ArrowUpOutlined /></a-button><a-button size="small" :disabled="!canWrite || index === currentNode.fields.length - 1" :aria-label="$t('admin.workflow.moveDown')" @click="moveField(field.key, 1)"><ArrowDownOutlined /></a-button></div><a-button v-if="canWrite" danger type="text" :aria-label="$t('admin.workflow.removeField')" @click="removeField(field.key)"><DeleteOutlined /></a-button></div>
                      </article>
                    </div>
                    <a-empty v-else :description="$t('admin.workflow.noCustomFields')" />
                  </section>
                </div>
                <aside class="inspector-preview">
                  <div class="preview-sticky-title"><EyeOutlined /><strong>{{ $t('admin.workflow.nodePreview') }}</strong></div>
                  <div class="preview-title"><span>{{ selectedNodeIndex + 1 }}</span><div><strong>{{ currentNode.name }}</strong><small>{{ currentNode.description || $t('admin.workflow.noNodeDescription') }}</small></div></div>
                  <div class="preview-fixed"><b>{{ $t('admin.workflow.fixedBlocksTitle') }}</b><div class="preview-owner-schedule"><span>{{ $t('admin.workflow.fixedBlocks.owner') }}<small>{{ $t('admin.workflow.previewPerson') }}</small></span><span>{{ $t('admin.workflow.fixedBlocks.schedule') }}<small>{{ $t('admin.workflow.previewDateRange') }}</small></span></div><div class="preview-task-board"><span>{{ $t('admin.workflow.fixedBlocks.task-board') }}</span><i>{{ $t('admin.workflow.previewTaskColumns') }}</i></div></div>
                  <template v-for="contentItem in currentNode.contentOrder" :key="contentItem">
                    <div v-if="contentItem === 'fields' || contentItem === 'legacy-custom-fields'" class="preview-section"><b>{{ contentItemLabel(contentItem) }}</b><label v-for="field in fieldsForContentItem(currentNode, contentItem)" :key="field.key">{{ field.label }} <em v-if="field.required">*</em><small>{{ fieldTypeLabel(field.type) }}</small><input v-if="field.type === 'TEXT'" disabled :placeholder="$t('admin.workflow.previewValue')" /><textarea v-else-if="field.type === 'TEXTAREA'" disabled :placeholder="$t('admin.workflow.previewValue')" /><input v-else-if="field.type === 'NUMBER'" type="number" disabled :placeholder="$t('admin.workflow.previewValue')" /><a-radio-group v-else-if="field.type === 'RADIO'" disabled><a-radio v-for="option in field.options" :key="option" :value="option">{{ option }}</a-radio></a-radio-group><a-select v-else-if="field.type === 'SINGLE_SELECT'" disabled :placeholder="$t('admin.workflow.previewValue')"><a-select-option v-for="option in field.options" :key="option" :value="option">{{ option }}</a-select-option></a-select><a-select v-else-if="field.type === 'MULTI_SELECT'" mode="multiple" disabled :placeholder="$t('admin.workflow.previewValue')"><a-select-option v-for="option in field.options" :key="option" :value="option">{{ option }}</a-select-option></a-select><a-select v-else-if="field.type === 'PERSON'" disabled :placeholder="$t('admin.workflow.previewPerson')" /><a-select v-else-if="field.type === 'PERSON_MULTI'" mode="multiple" disabled :placeholder="$t('admin.workflow.previewPeople')" /><a-date-picker v-else-if="field.type === 'DATE'" disabled /><a-range-picker v-else-if="field.type === 'DATE_RANGE'" disabled /><span v-else-if="field.type === 'ATTACHMENT'" class="preview-module-placeholder">{{ $t('admin.workflow.previewAttachment') }}</span></label></div>
                    <div v-else class="preview-section preview-component-card"><b>{{ componentLabel(contentItem.slice('component:'.length)) }}</b><p>{{ $t(`admin.workflow.componentHints.${contentItem.slice('component:'.length)}`) }}</p><div class="preview-module-placeholder">{{ $t('admin.workflow.reusedComponent') }}</div></div>
                  </template>
                </aside>
              </div>
            </section>
            <a-empty v-else :description="$t('admin.workflow.chooseOrCreate')" />
          </template>
          <a-empty v-else :description="$t('admin.workflow.noTypes')"><a-button v-if="canWrite" type="primary" @click="typeModalOpen = true">{{ $t('admin.workflow.addType') }}</a-button></a-empty>
        </a-spin>
      </div>
    </div>

    <a-modal v-model:open="previewOpen" :title="$t('admin.workflow.previewTitle')" width="780px" :footer="null">
      <div class="template-preview-flow"><div v-for="(node, index) in definition.nodes" :key="node.key" class="template-preview-node"><span>{{ String(index + 1).padStart(2, '0') }}</span><strong>{{ node.name }}</strong><small>{{ node.contentOrder.map((item) => contentItemLabel(item)).join(' · ') || $t('admin.workflow.custom') }}</small><div>{{ $t('admin.workflow.fixedBlocksTitle') }}：{{ FIXED_NODE_BLOCKS.map((block) => t(`admin.workflow.fixedBlocks.${block}`)).join('、') }}</div><template v-for="contentItem in node.contentOrder" :key="contentItem"><div v-if="contentItem === 'fields' || contentItem === 'legacy-custom-fields'" class="template-preview-content-item"><b>{{ contentItemLabel(contentItem) }}</b><div v-for="field in fieldsForContentItem(node, contentItem)" :key="field.key" class="preview-field-line">{{ field.label }} · {{ fieldTypeLabel(field.type) }}<b v-if="field.required">*</b></div></div><div v-else class="template-preview-content-item"><b>{{ contentItemLabel(contentItem) }}</b><small>{{ $t(`admin.workflow.componentHints.${contentItem.slice('component:'.length)}`) }}</small></div></template></div></div>
    </a-modal>

    <a-modal v-model:open="typeModalOpen" :title="$t('admin.workflow.addType')" :ok-text="$t('common.save')" :cancel-text="$t('common.cancel')" @ok="saveType">
      <a-form layout="vertical"><a-form-item :label="$t('admin.workflow.typeCode')"><a-input v-model:value="typeForm.code" placeholder="e.g. product" /></a-form-item><a-form-item :label="$t('admin.workflow.typeName')"><a-input v-model:value="typeForm.name" /></a-form-item><a-form-item :label="$t('admin.workflow.typeDescription')"><a-textarea v-model:value="typeForm.description" :rows="2" /></a-form-item></a-form>
    </a-modal>
  </section>
</template>

<style scoped>
.workflow-admin-page { display: grid; gap: var(--pms-space-4); min-width: 0; }
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
.workflow-node-card.dragging { opacity: .5; }
.workflow-node-card__top { display: flex; align-items: center; justify-content: space-between; gap: var(--pms-space-2); margin-bottom: var(--pms-space-3); }
.stage-index { display: grid; width: 32px; height: 32px; flex: 0 0 32px; place-items: center; color: var(--pms-primary); background: var(--pms-primary-soft); border-radius: 50%; font-size: var(--pms-font-size-caption); font-weight: 750; }
.stage-status { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.workflow-node-card strong { color: var(--pms-text); font-size: var(--pms-font-size-body); line-height: var(--pms-line-height-tight); }
.workflow-node-card p { min-height: 38px; margin: var(--pms-space-2) 0 var(--pms-space-3); color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-relaxed); }
.node-component-chips { display: flex; flex-wrap: wrap; gap: var(--pms-space-2); min-height: 22px; }
.node-component-chips :deep(.ant-tag) { margin: 0; font-size: var(--pms-font-size-caption); }
.node-card-tools { display: flex; gap: var(--pms-space-2); margin-top: auto; padding-top: var(--pms-space-3); }
.node-card-tools :deep(.ant-btn) { width: 32px; min-width: 32px; height: var(--pms-control-height-compact); min-height: var(--pms-control-height-compact); padding: 0; border-radius: var(--pms-radius-sm); }
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
</style>
