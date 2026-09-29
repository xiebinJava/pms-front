import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { designTokens } from '../../../styles/design-system.ts'

const source = fs.readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
const workbenchPreviewSource = fs.existsSync(new URL('../../../components/workflow/WorkflowWorkbenchPreview.vue', import.meta.url))
  ? fs.readFileSync(new URL('../../../components/workflow/WorkflowWorkbenchPreview.vue', import.meta.url), 'utf8')
  : ''
const style = source.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1] || ''
const template = source.split('<template>')[1]?.split('<style scoped>')[0] || ''
const zhLocale = fs.readFileSync(new URL('../../../locales/zh-CN.ts', import.meta.url), 'utf8')
const enLocale = fs.readFileSync(new URL('../../../locales/en-US.ts', import.meta.url), 'utf8')
const spacingScale = new Set([0, ...Object.values(designTokens.spacing || {})])

test('workflow template typography only uses documented readable type sizes', () => {
  const sizes = [...style.matchAll(/font-size:\s*([^;]+)/g)].map((match) => match[1].trim())
  assert.ok(sizes.length > 0, 'expected workflow styles to define typography')
  assert.ok(sizes.every((size) => /^var\(--pms-font-size-(?:caption|compact|body|nav|section|title|display)\)$/.test(size)), `unexpected font sizes: ${sizes.join(', ')}`)
})

test('topic templates select a backend project-node binding and explain runtime component injection', () => {
  const api = fs.readFileSync(new URL('../../../api/admin-workflow.ts', import.meta.url), 'utf8')
  const types = fs.readFileSync(new URL('../../../types/workflow.ts', import.meta.url), 'utf8')
  const registry = fs.readFileSync(new URL('../../../components/workflow/workflow-component-registry.ts', import.meta.url), 'utf8')
  assert.match(api, /getWorkflowProjectNodeOptions[\s\S]*?\/admin\/workflow-config\/project-node-options/)
  assert.match(types, /interface WorkflowProjectNodeOption\s*\{\s*key:\s*string\s*name:\s*string/s)
  assert.match(types, /interface WorkflowTemplateDefinitionV1\s*\{[^}]*sourceProjectNodeKey\?:\s*string/s)
  assert.match(types, /interface WorkflowTemplateDefinitionV2\s*\{[^}]*sourceProjectNodeKey\?:\s*string/s)
  assert.match(types, /interface WorkflowTemplateDefinitionV1\s*\{[^}]*sourceTopicNodeKey\?:\s*string/s)
  assert.match(types, /interface WorkflowTemplateDefinitionV2\s*\{[^}]*sourceTopicNodeKey\?:\s*string/s)
  assert.match(source, /normalizeWorkflowDefinitionForProcessType\(template\.definition,\s*selectedType\.value\?\.code\)/)
  assert.match(source, /getWorkflowProjectNodeOptions\(\)/)
  assert.match(template, /v-if="selectedType\?\.code === 'topic-management'"/)
  assert.match(template, /v-if="selectedType\?\.code === 'story-management'"/)
  assert.match(template, /:value="definition\.sourceProjectNodeKey"[\s\S]*?@change="updateTopicSourceProjectNodeKey"/)
  assert.match(template, /:options="workflowProjectNodeOptions\.map\(\(option\) => \(\{ value: option\.key, label: option\.name \}\)\)"/)
  assert.match(template, /:aria-label="\$t\('admin\.workflow\.topicSourceProjectNodeKey'\)"/)
  assert.match(source, /setTopicSourceProjectNodeKey\(definition\.value,\s*String\(value \|\| ''\)\)/)
  assert.match(zhLocale, /topicSourceProjectNodeKey/)
  assert.match(enLocale, /topicSourceProjectNodeKey/)
  assert.match(zhLocale, /发布后会在该项目节点自动加入“专题列表工作台”/)
  assert.match(enLocale, /automatically adds the Topic List Workbench/)
  assert.match(registry, /label:\s*'专题列表工作台'/)
  assert.match(registry, /label:\s*'故事列表工作台'/)
  assert.match(registry, /processTypeCodes:\s*\['topic-management'\]/)
})

test('workflow palette exposes workbench components for the selected template source', () => {
  assert.match(source, /const workflowSource = computed<WorkflowSource \| undefined>\(\(\) => getWorkflowSourceForProcessType\(selectedType\.value\?\.code\)\)/)
  assert.match(source, /const availableComponents = computed\(\(\) => \{/)
  assert.match(source, /getAvailableWorkflowComponents\(/)
  assert.match(source, /processTypeCode: selectedType\.value\?\.code/)
  assert.match(source, /source: workflowSource/)
  assert.match(source, /components: WORKFLOW_RUNTIME_COMPONENTS/)
  assert.match(template, /v-for="component in availableComponents"/)
})

test('workflow palette labels each workbench with the matching node name from the active template', () => {
  assert.match(source, /function paletteComponentLabel\(key: string\)[\s\S]*?definition\.value\.nodes\.find\([\s\S]*?contentOrder\?\.includes\(`component:\$\{key\}`\)[\s\S]*?node\?\.name\?\.trim\(\)/)
  assert.match(template, /<strong>\{\{ paletteComponentLabel\(component\.key\) \}\}<\/strong>/)
})

test('workflow palette exposes requirement workbench components only for requirement templates', () => {
  const registry = fs.readFileSync(new URL('../../../components/workflow/workflow-component-registry.ts', import.meta.url), 'utf8')
  const model = fs.readFileSync(new URL('./workflow-template-model.mjs', import.meta.url), 'utf8')
  assert.match(registry, /REQUIREMENT_EXECUTION/)
  assert.match(registry, /REQUIREMENT_RECEIVING_ANALYSIS/)
  assert.match(registry, /REQUIREMENT_NODE_WORKBENCH/)
  assert.match(registry, /processTypeCodes:\s*\['requirement-management'\]/)
  assert.match(model, /processTypeCode/)
  assert.match(model, /component\.processTypeCodes\.includes\(processTypeCode\)/)
})

test('requirement management keeps all requirement workbenches as configurable runtime components', () => {
  const registry = fs.readFileSync(new URL('../../../components/workflow/workflow-component-registry.ts', import.meta.url), 'utf8')
  assert.match(registry, /key: WorkflowRuntimeComponentKey\.REQUIREMENT_RECEIVING_ANALYSIS,[\s\S]*?workbenchTypes: \['requirement'\]/)
  assert.match(registry, /key: WorkflowRuntimeComponentKey\.REQUIREMENT_EXECUTION,[\s\S]*?workbenchTypes: \['requirement'\]/)
  assert.match(registry, /key: WorkflowRuntimeComponentKey\.REQUIREMENT_NODE_WORKBENCH,[\s\S]*?workbenchTypes: \['requirement'\]/)
  assert.match(registry, /key: WorkflowRuntimeComponentKey\.REQUIREMENT_SCOPE,[\s\S]*?workbenchTypes: \['project', 'topic', 'story'\]/)
  assert.match(registry, /key: WorkflowRuntimeComponentKey\.SOLUTION_DESIGN,[\s\S]*?workbenchTypes: \['project', 'topic', 'story'\]/)
})

test('workflow palette exposes requirement record bindings through the unified bound-data filter', () => {
  const schema = fs.readFileSync(new URL('./workflow-template-schema.mjs', import.meta.url), 'utf8')
  assert.match(schema, /REQUIREMENT_FIELD_BINDINGS/)
  assert.doesNotMatch(source, /availableRequirementBindings/)
  assert.match(source, /availableBoundFields/)
  assert.match(source, /source === source/)
  assert.match(template, /boundFieldSourceLabel\(workflowSource\)/)
  assert.match(zhLocale, /requirementFieldLabels/)
  assert.match(enLocale, /requirementFieldLabels/)
})

test('workflow palette groups bound data by project, requirement, topic, and story sources', () => {
  const schema = fs.readFileSync(new URL('./workflow-template-schema.mjs', import.meta.url), 'utf8')
  const types = fs.readFileSync(new URL('../../../types/workflow.ts', import.meta.url), 'utf8')
  assert.match(schema, /TOPIC_FIELD_BINDINGS/)
  assert.match(schema, /STORY_FIELD_BINDINGS/)
  assert.match(source, /workflowSource/)
  assert.match(template, /boundFieldSourceLabel\(workflowSource\)/)
  assert.match(template, /绑定字段|bindingFields/)
  assert.match(types, /topic\.title/)
  assert.match(types, /story\.title/)
  assert.match(zhLocale, /topicFieldLabels/)
  assert.match(zhLocale, /storyFieldLabels/)
  assert.match(enLocale, /topicFieldLabels/)
  assert.match(enLocale, /storyFieldLabels/)
})

test('workflow palette scopes workbench components to the selected process type', () => {
  const registry = fs.readFileSync(new URL('../../../components/workflow/workflow-component-registry.ts', import.meta.url), 'utf8')
  assert.match(registry, /workbenchType/)
  assert.doesNotMatch(source, /key !== WorkflowRuntimeComponentKey\.STORY_SPLIT/)
  assert.match(source, /workbenchSourceLabel/)
  assert.match(template, /workbenchSourceLabel\(workflowSource\)/)
  assert.doesNotMatch(source, /workbenchSourceFilter/)
})

test('workflow palette keeps public fields unfiltered and scopes bound sources automatically', () => {
  assert.match(template, /class="designer-palette-list"[\s\S]*?v-for="type in fieldTypes"[\s\S]*?<\/div>\s*<div class="designer-palette-section" data-testid="bound-data-fields">/)
  assert.match(source, /getWorkflowSourceForProcessType\(selectedType\.value\?\.code\)/)
  assert.match(template, /boundFieldSourceLabel\(workflowSource\)/)
  assert.match(template, /workbenchSourceLabel\(workflowSource\)/)
  assert.doesNotMatch(template, /v-model:value="fieldSourceFilter"/)
  assert.doesNotMatch(template, /v-model:value="workbenchSourceFilter"/)
  assert.doesNotMatch(source, /const availableBindings =/)
  assert.doesNotMatch(source, /const availableRequirementBindings =/)
})

test('workflow palette labels the binding section and identifies the active source in its empty state', () => {
  assert.match(template, /\$t\('admin\.workflow\.bindingFields'\)/)
  assert.match(zhLocale, /bindingFields:\s*'绑定字段'/)
  assert.match(enLocale, /bindingFields:\s*'Binding fields'/)
  assert.match(template, /noAvailableBoundData[\s\S]*boundFieldSourceLabel\(workflowSource\)/)
  assert.match(zhLocale, /noAvailableBoundData:\s*'[^']*\{source\}/)
  assert.match(enLocale, /noAvailableBoundData:\s*'[^']*\{source\}/)
  assert.match(template, /data-testid="bound-data-fields"/)
  assert.match(template, /workbenchSourceLabel\(workflowSource\)/)
})

test('workflow locale keeps the binding source label keys unique', () => {
  assert.equal((zhLocale.match(/\bprojectBinding:/g) || []).length, 1)
  assert.equal((enLocale.match(/\bprojectBinding:/g) || []).length, 1)
})

test('topic field bindings include the associated project and remain separate from workbench components', () => {
  const schema = fs.readFileSync(new URL('./workflow-template-schema.mjs', import.meta.url), 'utf8')
  const registry = fs.readFileSync(new URL('../../../components/workflow/workflow-component-registry.ts', import.meta.url), 'utf8')
  assert.match(schema, /project:\s*\{ binding: 'topic\.project', type: 'TEXT' \}/)
  assert.match(zhLocale, /topicFieldLabels[\s\S]*关联项目/)
  assert.match(enLocale, /topicFieldLabels[\s\S]*Associated project/)
  assert.match(registry, /key: WorkflowRuntimeComponentKey\.STORY_SPLIT[\s\S]*workbenchTypes: \['topic', 'story'\]/)
})

test('requirement priority binding uses the requirement field category and single-select control', () => {
  const schema = fs.readFileSync(new URL('./workflow-template-schema.mjs', import.meta.url), 'utf8')
  assert.match(schema, /priority:\s*\{ binding: 'requirement\.priority', type: 'SINGLE_SELECT' \}/)
  assert.match(template, /field\.binding\.startsWith\('requirement\.'\)[\s\S]*?requirementBinding/)
  assert.match(zhLocale, /requirementBinding:\s*'绑定已有数据 · 需求字段'/)
  assert.match(enLocale, /requirementBinding:\s*'Bound existing data · Requirement field'/)
})

test('workflow layout spacing comes from the documented PMS spacing scale', () => {
  assert.deepEqual(designTokens.spacing, { 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 })
  const spacingValues = [...style.matchAll(/(?:^|[;{}])\s*(?:gap|row-gap|column-gap|margin(?:-[a-z]+)?|padding(?:-[a-z]+)?)\s*:\s*([^;{}]+)/gm)]
    .flatMap((match) => [...match[1].matchAll(/(\d+(?:\.\d+)?)px/g)].map((value) => Number(value[1])))
  assert.ok(spacingValues.every((value) => spacingScale.has(value)), `unexpected spacing values: ${spacingValues.filter((value) => !spacingScale.has(value)).join(', ')}`)
})

test('workflow nodes use the whole card as the drag surface and keep a top-right delete control', () => {
  assert.match(template, /class="workflow-node-card"[^>]*:draggable="canWrite"[^>]*@dragstart\.stop="dragKey = node\.key"[^>]*@dragend\.stop="dragKey = undefined"/)
  assert.match(template, /class="workflow-node-card__remove"[^>]*@click\.stop="removeNode\(node\)"/)
  assert.match(template, /class="workflow-node-card__remove"[\s\S]*?<DeleteOutlined \/>/)
  assert.doesNotMatch(template.match(/class="workflow-node-card__remove"[\s\S]*?<\/button>/)?.[0] || '', /CloseOutlined/)
  assert.match(template, /class="workflow-node-card__meta"[\s\S]*visibleFieldCount\(node\)/)
  assert.doesNotMatch(template, /workflow-node-card__stat--workbench/)
  assert.doesNotMatch(source, /configuredWorkbenchCount/)
  assert.doesNotMatch(template, /class="node-card-tools"/)
  assert.doesNotMatch(template, /workflow-node-drag-handle|HolderOutlined/)
  assert.doesNotMatch(source, /function moveByKeyboard\(/)
})

test('workflow node cards only enter the danger state when the delete control is hovered', () => {
  const cardHover = style.match(/\.workflow-node-card:hover\s*\{([^}]+)\}/)?.[1] || ''
  const deleteHover = style.match(/\.workflow-node-card\.delete-hovered\s*\{([^}]+)\}/)?.[1] || ''
  const removeButton = style.match(/\.workflow-node-card__remove\s*\{([^}]+)\}/)?.[1] || ''
  const removeHover = style.match(/\.workflow-node-card__remove:hover\s*\{([^}]+)\}/)?.[1] || ''
  const removeReveal = style.match(/\.workflow-node-card:hover\s+\.workflow-node-card__remove\s*\{([^}]+)\}/)?.[1] || ''
  assert.match(template, /'delete-hovered': deleteHoverKey === node\.key/)
  assert.match(template, /class="workflow-node-card__remove"[^>]*@mouseenter="deleteHoverKey = node\.key"[^>]*@mouseleave="deleteHoverKey = undefined"/)
  assert.doesNotMatch(cardHover, /border-color:\s*var\(--pms-danger\)/)
  assert.match(deleteHover, /border-color:\s*var\(--pms-danger\)/)
  assert.match(removeButton, /width:\s*12px/)
  assert.match(removeButton, /height:\s*12px/)
  assert.match(removeButton, /background:\s*transparent/)
  assert.match(removeButton, /border:\s*0/)
  assert.doesNotMatch(removeButton, /border-radius:\s*50%/)
  assert.match(removeButton, /position:\s*absolute/)
  assert.match(removeButton, /top:\s*-6px/)
  assert.match(removeButton, /right:\s*-6px/)
  assert.match(removeButton, /opacity:\s*0/)
  assert.match(removeButton, /visibility:\s*hidden/)
  assert.match(removeButton, /pointer-events:\s*none/)
  assert.match(removeReveal, /opacity:\s*1/)
  assert.match(removeReveal, /visibility:\s*visible/)
  assert.match(removeReveal, /pointer-events:\s*auto/)
  assert.match(removeHover, /color:\s*var\(--pms-danger\)/)
  assert.match(removeHover, /background:\s*transparent/)
})

test('workflow node cards keep a uniform height regardless of title wrapping', () => {
  const card = style.match(/\.workflow-node-card\s*\{([^}]+)\}/g)?.at(-1) || ''
  assert.match(card, /height:\s*84px/)
  assert.match(card, /min-height:\s*84px/)
})

test('workflow editor presents the node field palette, visual canvas, and property inspector', () => {
  assert.match(template, /data-testid="workflow-type-picker"[\s\S]*?v-for="type in orderedWorkflowTypes"[\s\S]*?:aria-pressed="selectedTypeId === type\.id"/)
  assert.match(template, /data-testid="workflow-template-picker"[\s\S]*?v-for="template in templates"[\s\S]*?:aria-pressed="selectedTemplateId === template\.id"/)
  assert.match(template, /v-if="workflowEntryStep === 'editor'"[\s\S]*?class="workflow-template-bar"[\s\S]*?class="workflow-canvas-panel"/)
  assert.match(template, /workflowEntryStep === 'empty-types'[\s\S]*?\$t\('admin\.workflow\.noTypes'\)/)
  assert.match(template, /workflowEntryStep === 'empty-templates'[\s\S]*?\$t\('admin\.workflow\.noTemplates'\)/)
  assert.doesNotMatch(template, /<a-select :value="selectedTypeId"/)
  assert.match(template, /class="designer-panel designer-palette"[\s\S]*?class="designer-panel designer-canvas"[\s\S]*?class="designer-panel designer-inspector"/)
  assert.match(template, /data-testid="designer-fixed-owner"[\s\S]*?data-testid="designer-fixed-schedule"[\s\S]*?data-testid="designer-fixed-task-board"/)
  assert.match(style, /\.designer-grid\s*\{[^}]*grid-template-columns:\s*minmax\(168px,[^}]+minmax\(196px/)
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
  assert.match(mobile, /\.workflow-node-card\s*\{[^}]*padding-bottom:\s*var\(--pms-space-3\)/)
})

test('workflow editor normalizes legacy definitions before editing and persists schema v2', () => {
  assert.match(source, /import\s*\{[^}]*normalizeWorkflowDefinitionForProcessType[^}]*\}\s*from '\.\/workflow-template-model\.mjs'/)
  assert.match(source, /definition\.value = normalizeWorkflowDefinitionForProcessType\(template\.definition,\s*selectedType\.value\?\.code\)/)
  assert.match(source, /baseDefinition = normalizeWorkflowDefinitionForProcessType\(baseTemplate\.definition,\s*selectedType\.value\?\.code\)/)
  assert.match(source, /const definition = ref<WorkflowTemplateDefinitionV2>\(\{ schemaVersion: 2, nodes: \[\] \}\)/)
  assert.match(source, /definition:\s*JSON\.parse\(JSON\.stringify\(definition\.value\)\)/)
})

test('content editor uses v2 contentOrder and model helpers rather than legacy component arrays', () => {
  assert.match(source, /addWorkflowField,[\s\S]*moveWorkflowContentItem,[\s\S]*moveWorkflowField,[\s\S]*removeWorkflowField/)
  assert.match(source, /function toggleComponent\(componentKey: string, checked: boolean\)[\s\S]*?const runtimeKey = paletteComponent\?\.runtimeKey \|\| componentKey/)
  assert.match(source, /function moveContentItem\(contentItem: WorkflowContentOrderItem, delta: number\)[\s\S]*?moveWorkflowContentItem/)
  assert.doesNotMatch(source, /node\.components/)
  assert.doesNotMatch(source, /projectBasicInfoFields/)
})

test('workbench cards render a read-only preview of the actual business content', () => {
  assert.match(source, /import WorkflowWorkbenchPreview from '\/\@\/components\/workflow\/WorkflowWorkbenchPreview\.vue'/)
  assert.match(template, /<WorkflowWorkbenchPreview class="designer-workbench-preview"[\s\S]*?:component-key="contentItem\.slice\('component:'\.length\)"/)
  assert.match(workbenchPreviewSource, /data-workbench-preview="componentKey"/)
  assert.match(workbenchPreviewSource, /workbenchPreview\.readOnly/)
  assert.match(workbenchPreviewSource, /workbenchPreview\.readOnlyHint/)
  assert.match(workbenchPreviewSource, /detail\.requirementScope\.scopeTitle/)
  assert.match(workbenchPreviewSource, /detail\.requirementScope\.inScope/)
  assert.match(workbenchPreviewSource, /detail\.requirementScope\.outScope/)
  assert.match(workbenchPreviewSource, /detail\.requirementScope\.requirementsTitle/)
  assert.match(workbenchPreviewSource, /detail\.requirementScope\.addRequirement/)
  assert.match(workbenchPreviewSource, /detail\.requirementScope\.noRequirements/)

  for (const key of [
    'requirement-scope', 'solution-design', 'plan-resource-risk', 'development-control',
    'story-list', 'requirement-receiving-analysis', 'business-acceptance', 'release-handover', 'value-review', 'knowledge-standard',
  ]) {
    assert.match(workbenchPreviewSource, new RegExp(`['"]${key}['"]`), `missing preview layout for ${key}`)
  }
})

test('requirement development template preview follows the runtime target tree and stays within its card', () => {
  assert.match(source, /function previewComponentConfig\(componentKey: string\)/)
  assert.match(source, /nodeName:\s*currentNode\.value\?\.name\s*\|\|\s*''/)
  assert.match(template, /:component-config="previewComponentConfig\(contentItem\.slice\('component:'\.length\)\)"/)
  assert.match(workbenchPreviewSource, /isRequirementDevelopment/)
  assert.match(workbenchPreviewSource, /data-testid="requirement-development-template-preview"/)
  assert.match(workbenchPreviewSource, /workflow-workbench-preview__tree-table/)
  assert.match(workbenchPreviewSource, /grid-template-columns:\s*minmax\(0,/)
  assert.doesNotMatch(workbenchPreviewSource, /grid-template-columns:\s*repeat\(var\(--preview-columns, 4\), minmax\(96px, 1fr\)\)/)
  assert.doesNotMatch(workbenchPreviewSource, /min-width:\s*max-content/)
})

test('requirement receiving preview only exposes the three retained single-select fields', () => {
  assert.match(workbenchPreviewSource, /'requirement-receiving-analysis':\s*\{[\s\S]*?category[\s\S]*?strategicFitScore[\s\S]*?decision/)
  assert.doesNotMatch(workbenchPreviewSource, /validity|interpretation|filterReasons|feasibilityScore|roiScore|analysisConclusion|averageScore/)
  assert.match(zhLocale, /'requirement-receiving-analysis':\s*\{[\s\S]*?需求分类[\s\S]*?战略契合度[\s\S]*?接收结论/)
  assert.doesNotMatch(zhLocale, /'requirement-receiving-analysis':\s*\{[\s\S]*?可实现性[\s\S]*?ROI[\s\S]*?综合价值/)
  assert.match(enLocale, /'requirement-receiving-analysis':\s*\{[\s\S]*?Requirement category[\s\S]*?Strategic fit[\s\S]*?Receiving decision/)
})

test('requirement integration preview only exposes the conditional integration fields', () => {
  assert.match(workbenchPreviewSource, /isRequirementIntegrationNode/)
  assert.match(workbenchPreviewSource, /isRequirementNodeWorkbench && isRequirementIntegration/)
  assert.match(workbenchPreviewSource, /是否整合需求/)
  assert.match(workbenchPreviewSource, /选择“是”后显示，可多选/)
  assert.match(workbenchPreviewSource, /确认需求规格/)
  assert.match(workbenchPreviewSource, /项目 \/ 专题 \/ 故事/)
})

test('requirement scheduling demo and preview expose target binding and expected launch range', () => {
  const demoSource = fs.readFileSync(new URL('./RequirementWorkbenchDemo.vue', import.meta.url), 'utf8')
  assert.match(demoSource, /name: '需求排期'/)
  assert.match(demoSource, /目标项目/)
  assert.match(demoSource, /目标专题/)
  assert.match(demoSource, /目标故事/)
  assert.match(demoSource, /期望上线时间/)
  assert.match(demoSource, /isSchedulingNode/)
  assert.match(workbenchPreviewSource, /isRequirementSchedulingNode/)
  assert.match(workbenchPreviewSource, /requirement-scheduling-template-fields/)
})

test('business workbench previews reuse the actual project-page section keys and table columns', () => {
  const actualComponentSources = {
    solution: fs.readFileSync(new URL('../../../views/project/detail/components/SolutionDesignWorkbench.vue', import.meta.url), 'utf8'),
    plan: fs.readFileSync(new URL('../../../views/project/detail/components/PlanResourceRiskWorkbench.vue', import.meta.url), 'utf8'),
    acceptance: fs.readFileSync(new URL('../../../views/project/detail/components/AcceptanceWorkbench.vue', import.meta.url), 'utf8'),
    release: fs.readFileSync(new URL('../../../views/project/detail/components/ReleaseDecisionHandoverWorkbench.vue', import.meta.url), 'utf8'),
    value: fs.readFileSync(new URL('../../../views/project/detail/components/ValueReviewWorkbench.vue', import.meta.url), 'utf8'),
    knowledge: fs.readFileSync(new URL('../../../views/project/detail/components/KnowledgeStandardWorkbench.vue', import.meta.url), 'utf8'),
  }

  for (const key of [
    'detail.solutionDesign.package.title', 'detail.solutionDesign.reviews.title', 'detail.solutionDesign.decision.title',
    'detail.planResourceRisk.iterationTitle', 'detail.planResourceRisk.resourceTitle', 'detail.planResourceRisk.riskTitle',
    'detail.acceptance.itemsTitle', 'detail.acceptance.defectsTitle', 'detail.acceptance.decisionTitle',
    'detail.release.infoTitle', 'detail.release.decisionTitle', 'detail.release.handoverTitle',
    'detail.valueReview.valueTitle', 'detail.valueReview.retrospectiveTitle',
  ]) {
    assert.match(workbenchPreviewSource, new RegExp(key.replaceAll('.', '\\.' )), `missing actual section key ${key}`)
  }

  for (const key of [
    'solution', 'plan', 'acceptance', 'release', 'value', 'knowledge',
  ]) {
    assert.ok(actualComponentSources[key].includes('<section'), `actual ${key} workbench should remain section-based`)
  }

  for (const column of [
    'productSolution', 'technicalSolution', 'iterationName', 'iterationGoal', 'role', 'focus', 'risk', 'response',
    'requirement', 'criteria', 'defectKey', 'defectSeverity', 'version', 'window', 'handoverNotes',
    'result', 'actualResult', 'asset', 'improvement', 'action', 'dueDate',
  ]) {
    assert.match(workbenchPreviewSource, new RegExp(column), `missing actual field ${column}`)
  }
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

test('the whole workflow node card selects the node while drag and delete controls stay isolated', () => {
  assert.match(template, /<article\s+[^>]*class="workflow-node-card"[^>]*:draggable="canWrite"[^>]*@click="selectNode\(node\.key\)"[^>]*@dragstart\.stop="dragKey = node\.key"[^>]*@dragend\.stop="dragKey = undefined"[^>]*>/)
  assert.match(template, /class="workflow-node-card__remove"[^>]*@click\.stop="removeNode\(node\)"/)
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

test('field component palette uses semantic icon components instead of typed glyphs', () => {
  assert.match(source, /FieldNumberOutlined/)
  assert.match(source, /CalendarOutlined/)
  assert.match(template, /class="field-type-symbol"><component :is="fieldTypeIcon\(type\)"\s*\/><\/span>/)
  assert.match(template, /class="field-type-symbol"><component :is="fieldTypeIcon\(binding\.type\)"\s*\/><\/span>/)
  assert.match(template, /<CheckOutlined v-if="isPaletteComponentAdded\(component\)" \/>/)
  assert.doesNotMatch(source, /function fieldTypeSymbol\(/)
})

test('workflow admin can solidify the selected process type default into a local source file', () => {
  const api = fs.readFileSync(new URL('../../../api/admin-workflow.ts', import.meta.url), 'utf8')
  assert.match(api, /solidifyWorkflowSystemDefault\(projectTypeId: number\)/)
  assert.match(api, /default-template\/system-default/)
  assert.match(source, /solidifyWorkflowSystemDefault\(typeId\)/)
  assert.match(template, /solidifySystemDefault/)
  assert.match(template, /selectedTemplateSummary\?\.defaultTemplate/)
  assert.match(zhLocale, /systemDefaultSolidified/)
  assert.match(enLocale, /systemDefaultSolidified/)
})

test('mobile field selection opens a dismissible inspector sheet and keeps it out of document flow', () => {
  assert.match(source, /function selectField\(fieldKey: string, event\?: MouseEvent\)[\s\S]*?openMobileInspector\(event\?\.currentTarget\)/)
  assert.match(template, /id="workflow-inspector-panel"[^>]*:class="\{ 'designer-inspector--mobile-open': mobileInspectorOpen \}"/)
  assert.match(template, /class="designer-inspector__close"[^>]*@click="closeMobileInspector"/)
  assert.match(template, /class="designer-field-select"[^>]*aria-controls="workflow-inspector-panel"/)
  assert.match(style, /@media \(max-width: 700px\)[\s\S]*?\.designer-inspector\s*\{[^}]*position:\s*fixed/)
  assert.match(style, /\.designer-inspector:not\(\.designer-inspector--mobile-open\)[\s\S]*?visibility:\s*hidden/)
})

test('inspector stays compact on desktop and mobile', () => {
  const desktopInspector = style.match(/\.designer-grid\s*\{([^}]+)\}/)?.[1] || ''
  assert.match(desktopInspector, /minmax\(196px,\s*\.82fr\)/)

  const mobileStart = style.lastIndexOf('@media (max-width: 700px)')
  const mobile = style.slice(mobileStart)
  assert.match(mobile, /\.designer-inspector\s*\{[^}]*width:\s*min\(520px,/)
  assert.match(mobile, /\.designer-inspector\s*\{[^}]*max-height:\s*min\(60vh,\s*520px\)/)
})

test('workflow header keeps primary save and publish actions together when actions wrap', () => {
  assert.match(template, /class="workflow-page-actions"[\s\S]*?class="workflow-page-actions__primary"[\s\S]*?@click="saveDraft"[\s\S]*?@click="publish"/)
  assert.match(style, /:deep\(\.workflow-page-actions__primary\)[^}]*\{[^}]*flex-wrap:\s*nowrap/)
})

test('designer field cards use lighter section separators and readable inspector labels', () => {
  assert.match(style, /\.designer-content-item\s*\{[^}]*background:\s*transparent[^}]*border:\s*0/)
  assert.match(style, /\.designer-field-card\s*\{[^}]*background:\s*transparent[^}]*border:\s*0/)
  assert.match(style, /\.designer-property-form :deep\(\.ant-form-item-label > label\)\s*\{[^}]*font-size:\s*var\(--pms-font-size-compact\)/)
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

test('requirement workflow exposes the node-specific workbench and editable demo entry', () => {
  const registry = fs.readFileSync(new URL('../../../components/workflow/workflow-component-registry.ts', import.meta.url), 'utf8')
  assert.match(registry, /REQUIREMENT_NODE_WORKBENCH:\s*'requirement-node-workbench'/)
  assert.match(source, /getAvailableWorkflowComponents/)
  assert.match(source, /createRequirementNodeWorkbenchConfig/)
  assert.match(source, /RequirementWorkbenchDemo/)
  assert.match(source, /requirementWorkbenchDemoOpen/)
})
