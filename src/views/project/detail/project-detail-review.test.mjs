import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import path from 'node:path'
import { getInitialActiveNodeId } from './workflow.ts'

const detailRoot = path.resolve(import.meta.dirname)

test('completed projects select the last completed node by default', () => {
  const nodes = [
    { id: 11, status: 2 },
    { id: 12, status: 2 },
    { id: 13, status: 2 },
  ]

  assert.equal(getInitialActiveNodeId(nodes), 13)
})

test('active projects still select the in-progress node before earlier completed nodes', () => {
  const nodes = [
    { id: 11, status: 2 },
    { id: 12, status: 1 },
    { id: 13, status: 0 },
  ]

  assert.equal(getInitialActiveNodeId(nodes), 12)
})

test('project detail exposes a retry state when the initial load fails', () => {
  const source = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')

  assert.match(source, /loadError/)
  assert.match(source, /detail\.loadRetry/)
  assert.match(source, /@click="loadData"/)
})

test('completed nodes explain why their controls are read-only', () => {
  const source = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')

  assert.match(source, /detail\.nodeReadonlyHint/)
  assert.match(source, /activeNodeReadOnly/)
})

test('mobile project metadata allows the business line to wrap instead of disappearing', () => {
  const source = fs.readFileSync(path.join(detailRoot, 'index.vue'), 'utf8')

  assert.match(source, /\.project-header__meta-item--wide strong[^{]*\{[^}]*-webkit-line-clamp:\s*2/s)
})

test('flow navigation exposes a visible horizontal scrolling hint', () => {
  const source = fs.readFileSync(path.join(detailRoot, 'components/NodeNavigator.vue'), 'utf8')

  assert.match(source, /detail\.flowScrollHint/)
  assert.match(source, /flow-navigator__hint/)
})

test('gantt lane labels are keyboard accessible and expose full names', () => {
  const source = fs.readFileSync(path.join(detailRoot, 'components/ProjectScheduleChart.vue'), 'utf8')

  assert.match(source, /:role="lane\.nodeId \? 'button' : undefined"/)
  assert.match(source, /:tabindex="lane\.nodeId \? 0 : undefined"/)
  assert.match(source, /@keydown\.enter/)
  assert.match(source, /:title="laneTitle\(lane\)"/)
})
