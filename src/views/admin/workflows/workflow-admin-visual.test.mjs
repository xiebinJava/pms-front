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
  assert.match(tools, /min-width:\s*32px/)
  assert.match(tools, /min-height:\s*(?:32px|var\(--pms-control-height-compact\))/)
})

test('node preview remains available at tablet widths', () => {
  const medium = style.match(/@media\s*\(max-width:\s*1200px\)\s*\{([\s\S]*?)(?=@media|$)/)?.[1] || ''
  assert.ok(medium, 'expected a tablet layout rule')
  assert.doesNotMatch(medium, /\.inspector-preview[^}]*display:\s*none/)
})

test('custom field controls have persistent visible labels', () => {
  assert.ok(/class="[^"]*custom-field-label[^"]*"[\s\S]*?\$t\('admin\.workflow\.fieldLabel'\)/.test(template), 'field label must remain visible')
  assert.ok(/class="[^"]*custom-field-key[^"]*"[\s\S]*?\$t\('admin\.workflow\.fieldKey'\)/.test(template), 'field key must remain visible')
  assert.ok(/class="[^"]*custom-field-type[^"]*"[\s\S]*?\$t\('admin\.workflow\.fieldType'\)/.test(template), 'field type must remain visible')
})

test('custom field rows adapt to the inspector column instead of overlapping the preview', () => {
  assert.match(style, /\.inspector-main\s*\{[^}]*container-type:\s*inline-size/)
  assert.match(style, /@container\s*\([^)]*max-width:\s*760px\)[\s\S]*?\.custom-field-row\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(style, /@container\s*\([^)]*max-width:\s*760px\)[\s\S]*?grid-template-areas:\s*"label key"\s*"type options"\s*"visible required"\s*"actions actions"/)
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

test('field cards support keyboard and pointer reordering while keeping fixed blocks outside deletion', () => {
  assert.match(template, /class="content-order-item"[\s\S]*?:draggable="canWrite"/)
  assert.match(template, /class="field-card custom-field-row"[\s\S]*?:draggable="canWrite"/)
  assert.match(template, /:aria-label="\$t\('admin\.workflow\.moveUp'\)"[\s\S]*?moveContentItem/)
  assert.match(template, /:aria-label="\$t\('admin\.workflow\.moveDown'\)"[\s\S]*?moveField/)
  assert.match(template, /v-if="contentItem !== 'fields'"[\s\S]*?removeContentItem/)
  assert.match(template, /FIXED_NODE_BLOCKS/)
})

test('bound fields expose only editable label visibility and requiredness', () => {
  assert.match(template, /<a-input :value="field\.key" readonly/)
  assert.match(template, /v-if="!field\.binding"[\s\S]*?custom-field-type/)
  assert.match(template, /field\.binding[\s\S]*?bindingLabel/)
  assert.match(template, /@change="updateFieldVisibility\(field, checkboxChecked\(\$event\)\)"/)
  assert.match(template, /v-model:checked="field\.required"/)
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
  const preview = style.match(/\.inspector-preview\s*\{([^}]+)\}/)?.[1] || ''
  assert.match(preview, /align-self:\s*start/)
})
