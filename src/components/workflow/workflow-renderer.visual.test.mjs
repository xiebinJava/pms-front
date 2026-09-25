import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const theme = fs.readFileSync(new URL('../../styles/pms-theme.css', import.meta.url), 'utf8')
const projectDetail = fs.readFileSync(new URL('../../views/project/detail/index.vue', import.meta.url), 'utf8')
const developmentDetail = fs.readFileSync(new URL('../../views/development/detail/DevelopmentItemDetailPage.vue', import.meta.url), 'utf8')

test('defines one detail visual token contract for project, topic, and story pages', () => {
  assert.match(theme, /--pms-detail-bg:/)
  assert.match(theme, /--pms-detail-surface:/)
  assert.match(theme, /--pms-detail-border:/)
  assert.match(theme, /--pms-detail-radius:/)
  assert.match(theme, /\.pms-workflow-node-shell\s*\{/)
  assert.match(theme, /\.pms-workflow-component-host\s*\{/)
})

test('uses shared workflow primitives in project and development details', () => {
  assert.match(projectDetail, /import WorkflowNodeShell from ['"]\/\@\/components\/workflow\/WorkflowNodeShell\.vue['"]/)
  assert.match(projectDetail, /import WorkflowRuntimeComponentHost from ['"]\/\@\/components\/workflow\/WorkflowRuntimeComponentHost\.vue['"]/)
  assert.match(developmentDetail, /import WorkflowNodeShell from ['"]\/\@\/components\/workflow\/WorkflowNodeShell\.vue['"]/)
  assert.match(developmentDetail, /import WorkflowRuntimeComponentHost from ['"]\/\@\/components\/workflow\/WorkflowRuntimeComponentHost\.vue['"]/)
})

test('keeps component identity separate from the node mount key and exposes an unknown fallback', () => {
  const registry = fs.readFileSync(new URL('./workflow-component-registry.ts', import.meta.url), 'utf8')
  const host = fs.readFileSync(new URL('./WorkflowRuntimeComponentHost.vue', import.meta.url), 'utf8')
  assert.match(registry, /WorkflowRuntimeComponentKey/)
  assert.match(registry, /getWorkflowRuntimeComponentDefinition/)
  assert.match(registry, /development-control/)
  assert.match(registry, /story-split/)
  assert.doesNotMatch(registry, /['"]develop['"]|\bdevelop\b/)
  assert.match(host, /unknown/i)
  assert.match(host, /componentKey/)
})

test('keeps the same node shell anatomy for empty fields, tasks, and narrow screens', () => {
  const shell = fs.readFileSync(new URL('./WorkflowNodeShell.vue', import.meta.url), 'utf8')
  assert.match(shell, /workflow-node-shell__header/)
  assert.match(shell, /workflow-node-shell__assignments/)
  assert.match(shell, /workflow-node-shell__fields/)
  assert.match(shell, /workflow-node-shell__components/)
  assert.match(shell, /workflow-node-shell__tasks/)
  assert.match(shell, /@media \(max-width: 640px\)/)
})
