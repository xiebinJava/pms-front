import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Exercise the real page handlers with a deterministic API; no source-text assertions.
const source = readFileSync(new URL('./DevelopmentItemDetailPage.vue', import.meta.url), 'utf8').split('<script setup lang="ts">')[1].split('</script>')[0]
const parsed = ts.createSourceFile('detail.ts', source, ts.ScriptTarget.Latest, true)
const names = new Set(['setSelectedNode', 'markNodeFormDirty', 'saveNode', 'onDetailUpdated'])
const handlers = parsed.statements.filter(statement => ts.isFunctionDeclaration(statement) && names.has(statement.name?.text)).map(statement => statement.getText(parsed)).join('\n')

function pageContext(api) {
  const node = { id: 95, status: 1, version: 0, fieldValues: { build: 'original' } }
  const submitted = []
  const notices = { success: [], error: [] }
  const context = {
    selectedNodeId: { value: 95 }, nodeForm: {}, nodeFormDirty: { value: false }, nodeFormVersion: { value: undefined },
    detail: { value: { id: 15, nodes: [node] } }, props: { itemType: 'topic' }, savingNode: { value: false },
    nodeFormEditRevision: 0, activeNodeSave: null, queuedNodeSave: false,
    isNodeReadOnly: status => status === 2, message: { success: value => notices.success.push(value), error: value => notices.error.push(value) }, t: key => key, errorMessage: () => 'conflict',
    updateDevelopmentItemNode: async (_type, _item, _node, payload) => {
      submitted.push(payload)
      if (api) return api(payload)
      if (payload.version !== 1) throw new Error('conflict')
      return { id: 15, nodes: [{ ...node, version: 2, fieldValues: payload.fieldValues }] }
    },
  }
  context.selectedNode = { get value() { return context.detail.value.nodes.find(item => item.id === context.selectedNodeId.value) } }
  vm.createContext(context)
  vm.runInContext(ts.transpileModule(handlers, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context)
  context.setSelectedNode(node)
  return { context, node, submitted, notices }
}

test('ordinary field autosaves are silent while owner and schedule changes notify', async () => {
  for (const change of ['field', 'owner', 'schedule']) {
    const { context, node, notices } = pageContext(async payload => ({ id: 15, nodes: [{ ...node, ...payload, version: 1 }] }))
    if (change === 'field') context.nodeForm.fieldValues = { build: 'updated' }
    if (change === 'owner') context.nodeForm.ownerId = 8
    if (change === 'schedule') context.nodeForm.startDate = '2026-10-06'
    context.markNodeFormDirty()
    assert.equal(await context.saveNode(), true)
    assert.equal(notices.success.length, change === 'field' ? 0 : 1)
    await context.saveNode()
    assert.equal(notices.success.length, change === 'field' ? 0 : 1)
  }
})

test('failed ordinary field saves still report an error', async () => {
  const { context, notices } = pageContext(async () => { throw new Error('failure') })
  context.nodeForm.fieldValues = { build: 'updated' }
  context.markNodeFormDirty()
  assert.equal(await context.saveNode(), false)
  assert.equal(notices.success.length, 0)
  assert.equal(notices.error.length, 1)
})

test('task refresh retains the dirty form version so a peer edit cannot be silently overwritten', async () => {
  const { context, node, submitted } = pageContext()
  context.nodeForm.fieldValues = { build: 'my unsaved change' }
  context.markNodeFormDirty()
  context.onDetailUpdated({ id: 15, nodes: [{ ...node, version: 1, fieldValues: { build: 'peer edit' } }] })
  assert.equal(await context.saveNode(), false)
  assert.equal(submitted[0].version, 0)
  assert.equal(context.nodeFormDirty.value, true)
  assert.equal(context.nodeForm.fieldValues.build, 'my unsaved change')
  assert.equal(context.detail.value.nodes[0].fieldValues.build, 'peer edit')
})

test('successful save advances the form baseline while retaining later queued edits', async () => {
  let resolveSave
  const { context, node, submitted } = pageContext(() => new Promise(resolve => { resolveSave = resolve }))
  context.nodeForm.fieldValues = { build: 'first edit' }
  context.markNodeFormDirty()
  const save = context.saveNode()
  context.nodeForm.fieldValues = { build: 'later edit' }
  context.markNodeFormDirty()
  assert.equal(context.saveNode(), save)
  let resolveSecond
  context.updateDevelopmentItemNode = async (_type, _item, _node, payload) => {
    submitted.push(payload)
    return new Promise(resolve => { resolveSecond = resolve })
  }
  resolveSave({ id: 15, nodes: [{ ...node, version: 1, fieldValues: { build: 'first edit' } }] })
  assert.equal(await save, true)
  assert.equal(context.nodeFormVersion.value, 1)
  assert.equal(context.nodeFormDirty.value, true)
  assert.equal(context.nodeForm.fieldValues.build, 'later edit')
  assert.equal(submitted.length, 2)
  assert.equal(submitted.at(-1).version, 1)
  resolveSecond({ id: 15, nodes: [{ ...node, version: 2, fieldValues: submitted.at(-1).fieldValues }] })
  assert.equal(await context.activeNodeSave, true)
  assert.equal(context.nodeFormDirty.value, false)
  assert.equal(context.nodeForm.fieldValues.build, 'later edit')
})
