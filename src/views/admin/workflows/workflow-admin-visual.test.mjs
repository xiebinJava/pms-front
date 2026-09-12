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
  assert.match(style, /@container\s*\([^)]*max-width:\s*760px\)[\s\S]*?grid-template-areas:\s*"label key"\s*"type options"\s*"required actions"/)
})

test('node preview sizes to its content instead of stretching beside the full editor', () => {
  const preview = style.match(/\.inspector-preview\s*\{([^}]+)\}/)?.[1] || ''
  assert.match(preview, /align-self:\s*start/)
})
