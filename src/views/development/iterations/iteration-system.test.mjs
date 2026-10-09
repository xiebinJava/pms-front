import test from 'node:test'
import assert from 'node:assert/strict'
import { applyIterationSystem, selectableIterationVersions, loadAllOptionPages } from './iteration-system.mjs'

test('changing system clears a stale version, while the same system preserves it', () => {
  const form = { systemId: 1, systemVersionId: 11 }
  applyIterationSystem(form, 2)
  assert.deepEqual(form, { systemId: 2, systemVersionId: undefined })
  form.systemVersionId = 22
  applyIterationSystem(form, 2)
  assert.equal(form.systemVersionId, 22)
  applyIterationSystem(form, undefined)
  assert.deepEqual(form, { systemId: undefined, systemVersionId: undefined })
})

test('only nonterminal versions belonging to the selected system can be selected', () => {
  const versions = [
    { id: 1, systemId: 2, status: 'PLANNED' },
    { id: 3, systemId: 2, status: 'DEVELOPING' },
    { id: 5, systemId: 2, status: 'RELEASED' },
    { id: 6, systemId: 2, status: 'ARCHIVED' },
    { id: 7, systemId: 3, status: 'PLANNED' },
  ]
  assert.deepEqual(selectableIterationVersions(versions, 2).map(v => v.id), [1, 3])
  assert.deepEqual(selectableIterationVersions(versions, undefined), [])
})

test('option loading includes later pages rather than stopping at the first 100 rows', async () => {
  const pages = []
  const result = await loadAllOptionPages(async currPage => {
    pages.push(currPage)
    return { list: currPage === 1 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }], total: 3 }
  })
  assert.deepEqual(result.map(row => row.id), [1, 2, 3])
  assert.deepEqual(pages, [1, 2])
})

test('an empty page terminates option loading even when the total becomes stale', async () => {
  assert.deepEqual(await loadAllOptionPages(async () => ({ list: [], total: 10 })), [])
})
