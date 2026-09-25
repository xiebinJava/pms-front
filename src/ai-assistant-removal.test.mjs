import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('removes AI assistant routes and shell entry points', () => {
  const router = read('src/router/index.ts')
  const layout = read('src/layout/Index.vue')
  const style = read('src/styles/pms-theme.css')

  assert.doesNotMatch(router, /path:\s*'ai-demo'/u)
  assert.doesNotMatch(router, /path:\s*'ai-agents\/:agentId'/u)
  assert.doesNotMatch(layout, /AiProjectAssistantDrawer|AI_ASSISTANT_API|AI_ASSISTANT_CHANGED_EVENT|pms-ai-assistant-fab|openAiAssistant/u)
  assert.doesNotMatch(layout, /admin-ai-agents|nav\.aiAgents|ai-agent-config/u)
  assert.doesNotMatch(style, /pms-ai-assistant-fab/u)
})

test('removes AI assistant integrations from project list and detail pages', () => {
  const projectList = read('src/views/project/list/index.vue')
  const projectDetail = read('src/views/project/detail/index.vue')
  const projectDashboard = read('src/views/project-dashboard/index.vue')

  assert.doesNotMatch(projectList, /AI_ASSISTANT_API|AI_ASSISTANT_CHANGED_EVENT|createPageContext|publishAiContext|onAiAssistantChanged/u)
  assert.doesNotMatch(projectDetail, /AI_ASSISTANT_API|AI_ASSISTANT_CHANGED_EVENT|createPageContext|aiAssistant|openAiAssistant|RobotOutlined|aiAssistantShort/u)
  assert.doesNotMatch(projectDashboard, /AI_ASSISTANT_API|AI_ASSISTANT_CHANGED_EVENT|onAiAssistantChanged/u)
})

test('removes AI-only frontend modules and tests', () => {
  for (const relativePath of [
    'src/components/ai',
    'src/views/ai-agents',
    'src/views/ai-demo',
    'src/views/project/detail/components/AiProjectAssistantDrawer.vue',
    'src/api/work-helper.ts',
    'src/api/work-helper.test.mjs',
    'tests/e2e/ai-assistant-drawer.spec.ts',
    'tests/e2e/playwright.ai-assistant.config.mjs',
  ]) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), false, `${relativePath} should be removed`)
  }
})
