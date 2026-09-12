<script setup lang="ts">
import { computed, onMounted, reactive, ref, toRaw } from 'vue'
import { message, Modal } from 'ant-design-vue'
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
import type { ProjectType, WorkflowFieldDefinition, WorkflowFieldType, WorkflowNodeDefinition, WorkflowTemplateDefinition, WorkflowTemplateSummary } from '/@/types/workflow'
import {
  DEFAULT_PROJECT_BASIC_INFO_FIELDS,
  FIXED_NODE_BLOCKS,
  createWorkflowNode,
  moveWorkflowNode,
  removeWorkflowNode,
} from './workflow-template-model.mjs'

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
const definition = ref<WorkflowTemplateDefinition>({ schemaVersion: 1, nodes: [] })
const dirty = ref(false)
const dragKey = ref<string>()
const previewOpen = ref(false)
const typeModalOpen = ref(false)
const typeForm = reactive({ code: '', name: '', description: '' })

const COMPONENTS = [
  { key: 'project-basic-info' }, { key: 'requirement-scope' }, { key: 'solution-design' },
  { key: 'plan-resource-risk' }, { key: 'development-control' }, { key: 'business-acceptance' },
  { key: 'release-handover' }, { key: 'value-review' }, { key: 'knowledge-standard' },
]
const fieldTypes: WorkflowFieldType[] = ['TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'SINGLE_SELECT', 'MULTI_SELECT', 'PERSON', 'ATTACHMENT']
const selectedType = computed(() => types.value.find((type) => type.id === selectedTypeId.value))
const selectedTemplateSummary = computed(() => templates.value.find((template) => template.id === selectedTemplateId.value))
const currentNode = computed(() => definition.value.nodes.find((node) => node.key === selectedNodeKey.value))
const projectFields = computed(() => currentNode.value?.projectBasicInfoFields || [])
const selectedNodeIndex = computed(() => definition.value.nodes.findIndex((node) => node.key === selectedNodeKey.value))
const publishedVersion = computed(() => selectedTemplateSummary.value?.publishedVersionNo)

function markDirty() { dirty.value = true }
function setDefinition(next: WorkflowTemplateDefinition) { definition.value = structuredClone(toRaw(next)); selectedNodeKey.value = next.nodes[0]?.key || ''; dirty.value = true }

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
  definition.value = { schemaVersion: 1, nodes: [] }
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
    definition.value = structuredClone(template.definition)
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

async function changeProjectType(typeId: number) {
  if (typeId === selectedTypeId.value || !(await confirmDiscard())) return
  selectedTypeId.value = typeId
  await loadTemplates()
}

async function newTemplate() {
  if (!selectedTypeId.value) { message.warning(t('admin.workflow.chooseTypeFirst')); return }
  if (!(await confirmDiscard())) return
  const base = templates.value.find((template) => template.defaultTemplate) || templates.value[0]
  const nodes = base ? structuredClone(toRaw(definition.value.nodes)) : []
  selectedTemplateId.value = null
  templateName.value = t('admin.workflow.newTemplateName')
  templateDescription.value = ''
  definition.value = nodes.length
    ? { schemaVersion: 1, nodes }
    : { schemaVersion: 1, nodes: [createWorkflowNode([], { name: t('admin.workflow.newNodeName'), key: 'stage-1' })] }
  selectedNodeKey.value = definition.value.nodes[0]?.key || ''
  dirty.value = true
}

function addNode() {
  const next = createWorkflowNode(definition.value.nodes, { name: t('admin.workflow.newNodeName') })
  definition.value.nodes = [...definition.value.nodes, next]
  selectedNodeKey.value = next.key
  markDirty()
}

function removeNode(node: WorkflowNodeDefinition) {
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
  const next = new Set(node.components)
  if (checked) {
    if (!next.has(componentKey)) node.components.push(componentKey)
  } else {
    node.components = node.components.filter((key) => key !== componentKey)
  }
  if (componentKey === 'project-basic-info') {
    node.projectBasicInfo = checked
    node.projectBasicInfoFields = checked
      ? (node.projectBasicInfoFields?.length ? node.projectBasicInfoFields : structuredClone(DEFAULT_PROJECT_BASIC_INFO_FIELDS))
      : []
  }
  markDirty()
}

function addField() {
  const node = currentNode.value
  if (!node) return
  const base = `field-${node.fields.length + 1}`
  let key = base
  let index = 2
  while (node.fields.some((field) => field.key === key)) key = `${base}-${index++}`
  node.fields.push({ key, label: t('admin.workflow.newFieldName'), type: 'TEXT', required: false, options: [] })
  markDirty()
}

function moveComponent(componentKey: string, delta: number) {
  const node = currentNode.value
  if (!node) return
  const index = node.components.indexOf(componentKey)
  const target = index + delta
  if (index < 0 || target < 0 || target >= node.components.length) return
  const components = [...node.components]
  ;[components[index], components[target]] = [components[target], components[index]]
  node.components = components
  markDirty()
}

function moveProjectField(fieldKey: string, delta: number) {
  const fields = currentNode.value?.projectBasicInfoFields
  if (!fields) return
  const index = fields.findIndex((field) => field.key === fieldKey)
  const target = index + delta
  if (index < 0 || target < 0 || target >= fields.length) return
  ;[fields[index], fields[target]] = [fields[target], fields[index]]
  markDirty()
}

function moveCustomField(index: number, delta: number) {
  const fields = currentNode.value?.fields
  const target = index + delta
  if (!fields || target < 0 || target >= fields.length) return
  ;[fields[index], fields[target]] = [fields[target], fields[index]]
  markDirty()
}

function removeField(index: number) {
  currentNode.value?.fields.splice(index, 1)
  markDirty()
}

function setFieldOptions(field: WorkflowFieldDefinition, text: string) {
  field.options = [...new Set(text.split(',').map((option) => option.trim()).filter(Boolean))]
  markDirty()
}

function updateFieldType(field: WorkflowFieldDefinition, type: WorkflowFieldType) {
  field.type = type
  if (type !== 'SINGLE_SELECT' && type !== 'MULTI_SELECT') field.options = []
  markDirty()
}

function updateTypeField(fieldKey: string, property: 'visible' | 'required', value: boolean) {
  const field = projectFields.value.find((item) => item.key === fieldKey)
  if (field) {
    field[property] = property === 'required' && !field.visible ? false : value
    if (property === 'visible' && !value) field.required = false
    markDirty()
  }
}

async function saveDraft(): Promise<boolean> {
  if (!selectedTypeId.value || !templateName.value.trim() || !definition.value.nodes.length) {
    message.warning(t('admin.workflow.completeBeforeSave'))
    return false
  }
  saving.value = true
  try {
    const payload = { name: templateName.value.trim(), description: templateDescription.value.trim(), definition: definition.value }
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
function setFieldOptionsFromEvent(field: WorkflowFieldDefinition, event: unknown) {
  setFieldOptions(field, String((event as { target?: { value?: string } })?.target?.value || ''))
}
function checkboxChecked(event: unknown): boolean {
  return Boolean((event as { target?: { checked?: boolean } })?.target?.checked)
}
function moveByKeyboard(node: WorkflowNodeDefinition, delta: number) {
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
              <div class="canvas-caption"><div><strong>{{ selectedType?.name }}</strong><span>{{ $t('admin.workflow.sequentialOnly') }}</span></div><a-button v-if="canWrite" size="small" @click="addNode"><PlusOutlined /> {{ $t('admin.workflow.addStage') }}</a-button></div>
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
                      <div class="workflow-node-card__top"><span class="stage-index">{{ String(index + 1).padStart(2, '0') }}</span><span class="stage-status">{{ node.components.length ? $t('admin.workflow.reuses') : $t('admin.workflow.custom') }}</span></div>
                      <strong>{{ node.name || $t('admin.workflow.unnamedNode') }}</strong>
                      <p>{{ node.description || $t('admin.workflow.noNodeDescription') }}</p>
                      <div class="node-component-chips"><a-tag v-for="component in node.components" :key="component">{{ componentLabel(component) }}</a-tag><a-tag v-for="field in node.fields" :key="field.key" color="purple">{{ field.label }}</a-tag></div>
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
                  <section class="inspector-section">
                    <div class="section-title"><div><h3>{{ $t('admin.workflow.builtInComponents') }}</h3><p>{{ $t('admin.workflow.componentsHint') }}</p></div></div>
                    <label v-for="component in COMPONENTS" :key="component.key" class="component-option">
                      <a-checkbox :checked="currentNode.components.includes(component.key)" :disabled="!canWrite" @change="toggleComponent(component.key, checkboxChecked($event))">{{ componentLabel(component.key) }}</a-checkbox>
                      <small>{{ $t(`admin.workflow.componentHints.${component.key}`) }}</small>
                    </label>
                    <div v-if="currentNode.components.length" class="component-order-list">
                      <span>{{ $t('admin.workflow.componentOrder') }}</span>
                      <div v-for="(component, index) in currentNode.components" :key="component" class="component-order-item">
                        <strong>{{ index + 1 }}. {{ componentLabel(component) }}</strong>
                        <a-button size="small" :disabled="!canWrite || index === 0" :aria-label="$t('admin.workflow.moveUp')" @click="moveComponent(component, -1)"><ArrowUpOutlined /></a-button>
                        <a-button size="small" :disabled="!canWrite || index === currentNode.components.length - 1" :aria-label="$t('admin.workflow.moveDown')" @click="moveComponent(component, 1)"><ArrowDownOutlined /></a-button>
                      </div>
                    </div>
                  </section>

                  <section v-if="currentNode.projectBasicInfo" class="inspector-section project-fields-editor">
                    <div class="section-title"><div><h3>{{ $t('admin.workflow.projectBasicsConfig') }}</h3><p>{{ $t('admin.workflow.projectBasicsHint') }}</p></div></div>
                    <div v-for="(field, index) in projectFields" :key="field.key" class="project-field-option">
                      <span>{{ $t(`admin.workflow.projectFieldLabels.${field.key}`) }}</span>
                      <a-checkbox :checked="field.visible" :disabled="!canWrite" @change="updateTypeField(field.key, 'visible', checkboxChecked($event))">{{ $t('admin.workflow.visible') }}</a-checkbox>
                      <a-checkbox :checked="field.required" :disabled="!canWrite || !field.visible" @change="updateTypeField(field.key, 'required', checkboxChecked($event))">{{ $t('admin.workflow.required') }}</a-checkbox>
                      <div class="field-order-tools"><a-button size="small" :disabled="!canWrite || index === 0" :aria-label="$t('admin.workflow.moveUp')" @click="moveProjectField(field.key, -1)"><ArrowUpOutlined /></a-button><a-button size="small" :disabled="!canWrite || index === projectFields.length - 1" :aria-label="$t('admin.workflow.moveDown')" @click="moveProjectField(field.key, 1)"><ArrowDownOutlined /></a-button></div>
                    </div>
                  </section>

                  <section class="inspector-section">
                    <div class="section-title"><div><h3>{{ $t('admin.workflow.customFields') }}</h3><p>{{ $t('admin.workflow.customFieldsHint') }}</p></div><a-button v-if="canWrite" size="small" @click="addField"><PlusOutlined /> {{ $t('admin.workflow.addField') }}</a-button></div>
                    <div v-if="currentNode.fields.length" class="custom-field-list">
                      <article v-for="(field, index) in currentNode.fields" :key="field.key" class="custom-field-row">
                        <a-input v-model:value="field.label" :disabled="!canWrite" :placeholder="$t('admin.workflow.fieldLabel')" @input="markDirty" />
                        <a-input v-model:value="field.key" :disabled="!canWrite" :placeholder="$t('admin.workflow.fieldKey')" @input="markDirty" />
                        <a-select :value="field.type" :disabled="!canWrite" @change="updateFieldType(field, $event)"><a-select-option v-for="type in fieldTypes" :key="type" :value="type">{{ fieldTypeLabel(type) }}</a-select-option></a-select>
                        <a-checkbox v-model:checked="field.required" :disabled="!canWrite" @change="markDirty">{{ $t('admin.workflow.required') }}</a-checkbox>
                        <a-input v-if="field.type === 'SINGLE_SELECT' || field.type === 'MULTI_SELECT'" :value="field.options.join(', ')" :disabled="!canWrite" :placeholder="$t('admin.workflow.optionsComma')" @change="setFieldOptionsFromEvent(field, $event)" />
                        <div class="field-order-tools"><a-button size="small" :disabled="!canWrite || index === 0" :aria-label="$t('admin.workflow.moveUp')" @click="moveCustomField(index, -1)"><ArrowUpOutlined /></a-button><a-button size="small" :disabled="!canWrite || index === currentNode.fields.length - 1" :aria-label="$t('admin.workflow.moveDown')" @click="moveCustomField(index, 1)"><ArrowDownOutlined /></a-button></div>
                        <a-button v-if="canWrite" danger type="text" :aria-label="$t('admin.workflow.removeField')" @click="removeField(index)"><DeleteOutlined /></a-button>
                      </article>
                    </div>
                    <a-empty v-else :description="$t('admin.workflow.noCustomFields')" />
                  </section>
                </div>
                <aside class="inspector-preview">
                  <div class="preview-sticky-title"><EyeOutlined /><strong>{{ $t('admin.workflow.nodePreview') }}</strong></div>
                  <div class="preview-title"><span>{{ selectedNodeIndex + 1 }}</span><div><strong>{{ currentNode.name }}</strong><small>{{ currentNode.description || $t('admin.workflow.noNodeDescription') }}</small></div></div>
                  <div class="preview-fixed"><b>{{ $t('admin.workflow.fixedBlocksTitle') }}</b><div class="preview-owner-schedule"><span>{{ $t('admin.workflow.fixedBlocks.owner') }}<small>{{ $t('admin.workflow.previewPerson') }}</small></span><span>{{ $t('admin.workflow.fixedBlocks.schedule') }}<small>{{ $t('admin.workflow.previewDateRange') }}</small></span></div><div class="preview-task-board"><span>{{ $t('admin.workflow.fixedBlocks.task-board') }}</span><i>{{ $t('admin.workflow.previewTaskColumns') }}</i></div></div>
                  <div v-if="currentNode.projectBasicInfo" class="preview-section"><b>{{ $t('admin.workflow.projectBasics') }}</b><label v-for="field in projectFields.filter((item) => item.visible)" :key="field.key">{{ $t(`admin.workflow.projectFieldLabels.${field.key}`) }} <em v-if="field.required">*</em><input disabled :placeholder="$t('admin.workflow.previewValue')" /></label></div>
                  <div v-for="component in currentNode.components.filter((key) => key !== 'project-basic-info')" :key="component" class="preview-section preview-component-card"><b>{{ componentLabel(component) }}</b><p>{{ $t(`admin.workflow.componentHints.${component}`) }}</p><div class="preview-module-placeholder">{{ $t('admin.workflow.reusedComponent') }}</div></div>
                  <div v-if="currentNode.fields.length" class="preview-section"><b>{{ $t('admin.workflow.customFields') }}</b><label v-for="field in currentNode.fields" :key="field.key">{{ field.label }} <em v-if="field.required">*</em><small>{{ fieldTypeLabel(field.type) }}</small><input v-if="['TEXT', 'NUMBER', 'DATE', 'PERSON'].includes(field.type)" disabled :placeholder="$t('admin.workflow.previewValue')" /><textarea v-else-if="field.type === 'TEXTAREA'" disabled :placeholder="$t('admin.workflow.previewValue')" /><span v-else-if="field.type === 'ATTACHMENT'" class="preview-module-placeholder">{{ $t('admin.workflow.previewAttachment') }}</span><span v-else class="preview-module-placeholder">{{ field.options.join(' / ') || $t('admin.workflow.previewValue') }}</span></label></div>
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
      <div class="template-preview-flow"><div v-for="(node, index) in definition.nodes" :key="node.key" class="template-preview-node"><span>{{ String(index + 1).padStart(2, '0') }}</span><strong>{{ node.name }}</strong><small>{{ node.components.map(componentLabel).join(' · ') || $t('admin.workflow.custom') }}</small><div>{{ $t('admin.workflow.fixedBlocksTitle') }}：{{ FIXED_NODE_BLOCKS.map((block) => t(`admin.workflow.fixedBlocks.${block}`)).join('、') }}</div><div v-for="field in node.fields" :key="field.key" class="preview-field-line">{{ field.label }} · {{ fieldTypeLabel(field.type) }}<b v-if="field.required">*</b></div></div></div>
    </a-modal>

    <a-modal v-model:open="typeModalOpen" :title="$t('admin.workflow.addType')" :ok-text="$t('common.save')" :cancel-text="$t('common.cancel')" @ok="saveType">
      <a-form layout="vertical"><a-form-item :label="$t('admin.workflow.typeCode')"><a-input v-model:value="typeForm.code" placeholder="e.g. product" /></a-form-item><a-form-item :label="$t('admin.workflow.typeName')"><a-input v-model:value="typeForm.name" /></a-form-item><a-form-item :label="$t('admin.workflow.typeDescription')"><a-textarea v-model:value="typeForm.description" :rows="2" /></a-form-item></a-form>
    </a-modal>
  </section>
</template>

<style scoped>
.workflow-admin-page { display: grid; gap: 16px; min-width: 0; }
.workflow-admin-layout { display: grid; grid-template-columns: 250px minmax(0, 1fr); min-height: 730px; gap: 16px; }
.workflow-library, .workflow-editor, .workflow-canvas-panel, .node-inspector { background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: var(--pms-radius); box-shadow: var(--pms-shadow-sm); }
.workflow-library { padding: 16px 12px; overflow-y: auto; }
.library-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 4px 6px 10px; }
.library-heading strong, .library-heading small { display: block; }
.library-heading strong { color: var(--pms-text); font-size: 13px; }
.library-heading small { margin-top: 4px; color: var(--pms-text-faint); font-size: 11px; }
.template-heading { margin-top: 16px; border-top: 1px solid var(--pms-border); padding-top: 16px; }
.type-choice, .template-choice { display: grid; width: 100%; gap: 5px; padding: 10px; color: var(--pms-text); text-align: left; background: transparent; border: 1px solid transparent; border-radius: 8px; cursor: pointer; }
.type-choice:hover, .template-choice:hover { background: var(--pms-surface-muted); }
.type-choice.active, .template-choice.active { background: var(--pms-primary-soft); border-color: var(--pms-primary); }
.type-choice small, .template-choice small { color: var(--pms-text-faint); font-size: 11px; }
.template-choice__title { display: flex; align-items: center; justify-content: space-between; gap: 4px; font-weight: 650; }
.workflow-editor { min-width: 0; padding: 16px; }
.editor-topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.editor-meta { display: grid; flex: 1; gap: 8px; max-width: 580px; }
.editor-status { display: flex; align-items: center; gap: 8px; }
.workflow-canvas-panel { padding: 14px; overflow: hidden; background: var(--pms-surface-muted); }
.canvas-caption { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.canvas-caption div { display: flex; align-items: center; gap: 10px; }
.canvas-caption strong { color: var(--pms-text); }
.canvas-caption span { color: var(--pms-text-faint); font-size: 12px; }
.workflow-canvas-scroll { overflow-x: auto; padding: 8px 4px 14px; }
.workflow-canvas { display: flex; align-items: center; min-width: max-content; }
.workflow-node-card { position: relative; display: flex; flex: 0 0 225px; flex-direction: column; min-height: 182px; padding: 13px; background: var(--pms-surface); border: 1px solid var(--pms-border-strong); border-radius: 10px; box-shadow: var(--pms-shadow-sm); cursor: pointer; transition: border-color .15s, box-shadow .15s, transform .15s; }
.workflow-node-card:hover { transform: translateY(-2px); }
.workflow-node-card.selected { border-color: var(--pms-primary); box-shadow: 0 0 0 3px var(--pms-primary-soft); }
.workflow-node-card.dragging { opacity: .5; }
.workflow-node-card__top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.stage-index { display: grid; width: 27px; height: 27px; place-items: center; color: var(--pms-primary); background: var(--pms-primary-soft); border-radius: 50%; font-size: 11px; font-weight: 750; }
.stage-status { color: var(--pms-text-faint); font-size: 10px; }
.workflow-node-card strong { color: var(--pms-text); font-size: 13px; }
.workflow-node-card p { min-height: 34px; margin: 6px 0 10px; color: var(--pms-text-muted); font-size: 11px; line-height: 1.45; }
.node-component-chips { display: flex; flex-wrap: wrap; gap: 3px; min-height: 20px; }
.node-component-chips :deep(.ant-tag) { margin: 0; font-size: 10px; }
.node-card-tools { display: flex; gap: 4px; margin-top: auto; padding-top: 8px; }
.node-card-tools :deep(.ant-btn) { width: 26px; height: 24px; padding: 0; }
.workflow-connector { position: relative; flex: 0 0 30px; height: 2px; background: var(--pms-border-strong); }
.workflow-connector span { position: absolute; top: -4px; right: 0; width: 8px; height: 8px; border-top: 2px solid var(--pms-border-strong); border-right: 2px solid var(--pms-border-strong); transform: rotate(45deg); }
.fixed-blocks { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding-top: 12px; border-top: 1px solid var(--pms-border); }
.fixed-blocks>span { margin-right: 3px; color: var(--pms-text-muted); font-size: 11px; }
.workflow-canvas-panel :deep(.ant-tag) { margin-inline-end: 0; }
.node-inspector { margin-top: 16px; padding: 18px; }
.inspector-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--pms-border); }
.inspector-header span { color: var(--pms-text-faint); font-size: 11px; }
.inspector-header h2 { margin: 4px 0 0; color: var(--pms-text); font-size: 18px; }
.inspector-grid { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 18px; padding-top: 14px; }
.inspector-main { min-width: 0; }
.node-basic-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.node-basic-grid small { display: block; margin-top: 4px; color: var(--pms-text-faint); font-size: 10px; }
.inspector-section { padding: 14px 0; border-top: 1px solid var(--pms-border); }
.section-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.section-title h3 { margin: 0; color: var(--pms-text); font-size: 14px; }
.section-title p { margin: 4px 0 0; color: var(--pms-text-faint); font-size: 11px; }
.component-option { display: grid; grid-template-columns: minmax(180px, .75fr) minmax(180px, 1fr); align-items: center; gap: 8px; padding: 7px 9px; border-radius: 6px; }
.component-option:hover { background: var(--pms-surface-muted); }
.component-option small { color: var(--pms-text-faint); font-size: 11px; }
.component-order-list { display: grid; gap: 6px; margin-top: 12px; padding: 10px; background: var(--pms-surface-muted); border-radius: 8px; }
.component-order-list>span { color: var(--pms-text-muted); font-size: 11px; }
.component-order-item { display: grid; grid-template-columns: 1fr 28px 28px; align-items: center; gap: 4px; }
.component-order-item strong { color: var(--pms-text); font-size: 11px; font-weight: 550; }
.field-order-tools { display: flex; align-items: center; gap: 3px; }
.field-order-tools :deep(.ant-btn) { width: 27px; height: 25px; padding: 0; }
.project-field-option { display: grid; grid-template-columns: minmax(130px, 1fr) 82px 82px 62px; align-items: center; gap: 8px; padding: 7px 9px; color: var(--pms-text); border-bottom: 1px solid var(--pms-border); font-size: 12px; }
.custom-field-list { display: grid; gap: 8px; }
.custom-field-row { display: grid; grid-template-columns: minmax(100px, 1fr) minmax(90px, .8fr) minmax(100px, 1fr) 82px minmax(130px, 1fr) 60px 28px; align-items: center; gap: 7px; padding: 8px; background: var(--pms-surface-muted); border-radius: 7px; }
.inspector-preview { align-self: stretch; min-width: 0; padding: 12px; background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: 8px; }
.preview-sticky-title { display: flex; align-items: center; gap: 7px; color: var(--pms-primary); font-size: 12px; }
.preview-title { display: flex; gap: 9px; padding: 13px 0; border-bottom: 1px solid var(--pms-border); }
.preview-title>span { display: grid; flex: 0 0 25px; height: 25px; place-items: center; color: var(--pms-primary); background: var(--pms-primary-soft); border-radius: 50%; font-size: 11px; }
.preview-title strong, .preview-title small { display: block; }
.preview-title strong { color: var(--pms-text); font-size: 12px; }
.preview-title small { margin-top: 4px; color: var(--pms-text-faint); font-size: 10px; }
.preview-fixed, .preview-section { display: grid; gap: 6px; padding: 11px 0; color: var(--pms-text-muted); border-bottom: 1px solid var(--pms-border); font-size: 11px; }
.preview-fixed b, .preview-section b { color: var(--pms-text); font-size: 11px; }
.preview-fixed span, .preview-section small { color: var(--pms-text-faint); font-size: 10px; }
.preview-section em, .preview-field-line b { color: var(--pms-danger); font-style: normal; }
.preview-owner-schedule { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.preview-owner-schedule>span, .preview-task-board, .preview-section label { display: grid; gap: 4px; padding: 7px; background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: 6px; }
.preview-task-board { gap: 7px; }
.preview-task-board i { color: var(--pms-text-faint); font-size: 10px; font-style: normal; }
.preview-section label { grid-template-columns: 1fr auto; align-items: center; color: var(--pms-text-muted); }
.preview-section label input, .preview-section label textarea, .preview-module-placeholder { grid-column: 1 / -1; width: 100%; padding: 6px 7px; color: var(--pms-text-faint); background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: 5px; font: inherit; }
.preview-section label textarea { min-height: 36px; resize: none; }
.preview-component-card p { margin: 0; color: var(--pms-text-faint); font-size: 10px; }
.template-preview-flow { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; max-height: 65vh; overflow: auto; }
.template-preview-node { display: grid; gap: 6px; padding: 12px; background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: 8px; }
.template-preview-node>span { color: var(--pms-primary); font-size: 11px; }
.template-preview-node strong { color: var(--pms-text); font-size: 13px; }
.template-preview-node small, .template-preview-node div { color: var(--pms-text-muted); font-size: 10px; }
.workflow-admin-page :deep(.ant-form-item) { margin-bottom: 12px; }
@media (max-width: 1200px) { .inspector-grid { grid-template-columns: minmax(0, 1fr); } .inspector-preview { display: none; } }
@media (max-width: 900px) { .workflow-admin-layout { grid-template-columns: 1fr; } .workflow-library { max-height: 300px; } .template-preview-flow { grid-template-columns: 1fr; } }
@media (max-width: 700px) { .workflow-editor { padding: 10px; } .editor-topbar { flex-direction: column; } .editor-status { flex-wrap: wrap; } .node-basic-grid { grid-template-columns: 1fr; gap: 0; } .custom-field-row { grid-template-columns: 1fr 1fr; } .component-option { grid-template-columns: 1fr; gap: 2px; } .project-field-option { grid-template-columns: 1fr auto auto; } .project-field-option .field-order-tools { grid-column: 1 / -1; justify-content: flex-end; } .workflow-node-card { flex-basis: 205px; } }
</style>
