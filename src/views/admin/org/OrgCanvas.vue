<script setup lang="ts">
import { computed, ref } from 'vue'
import type { OrgUnit } from '/@/types/domain'

const props = defineProps<{ units: OrgUnit[]; selected?: number; readonly?: boolean }>()
const emit = defineEmits<{ select: [unit: OrgUnit]; move: [id: number, parentId: number | undefined] }>()

const NODE_WIDTH = 154
const NODE_HEIGHT = 58
const HORIZONTAL_GAP = 38
const VERTICAL_GAP = 94
const PADDING = 60
const MIN_STAGE_WIDTH = 980

type LayoutNode = { unit: OrgUnit; x: number; y: number; depth: number }
type LayoutLink = { id: string; path: string }
type CanvasLayout = { nodes: LayoutNode[]; links: LayoutLink[]; width: number; height: number }

const viewportRef = ref<HTMLDivElement>()
const zoom = ref(1)
const pan = ref({ x: 28, y: 28 })
const isPanning = ref(false)
const panStart = ref({ pointerX: 0, pointerY: 0, x: 0, y: 0 })

function buildLayout(units: OrgUnit[]): CanvasLayout {
  const centers = new Map<number, number>()
  let leafIndex = 0
  let maxDepth = 0

  function measure(unit: OrgUnit): number {
    const children = unit.children || []
    if (!children.length) {
      const center = leafIndex
      leafIndex += 1
      centers.set(unit.id, center)
      return center
    }
    const childCenters = children.map(measure)
    const center = childCenters.reduce((sum, value) => sum + value, 0) / childCenters.length
    centers.set(unit.id, center)
    return center
  }

  units.forEach(measure)
  const horizontalStep = NODE_WIDTH + HORIZONTAL_GAP
  const nodes: LayoutNode[] = []

  function place(unit: OrgUnit, depth: number) {
    maxDepth = Math.max(maxDepth, depth)
    nodes.push({
      unit,
      x: PADDING + (centers.get(unit.id) || 0) * horizontalStep,
      y: PADDING + depth * (NODE_HEIGHT + VERTICAL_GAP),
      depth,
    })
    ;(unit.children || []).forEach(child => place(child, depth + 1))
  }

  units.forEach(unit => place(unit, 0))
  const byId = new Map(nodes.map(node => [node.unit.id, node]))
  const links: LayoutLink[] = []
  for (const parent of nodes) {
    for (const child of parent.unit.children || []) {
      const childNode = byId.get(child.id)
      if (!childNode) continue
      const startX = parent.x + NODE_WIDTH / 2
      const startY = parent.y + NODE_HEIGHT
      const endX = childNode.x + NODE_WIDTH / 2
      const endY = childNode.y
      const middleY = startY + (endY - startY) / 2
      links.push({
        id: `${parent.unit.id}-${child.id}`,
        path: `M ${startX} ${startY} V ${middleY} H ${endX} V ${endY}`,
      })
    }
  }

  const lastLeafX = PADDING + Math.max(leafIndex - 1, 0) * horizontalStep
  return {
    nodes,
    links,
    width: Math.max(MIN_STAGE_WIDTH, lastLeafX + NODE_WIDTH + PADDING),
    height: Math.max(480, PADDING * 2 + maxDepth * (NODE_HEIGHT + VERTICAL_GAP) + NODE_HEIGHT),
  }
}

const canvas = computed(() => buildLayout(props.units))
const stageStyle = computed(() => ({
  width: `${canvas.value.width}px`,
  height: `${canvas.value.height}px`,
  transform: `translate(${pan.value.x}px, ${pan.value.y}px) scale(${zoom.value})`,
}))

function drop(event: DragEvent, parentId: number) {
  event.preventDefault()
  if (props.readonly) return
  const raw = event.dataTransfer?.getData('text/plain')
  const id = raw ? Number(raw) : NaN
  if (Number.isFinite(id) && id !== parentId) emit('move', id, parentId)
}

function startDrag(event: DragEvent, id: number) {
  event.dataTransfer?.setData('text/plain', String(id))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function startPan(event: PointerEvent) {
  const target = event.target as Element | null
  if (target?.closest('.org-node')) return
  const viewport = viewportRef.value
  if (!viewport) return
  isPanning.value = true
  panStart.value = { pointerX: event.clientX, pointerY: event.clientY, x: pan.value.x, y: pan.value.y }
  viewport.setPointerCapture(event.pointerId)
}

function movePan(event: PointerEvent) {
  if (!isPanning.value) return
  pan.value = {
    x: panStart.value.x + event.clientX - panStart.value.pointerX,
    y: panStart.value.y + event.clientY - panStart.value.pointerY,
  }
}

function endPan(event?: PointerEvent) {
  const viewport = viewportRef.value
  if (viewport && event && viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId)
  isPanning.value = false
}

function clampZoom(value: number) {
  return Math.min(1.8, Math.max(0.6, Number(value.toFixed(2))))
}

function setZoom(value: number) {
  zoom.value = clampZoom(value)
}

function handleWheel(event: WheelEvent) {
  const viewport = viewportRef.value
  const nextZoom = clampZoom(zoom.value + (event.deltaY > 0 ? -0.1 : 0.1))
  if (!viewport || nextZoom === zoom.value) return
  const rect = viewport.getBoundingClientRect()
  const cursorX = event.clientX - rect.left
  const cursorY = event.clientY - rect.top
  const worldX = (cursorX - pan.value.x) / zoom.value
  const worldY = (cursorY - pan.value.y) / zoom.value
  pan.value = { x: cursorX - worldX * nextZoom, y: cursorY - worldY * nextZoom }
  zoom.value = nextZoom
}

function resetView() {
  zoom.value = 1
  pan.value = { x: 28, y: 28 }
}
</script>

<template>
  <div
    ref="viewportRef"
    class="org-canvas-viewport"
    :class="{ 'is-panning': isPanning }"
    @pointerdown="startPan"
    @pointermove="movePan"
    @pointerup="endPan"
    @pointercancel="endPan"
    @wheel.prevent="handleWheel"
  >
    <div class="org-canvas-toolbar" @pointerdown.stop>
      <button type="button" aria-label="缩小画布" title="缩小" @click="setZoom(zoom - 0.1)">−</button>
      <span>{{ Math.round(zoom * 100) }}%</span>
      <button type="button" aria-label="放大画布" title="放大" @click="setZoom(zoom + 0.1)">＋</button>
      <button type="button" aria-label="恢复画布视图" title="恢复默认视图" @click="resetView">100%</button>
    </div>

    <div v-if="!props.units.length" class="org-canvas-empty">暂无组织单元</div>
    <div v-else class="org-canvas-stage" :style="stageStyle">
      <svg class="org-links" :width="canvas.width" :height="canvas.height" :viewBox="`0 0 ${canvas.width} ${canvas.height}`" aria-hidden="true">
        <path v-for="link in canvas.links" :key="link.id" :d="link.path" />
      </svg>

      <button
        v-for="node in canvas.nodes"
        :key="node.unit.id"
        type="button"
        class="org-node"
        :class="{ selected: selected === node.unit.id }"
        :style="{ left: `${node.x}px`, top: `${node.y}px` }"
        :draggable="!props.readonly"
        @pointerdown.stop
        @dragstart="startDrag($event, node.unit.id)"
        @dragover.prevent
        @drop="drop($event, node.unit.id)"
        @click="emit('select', node.unit)"
      >
        <strong>{{ node.unit.name }}</strong>
        <span>{{ node.unit.typeCode || node.unit.code }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.org-canvas-viewport { position: relative; min-height: 560px; height: min(680px, calc(100vh - 220px)); overflow: hidden; background: var(--pms-surface-muted); cursor: grab; touch-action: none; }
.org-canvas-viewport.is-panning { cursor: grabbing; }
.org-canvas-toolbar { position: absolute; z-index: 2; top: 14px; right: 14px; display: flex; align-items: center; gap: 4px; padding: 4px; color: var(--pms-text-muted); background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: 7px; box-shadow: var(--pms-shadow-sm); }
.org-canvas-toolbar button { min-width: 30px; height: 30px; padding: 0 7px; color: var(--pms-text); font-size: var(--pms-font-size-compact); background: transparent; border: 0; border-radius: 5px; cursor: pointer; }
.org-canvas-toolbar button:hover { color: var(--pms-primary); background: var(--pms-primary-soft); }
.org-canvas-toolbar span { min-width: 42px; font-size: var(--pms-font-size-caption); text-align: center; }
.org-canvas-stage { position: absolute; top: 0; left: 0; transform-origin: 0 0; will-change: transform; }
.org-links { position: absolute; top: 0; left: 0; overflow: visible; color: var(--pms-border-strong); pointer-events: none; }
.org-links path { fill: none; stroke: currentColor; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
.org-node { position: absolute; display: grid; width: 154px; min-height: 58px; gap: 3px; padding: 10px 14px; color: var(--pms-text); text-align: center; background: var(--pms-surface); border: 1px solid var(--pms-border-strong); border-radius: 7px; box-shadow: var(--pms-shadow-sm); cursor: pointer; }
.org-node strong { overflow: hidden; font-size: var(--pms-font-size-body); font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.org-node span { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.org-node.selected { color: var(--pms-primary); border-color: var(--pms-primary); box-shadow: 0 0 0 3px var(--pms-primary-soft); }
.org-canvas-empty { display: grid; min-height: 560px; place-items: center; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
@media (max-width: 760px) { .org-canvas-viewport { height: 520px; min-height: 520px; } .org-canvas-toolbar { top: 10px; right: 10px; } }
</style>
