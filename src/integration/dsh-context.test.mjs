import assert from 'node:assert/strict'
import test from 'node:test'
import { createPmsContextLocator, createPmsContextSyncMessage, parsePmsContextRequest } from './dsh-context.ts'

test('context locator maps PMS routes to DSH page types', () => {
  assert.deepEqual(createPmsContextLocator('/projects'), {
    pageType: 'project-list',
    route: '/projects',
    contextVersion: 'v1',
  })
  assert.deepEqual(createPmsContextLocator('/projects/22?node=8'), {
    pageType: 'project-detail',
    route: '/projects/22?node=8',
    projectId: 22,
    nodeId: 8,
    contextVersion: 'v1',
  })
  assert.equal(createPmsContextLocator('/dashboard').pageType, 'project-dashboard')
})

test('context request and sync messages use the versioned PMS locator shape', () => {
  assert.equal(parsePmsContextRequest({
    source: 'pms',
    type: 'pms.context.request',
    version: 1,
  }), true)
  assert.equal(parsePmsContextRequest({ source: 'dsh', type: 'pms.context.request', version: 1 }), false)
  const message = createPmsContextSyncMessage(createPmsContextLocator('/projects'))
  assert.equal(message.source, 'pms')
  assert.equal(message.type, 'pms.context.sync')
  assert.equal(message.version, 1)
})
