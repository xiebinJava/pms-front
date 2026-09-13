import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { designTokens } from '../../../styles/design-system.ts'

const source = fs.readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
const style = source.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1] || ''
const template = source.split('<template>')[1]?.split('<style scoped>')[0] || ''
const spacingScale = new Set([0, ...Object.values(designTokens.spacing || {})])

test('workflow template typography only uses documented readable type sizes', () => {
  const sizes = [...style.matchAll(/font-size:\s*([^;]+)/g)].map((match) => match[1].trim())
  assert.ok(sizes.length > 0, 'expected workflow styles to define typography')
  assert.ok(sizes.every((size) => /^var\(--pms-font-size-(?:caption|compact|body|nav|section|title|display)\)$/.test(size)), `unexpected font sizes: ${sizes.join(', ')}`)
})

test('workflow layout spacing comes from the documented PMS spacing scale', () => {
  assert.deepEqual(designTokens.spacing, { 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 })
  const spacingValues = [...style.matchAll(/(?:^|[;{}])\s*(?:gap|row-gap|column-gap|margin(?:-[a-z]+)?|padding(?:-[a-z]+)?)\s*:\s*([^;{}]+)/gm)]
    .flatMap((match) => [...match[1].matchAll(/(\d+(?:\.\d+)?)px/g)].map((value) => Number(value[1])))
  assert.ok(spacingValues.every((value) => spacingScale.has(value)), `unexpected spacing values: ${spacingValues.filter((value) => !spacingScale.has(value)).join(', ')}`)
})

test('workflow node actions retain compact-size pointer targets', () => {
  const tools = style.match(/\.node-card-tools\s+:deep\(\.ant-btn\)\s*\{([^}]+)\}/)?.[1] || ''
  const compactTools = [...style.matchAll(/\.node-card-tools\s*\{([^}]+)\}/g)]
    .map((match) => match[1])
    .find((block) => block.includes('pointer-events: none')) || ''
  assert.match(tools, /min-width:\s*32px/)
  assert.match(tools, /min-height:\s*(?:32px|var\(--pms-control-height-compact\))/)
  assert.match(compactTools, /position:\s*absolute/)
  assert.match(compactTools, /pointer-events:\s*none/)
})

test('workflow editor presents the node field palette, visual canvas, and property inspector', () => {
  assert.match(template, /class="workflow-template-bar"[\s\S]*?class="workflow-node-designer"/)
  assert.match(template, /class="designer-panel designer-palette"[\s\S]*?class="designer-panel designer-canvas"[\s\S]*?class="designer-panel designer-inspector"/)
  assert.match(template, /data-testid="designer-fixed-owner"[\s\S]*?data-testid="designer-fixed-schedule"[\s\S]*?data-testid="designer-fixed-task-board"/)
  assert.match(template, /<a-select :value="selectedTypeId" @change="changeProjectType/)
  assert.doesNotMatch(template, /<a-select :value="selectedTypeId" :disabled="!canWrite"/)
  assert.match(style, /\.designer-grid\s*\{[^}]*grid-template-columns:\s*minmax\(168px,[^}]+minmax\(224px/)
})

test('node metadata and selected field properties remain editable in the inspector', () => {
  assert.match(template, /\$t\('admin\.workflow\.fieldLabel'\)[^\n]*id="workflow-field-label"/)
  assert.match(template, /:value="selectedField\.key" disabled/)
  assert.match(template, /v-model:value="currentNode\.deliverable"/)
  assert.match(template, /v-model:value="currentNode\.roles"/)
  assert.match(template, /@click="selectedFieldKey = ''"/)
})

test('designer fields and inspector adapt to mobile widths', () => {
  const mobileStart = style.lastIndexOf('@media (max-width: 700px)')
  const mobile = style.slice(mobileStart).match(/@media\s*\(max-width:\s*700px\)\s*\{([\s\S]*?)(?=@media|$)/)?.[1] || ''
  assert.match(mobile, /(?:\.designer-fixed-grid,\s*)?\.designer-field-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/)
  assert.match(mobile, /\.designer-inspector\s*\{[^}]*grid-column:\s*auto/)
  assert.match(mobile, /\.node-card-tools\s*\{[^}]*opacity:\s*1[^}]*pointer-events:\s*auto/)
})

test('workflow editor normalizes legacy definitions before editing and persists schema v2', () => {
  assert.match(source, /import\s*\{[^}]*normalizeWorkflowDefinition[^}]*\}\s*from '\.\/workflow-template-schema\.mjs'/)
  assert.match(source, /definition\.value = normalizeWorkflowDefinition\(template\.definition\)/)
  assert.match(source, /normalizeWorkflowDefinition\(baseTemplate\.definition\)/)
  assert.match(source, /const definition = ref<WorkflowTemplateDefinitionV2>\(\{ schemaVersion: 2, nodes: \[\] \}\)/)
  assert.match(source, /definition:\s*definition\.value/)
})

test('content editor uses v2 contentOrder and model helpers rather than legacy component arrays', () => {
  assert.match(source, /addWorkflowField,[\s\S]*moveWorkflowContentItem,[\s\S]*moveWorkflowField,[\s\S]*removeWorkflowField/)
  assert.match(source, /function toggleComponent\(componentKey: string, checked: boolean\)[\s\S]*?component:\$\{componentKey\}/)
  assert.match(source, /function moveContentItem\(contentItem: WorkflowContentOrderItem, delta: number\)[\s\S]*?moveWorkflowContentItem/)
  assert.doesNotMatch(source, /node\.components/)
  assert.doesNotMatch(source, /projectBasicInfoFields/)
})

test('node content and individual field cards support pointer sorting while keeping fixed blocks outside deletion', () => {
  assert.match(template, /class="designer-content-item designer-fields-section"[\s\S]*?:draggable="canWrite"/)
  assert.match(template, /class="designer-field-card"[\s\S]*?:draggable="canWrite"/)
  assert.match(template, /class="designer-fields-section__tools"[\s\S]*?moveContentItem/)
  assert.match(template, /class="designer-field-card__actions"[\s\S]*?moveField/)
  assert.match(style, /\.designer-content-heading\s*>\s*\.designer-fields-section__tools\s*\{[^}]*display:\s*flex/)
  assert.match(template, /class="designer-content-item designer-workbench-card"[^>]*:draggable="canWrite"/)
  assert.match(template, /:aria-label="\$t\('admin\.workflow\.moveUp'\)"[\s\S]*?moveContentItem/)
  assert.match(template, /:disabled="!canWrite"\s+:aria-label="\$t\('admin\.workflow\.removeComponent'\)"/)
  assert.match(source, /function onFieldDrop\([\s\S]*?moveWorkflowField/)
  assert.match(template, /class="designer-workbench-actions"[\s\S]*?removeContentItem/)
  assert.match(template, /FIXED_NODE_BLOCKS/)
})

test('bound fields expose only editable label visibility and requiredness', () => {
  assert.match(template, /<a-input :value="selectedField\.key" disabled/)
  assert.match(template, /v-if="selectedField\.binding"[\s\S]*?bindingLabel\(selectedField\.binding\)/)
  assert.match(template, /@change="updateFieldVisibility\(selectedField, checkboxChecked\(\$event\)\)"/)
  assert.match(template, /v-model:checked="selectedField\.required"/)
})

test('node and field selection use accessible buttons with selected state', () => {
  assert.match(template, /class="workflow-node-card__copy workflow-node-select"[\s\S]*?:aria-pressed="selectedNodeKey === node\.key"/)
  assert.match(template, /class="designer-field-select"[\s\S]*?:aria-pressed="selectedFieldKey === field\.key"/)
  assert.match(template, /class="designer-field-card"[^>]*role="group"/)
  const nodeHeading = template.split('<header class="designer-node-heading"')[1]?.split('</header>')[0] || ''
  assert.doesNotMatch(nodeHeading, /admin\.workflow\.nodeSettings/)
})

test('inspector heading styles do not override the palette heading layout', () => {
  assert.match(style, /\.designer-inspector\s+\.designer-panel-heading\s*\{[^}]*flex-direction:\s*row/)
  assert.doesNotMatch(style, /(?:^|\})\s*\.designer-panel-heading\s*\{[^}]*flex-direction:\s*row/)
})

test('field palette and preview include every schema v2 control type', () => {
  for (const type of ['RADIO', 'PERSON_MULTI', 'DATE_RANGE']) {
    assert.match(source, new RegExp(`'${type}'`))
  }
  assert.match(template, /v-else-if="field\.type === 'RADIO'"/)
  assert.match(template, /v-else-if="field\.type === 'PERSON_MULTI'"/)
  assert.match(template, /v-else-if="field\.type === 'DATE_RANGE'"/)
})

test('preview uses dedicated controls for numeric, people, and date field types', () => {
  assert.match(template, /v-else-if="field\.type === 'NUMBER'"[\s\S]*?type="number"/)
  assert.match(template, /<a-select v-else-if="field\.type === 'PERSON'"/)
  assert.match(template, /<a-select v-else-if="field\.type === 'PERSON_MULTI'" mode="multiple"/)
  assert.match(template, /<a-date-picker v-else-if="field\.type === 'DATE'"/)
  assert.match(template, /<a-range-picker v-else-if="field\.type === 'DATE_RANGE'"/)
})

test('node preview sizes to its content instead of stretching beside the full editor', () => {
  const inspector = style.match(/\.designer-inspector\s*\{([^}]+)\}/)?.[1] || ''
  assert.match(inspector, /position:\s*sticky/)
})

test('legacy custom fields keep a translated, ordered slot in editor and template previews', () => {
  const templatePreview = template.split('<a-modal v-model:open="previewOpen"')[1]?.split('</a-modal>')[0] || ''
  const zhLocale = fs.readFileSync(new URL('../../../locales/zh-CN.ts', import.meta.url), 'utf8')
  const enLocale = fs.readFileSync(new URL('../../../locales/en-US.ts', import.meta.url), 'utf8')

  assert.match(source, /if \(contentItem === 'legacy-custom-fields'\) return t\('admin\.workflow\.legacyCustomFieldsSection'\)/)
  assert.match(template, /class="designer-content-item designer-workbench-card"[\s\S]*?@click="removeContentItem\(contentItem\)"/)
  assert.match(templatePreview, /node\.contentOrder\.map\(\(item\) => contentItemLabel\(item\)\)/)
  assert.match(templatePreview, /v-for="contentItem in node\.contentOrder"[\s\S]*?fieldsForContentItem\(node, contentItem\)/)
  assert.doesNotMatch(templatePreview, /componentLabel\(item\.slice\('component:'\.length\)\)/)
  assert.match(zhLocale, /legacyCustomFieldsSection:\s*'旧版自定义字段'/)
  assert.match(enLocale, /legacyCustomFieldsSection:\s*'Legacy custom fields'/)
})

test('legacy custom field slot does not move the project profile click-away anchor', () => {
  const detailPage = fs.readFileSync(new URL('../../project/detail/index.vue', import.meta.url), 'utf8')
  assert.match(detailPage, /<div v-if="activeNodeFieldsSlot\.length" ref="profileContainer" class="node-tab-profile"/)
  assert.match(detailPage, /<div v-if="activeNodeLegacyCustomFields\.length" class="node-tab-profile workflow-legacy-custom-fields"/)
  assert.doesNotMatch(detailPage, /activeNodeLegacyCustomFields\.length" ref="profileContainer"/)
})
