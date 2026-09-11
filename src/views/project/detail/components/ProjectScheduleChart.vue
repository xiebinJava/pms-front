<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AimOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons-vue'
import type { NodeIterationPlan, Project, ProjectNode, Task } from '/@/types/domain'
import { formatDate } from '/@/utils/format'
import { applyScheduleDrag, buildScheduleModel, clampDayWidth, createScheduleFromDrag, toDateKey, type ScheduleDragMode, type ScheduleLane, type ScheduleMarker } from '../schedule'

const props = defineProps<{
  project: Project
  nodes: ProjectNode[]
  tasks: Task[]
  iterationPlans: NodeIterationPlan[]
  selectedNodeId?: number | null
  canEditNode: (node: ProjectNode) => boolean
  savingNodeId?: number | null
}>()

const emit = defineEmits<{
  selectNode: [nodeId: number]
  openTask: [taskId: number, nodeId?: number]
  updateNodeSchedule: [{ nodeId: number; startDate: string; endDate: string }]
}>()

const { t, locale } = useI18n()
const scroller = ref<HTMLElement | null>(null)
const hoverTip = ref<{ x: number; y: number; title: string; meta: string } | null>(null)
const dragPreview = ref<{ nodeId: number; start: string; end: string } | null>(null)
const createPreview = ref<{ nodeId: number; start: string; end: string } | null>(null)
const suppressBarClick = ref(false)
type NodeDragState = {
  nodeId: number
  mode: ScheduleDragMode
  pointerStartX: number
  start: string
  end: string
  preview?: { start: string; end: string }
  moved: boolean
}
const dragState = ref<NodeDragState | null>(null)
type NodeCreateState = {
  nodeId: number
  pointerStartX: number
  anchorDate: string
  track: HTMLElement
  preview?: { start: string; end: string }
  moved: boolean
}
const createState = ref<NodeCreateState | null>(null)
const DAY_WIDTH_STEP = 8
const MIN_DAY_WIDTH = 14
const MAX_DAY_WIDTH = 52

const model = computed(() => buildScheduleModel({
  project: props.project,
  nodes: props.nodes,
  tasks: props.tasks,
  iterationPlans: props.iterationPlans,
  selectedNodeId: props.selectedNodeId,
}))

const selectedDayWidth = ref<number | null>(null)
const dayWidth = computed(() => clampDayWidth(
  selectedDayWidth.value ?? model.value.window.dayWidth,
  MIN_DAY_WIDTH,
  MAX_DAY_WIDTH,
))
const canReduceDayWidth = computed(() => dayWidth.value > MIN_DAY_WIDTH)
const canIncreaseDayWidth = computed(() => dayWidth.value < MAX_DAY_WIDTH)
const timelineWidth = computed(() => model.value.window.days.length * dayWidth.value)

function adjustDayWidth(direction: -1 | 1) {
  selectedDayWidth.value = clampDayWidth(
    dayWidth.value + direction * DAY_WIDTH_STEP,
    MIN_DAY_WIDTH,
    MAX_DAY_WIDTH,
  )
}

function laneTitle(lane: ScheduleLane): string {
  if (lane.kind === 'project') return t('schedule.projectLane')
  if (lane.kind === 'iteration-plan') return t('schedule.iterationPlanLane')
  if (lane.kind === 'task') return t('schedule.taskLane')
  return lane.title
}

function monthCaption(key: string): string {
  const [year, month] = key.split('-')
  return locale.value.startsWith('zh') ? `${year}年${Number(month)}月` : key
}

function weekdayLabel(weekday: number): string {
  return t(`schedule.weekday.${weekday}`)
}

function barMeta(lane: ScheduleLane): string {
  const dates = barDates(lane)
  if (!dates) return t('schedule.noRange')
  return `${formatDate(dates.start)} → ${formatDate(dates.end)}`
}

function markerMeta(marker: ScheduleMarker): string {
  return formatDate(marker.date)
}

function showTip(event: MouseEvent, title: string, meta: string) {
  const host = scroller.value?.getBoundingClientRect()
  if (!host) return
  hoverTip.value = {
    x: event.clientX - host.left + (scroller.value?.scrollLeft || 0) + 12,
    y: event.clientY - host.top + (scroller.value?.scrollTop || 0) - 12,
    title,
    meta,
  }
}

function hideTip() {
  hoverTip.value = null
}

function onNodeClick(lane: ScheduleLane) {
  if (lane.nodeId) emit('selectNode', lane.nodeId)
}

const nodeMap = computed(() => new Map(props.nodes.map((node) => [node.id, node])))

function barDates(lane: ScheduleLane): { start: string; end: string } | undefined {
  if (!lane.bar) return undefined
  const preview = dragPreview.value
  if (preview && preview.nodeId === lane.nodeId) {
    return { start: preview.start, end: preview.end }
  }
  return { start: lane.bar.start, end: lane.bar.end }
}

function isNodeBarEditable(lane: ScheduleLane): boolean {
  if (lane.kind !== 'node' || lane.nodeId == null || !lane.bar) return false
  if (props.savingNodeId === lane.nodeId) return false
  const node = nodeMap.value.get(lane.nodeId)
  return Boolean(node && props.canEditNode(node))
}

function barStyle(lane: ScheduleLane): Record<string, string> {
  return dateRangeStyle(barDates(lane))
}

function dateRangeStyle(dates?: { start: string; end: string }): Record<string, string> {
  if (!dates) return {}
  const start = toDateKey(dates.start)
  const end = toDateKey(dates.end)
  if (!start || !end) return {}
  const visibleStart = start < model.value.window.start ? model.value.window.start : start
  const visibleEnd = end > model.value.window.end ? model.value.window.end : end
  const daySpan = dayjs(visibleEnd).diff(dayjs(visibleStart), 'day') + 1
  return {
    left: `${Math.max(0, dayjs(visibleStart).diff(dayjs(model.value.window.start), 'day')) * dayWidth.value + 4}px`,
    width: `${Math.max(daySpan * dayWidth.value - 8, 16)}px`,
  }
}

function createBarStyle(lane: ScheduleLane): Record<string, string> {
  const preview = createPreview.value
  if (!preview || preview.nodeId !== lane.nodeId) return {}
  return dateRangeStyle(preview)
}

function cleanupNodeDrag() {
  window.removeEventListener('pointermove', onNodeDragMove)
  window.removeEventListener('pointerup', onNodeDragEnd)
  window.removeEventListener('pointercancel', onNodeDragEnd)
  window.removeEventListener('pointermove', onNodeRangeMove)
  window.removeEventListener('pointerup', onNodeRangeEnd)
  window.removeEventListener('pointercancel', onNodeRangeEnd)
  document.body.classList.remove('gantt-is-dragging')
}

function startNodeDrag(event: PointerEvent, lane: ScheduleLane, mode: ScheduleDragMode = 'move') {
  if (!lane.bar || lane.nodeId == null || !isNodeBarEditable(lane)) return
  dragState.value = {
    nodeId: lane.nodeId,
    mode,
    pointerStartX: event.clientX,
    start: lane.bar.start,
    end: lane.bar.end,
    moved: false,
  }
  document.body.classList.add('gantt-is-dragging')
  window.addEventListener('pointermove', onNodeDragMove)
  window.addEventListener('pointerup', onNodeDragEnd)
  window.addEventListener('pointercancel', onNodeDragEnd)
}

function onNodeDragMove(event: PointerEvent) {
  const state = dragState.value
  if (!state) return
  const deltaDays = Math.round((event.clientX - state.pointerStartX) / dayWidth.value)
  const next = applyScheduleDrag({
    start: state.start,
    end: state.end,
    mode: state.mode,
    deltaDays,
    minDate: model.value.window.start,
    maxDate: model.value.window.end,
  })
  if (!next) return
  state.preview = next
  state.moved = state.moved || (state.mode !== 'move' ? Math.abs(event.clientX - state.pointerStartX) > 4 : deltaDays !== 0)
  if (state.moved) {
    event.preventDefault()
    dragPreview.value = { nodeId: state.nodeId, ...next }
  }
}

function onNodeDragEnd() {
  const state = dragState.value
  if (!state) return
  const next = state.preview
  cleanupNodeDrag()
  dragState.value = null
  dragPreview.value = null
  if (!state.moved || !next || (next.start === state.start && next.end === state.end)) {
    if (state.mode !== 'move') {
      suppressBarClick.value = true
      window.setTimeout(() => { suppressBarClick.value = false }, 0)
    }
    return
  }
  suppressBarClick.value = true
  window.setTimeout(() => { suppressBarClick.value = false }, 0)
  emit('updateNodeSchedule', { nodeId: state.nodeId, startDate: next.start, endDate: next.end })
}

function isNodeTrackCreatable(lane: ScheduleLane): boolean {
  if (lane.kind !== 'node' || lane.nodeId == null || lane.bar) return false
  if (props.project.status !== 1 || props.savingNodeId === lane.nodeId) return false
  const node = nodeMap.value.get(lane.nodeId)
  return Boolean(node && props.canEditNode(node))
}

function dateAtPointer(clientX: number, track: HTMLElement): string | undefined {
  const rect = track.getBoundingClientRect()
  const index = Math.floor((clientX - rect.left) / dayWidth.value)
  const day = model.value.window.days[Math.max(0, Math.min(model.value.window.days.length - 1, index))]
  return day?.date
}

function startNodeRange(event: PointerEvent, lane: ScheduleLane) {
  if (event.button !== 0 || !isNodeTrackCreatable(lane)) return
  const track = event.currentTarget as HTMLElement | null
  const anchorDate = track ? dateAtPointer(event.clientX, track) : undefined
  if (!track || !anchorDate) return
  createState.value = {
    nodeId: lane.nodeId!,
    pointerStartX: event.clientX,
    anchorDate,
    track,
    moved: false,
  }
  event.preventDefault()
  document.body.classList.add('gantt-is-dragging')
  window.addEventListener('pointermove', onNodeRangeMove)
  window.addEventListener('pointerup', onNodeRangeEnd)
  window.addEventListener('pointercancel', onNodeRangeEnd)
}

function onNodeRangeMove(event: PointerEvent) {
  const state = createState.value
  if (!state) return
  const currentDate = dateAtPointer(event.clientX, state.track)
  if (!currentDate) return
  const next = createScheduleFromDrag({
    anchor: state.anchorDate,
    current: currentDate,
    minDate: model.value.window.start,
    maxDate: model.value.window.end,
  })
  if (!next) return
  state.preview = next
  state.moved = state.moved || Math.abs(event.clientX - state.pointerStartX) > 4
  if (state.moved) {
    event.preventDefault()
    createPreview.value = { nodeId: state.nodeId, ...next }
  }
}

function onNodeRangeEnd() {
  const state = createState.value
  if (!state) return
  const next = state.preview
  cleanupNodeDrag()
  createState.value = null
  createPreview.value = null
  if (!state.moved || !next) return
  suppressBarClick.value = true
  window.setTimeout(() => { suppressBarClick.value = false }, 0)
  emit('updateNodeSchedule', { nodeId: state.nodeId, startDate: next.start, endDate: next.end })
}

function onTrackClick(event: MouseEvent, lane: ScheduleLane) {
  const target = event.target
  if (target instanceof Element && target.closest('.gantt-bar, .gantt-mark')) return
  if (suppressBarClick.value) {
    event.preventDefault()
    suppressBarClick.value = false
    return
  }
  onNodeClick(lane)
}

function onBarClick(event: MouseEvent, lane: ScheduleLane) {
  if (suppressBarClick.value) {
    event.preventDefault()
    suppressBarClick.value = false
    return
  }
  onNodeClick(lane)
}

function onMarkerClick(marker: ScheduleMarker) {
  if (marker.kind === 'task') emit('openTask', marker.refId, marker.nodeId)
}

function scrollToToday() {
  const offset = model.value.window.todayOffset
  const el = scroller.value
  if (offset == null || !el) return
  const left = offset * dayWidth.value - el.clientWidth * 0.32
  el.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
}

onMounted(() => {
  void nextTick(scrollToToday)
})

onBeforeUnmount(cleanupNodeDrag)

watch(() => model.value.window.start, () => {
  void nextTick(scrollToToday)
})
</script>

<template>
  <div class="gantt">
    <div class="gantt__toolbar">
      <div class="gantt__legend" aria-hidden="true">
        <span class="gantt-legend gantt-legend--project">{{ $t('schedule.legendProject') }}</span>
        <span class="gantt-legend gantt-legend--active">{{ $t('schedule.legendActive') }}</span>
        <span class="gantt-legend gantt-legend--completed">{{ $t('schedule.legendDone') }}</span>
        <span class="gantt-legend gantt-legend--locked">{{ $t('schedule.legendPending') }}</span>
        <span class="gantt-legend gantt-legend--iteration-plan">{{ $t('schedule.legendIterationPlan') }}</span>
        <span class="gantt-legend gantt-legend--task">{{ $t('schedule.legendTask') }}</span>
      </div>
      <div class="gantt__toolbar-actions">
        <div class="gantt__zoom" role="group" :aria-label="$t('schedule.dayWidth')">
          <span class="gantt__zoom-label">{{ $t('schedule.dayWidth') }}</span>
          <button
            type="button"
            class="gantt__zoom-button pms-project-button pms-project-button--secondary pms-project-button--small"
            :disabled="!canReduceDayWidth"
            :aria-label="$t('schedule.zoomOut')"
            :title="$t('schedule.zoomOut')"
            @click="adjustDayWidth(-1)"
          >
            <MinusOutlined />
          </button>
          <span class="gantt__zoom-value">{{ dayWidth }}px</span>
          <button
            type="button"
            class="gantt__zoom-button pms-project-button pms-project-button--secondary pms-project-button--small"
            :disabled="!canIncreaseDayWidth"
            :aria-label="$t('schedule.zoomIn')"
            :title="$t('schedule.zoomIn')"
            @click="adjustDayWidth(1)"
          >
            <PlusOutlined />
          </button>
        </div>
        <button type="button" class="gantt__today pms-project-button pms-project-button--secondary pms-project-button--small" @click="scrollToToday">
          <AimOutlined /> {{ $t('schedule.today') }}
        </button>
      </div>
    </div>

    <div ref="scroller" class="gantt__scroll">
      <div class="gantt__frame">
      <div class="gantt__grid" :style="{ '--gantt-day-width': `${dayWidth}px`, '--gantt-track-width': `${timelineWidth}px` }">
        <div class="gantt__corner">{{ $t('schedule.lanes') }}</div>
        <div class="gantt__head" :style="{ width: `${timelineWidth}px` }">
          <div class="gantt__months">
            <div
              v-for="month in model.window.months"
              :key="month.key"
              class="gantt__month"
              :style="{ width: `${month.dayCount * dayWidth}px` }"
            >
              {{ monthCaption(month.key) }}
            </div>
          </div>
          <div class="gantt__days">
            <div
              v-for="day in model.window.days"
              :key="day.date"
              class="gantt__day"
              :class="{ 'gantt__day--weekend': day.isWeekend, 'gantt__day--today': day.isToday }"
            >
              <small>{{ weekdayLabel(day.weekday) }}</small>
              <strong>{{ day.day }}</strong>
            </div>
          </div>
        </div>

        <template v-for="lane in model.lanes" :key="lane.id">
          <div
            class="gantt__label"
            :class="[`gantt__label--${lane.kind}`, { 'gantt__label--selected': lane.selected }]"
            :role="lane.nodeId ? 'button' : undefined"
            :tabindex="lane.nodeId ? 0 : undefined"
            :aria-label="lane.nodeId ? laneTitle(lane) : undefined"
            :title="laneTitle(lane)"
            @click="onNodeClick(lane)"
            @keydown.enter.prevent="onNodeClick(lane)"
            @keydown.space.prevent="onNodeClick(lane)"
          >
            <span class="gantt__swatch" :class="`gantt__swatch--${lane.tone}`" />
            <span class="gantt__label-copy">
              <strong>{{ laneTitle(lane) }}</strong>
              <small v-if="lane.subtitle">{{ lane.subtitle }}</small>
            </span>
          </div>
          <div
            class="gantt__track"
            :class="{ 'gantt__track--selected': lane.selected, 'gantt__track--creatable': isNodeTrackCreatable(lane) }"
            :style="{ width: `${timelineWidth}px` }"
            :title="isNodeTrackCreatable(lane) ? $t('schedule.createNodeRange') : undefined"
            @pointerdown="startNodeRange($event, lane)"
            @click="onTrackClick($event, lane)"
          >
            <span
              v-for="day in model.window.days"
              :key="`${lane.id}-${day.date}`"
              class="gantt__cell"
              :class="{ 'gantt__cell--weekend': day.isWeekend }"
            />
            <span
              v-if="createPreview?.nodeId === lane.nodeId && lane.kind === 'node' && lane.nodeId != null && !lane.bar"
              class="gantt-bar gantt-bar--creating"
              :class="`gantt-bar--${lane.tone}`"
              :style="createBarStyle(lane)"
              aria-hidden="true"
            >
              <span class="gantt-bar__glow" />
              <span class="gantt-bar__label">{{ lane.title }}</span>
            </span>
            <span v-else-if="!lane.bar && lane.kind === 'node'" class="gantt-empty gantt-empty--editable">{{ $t('schedule.noRange') }}</span>
            <button
              v-if="lane.bar"
              type="button"
              class="gantt-bar"
              :class="[`gantt-bar--${lane.bar.tone}`, { 'gantt-bar--selected': lane.selected, 'gantt-bar--editable': isNodeBarEditable(lane), 'gantt-bar--dragging': dragState?.nodeId === lane.nodeId }]"
              :style="barStyle(lane)"
              :aria-label="lane.bar.title"
              :title="isNodeBarEditable(lane) ? $t('schedule.dragNode') : undefined"
              @pointerdown="startNodeDrag($event, lane)"
              @click="onBarClick($event, lane)"
              @mousemove="showTip($event, lane.bar.title, barMeta(lane))"
              @mouseleave="hideTip"
            >
              <span
                v-if="isNodeBarEditable(lane)"
                class="gantt-bar__handle gantt-bar__handle--start"
                :aria-label="$t('schedule.resizeStart')"
                @pointerdown.stop.prevent="startNodeDrag($event, lane, 'resize-start')"
              />
              <span
                v-if="isNodeBarEditable(lane)"
                class="gantt-bar__handle gantt-bar__handle--end"
                :aria-label="$t('schedule.resizeEnd')"
                @pointerdown.stop.prevent="startNodeDrag($event, lane, 'resize-end')"
              />
              <span class="gantt-bar__glow" />
              <span class="gantt-bar__label">{{ lane.bar.title }}</span>
            </button>
            <button
              v-for="marker in lane.markers"
              :key="marker.id"
              type="button"
              class="gantt-mark"
              :class="`gantt-mark--${marker.kind} gantt-mark--${marker.tone}`"
              :style="{ left: `${marker.offset * dayWidth + dayWidth / 2}px` }"
              :aria-label="marker.title"
              @click="onMarkerClick(marker)"
              @mousemove="showTip($event, marker.title, markerMeta(marker))"
              @mouseleave="hideTip"
            />
          </div>
        </template>

      </div>
      <div
        v-if="model.window.todayOffset != null"
        class="gantt__today-line"
        :style="{ left: `calc(var(--gantt-label-width) + ${model.window.todayOffset * dayWidth + dayWidth / 2}px)` }"
      >
        <span>{{ $t('schedule.today') }}</span>
      </div>
      </div>

      <div
        v-if="hoverTip"
        class="gantt__tip"
        :style="{ left: `${hoverTip.x}px`, top: `${hoverTip.y}px` }"
      >
        <strong>{{ hoverTip.title }}</strong>
        <small>{{ hoverTip.meta }}</small>
      </div>
    </div>

    <p v-if="model.unscheduledNodes.length" class="gantt__hint">
      {{ $t('schedule.unscheduledHint', { count: model.unscheduledNodes.length }) }}
    </p>
  </div>
</template>

<style scoped>
.gantt { display: grid; gap: 12px; --gantt-label-width: 200px; }
.gantt__toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.gantt__toolbar-actions { display: inline-flex; align-items: center; gap: 10px; }
.gantt__legend { display: flex; flex-wrap: wrap; gap: 10px 14px; }
.gantt-legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--pms-text-muted);
  font-size: var(--pms-font-size-caption);
}
.gantt-legend::before { content: ''; width: 14px; height: 8px; border-radius: 999px; }
.gantt-legend--project::before { background: linear-gradient(90deg, var(--pms-primary), color-mix(in srgb, var(--pms-primary) 55%, #7aa7e6)); }
.gantt-legend--active::before { background: var(--pms-status-active); }
.gantt-legend--completed::before { background: var(--pms-success); }
.gantt-legend--locked::before { background: var(--pms-status-neutral); }
.gantt-legend--iteration-plan::before { width: 8px; height: 8px; background: var(--pms-warning); transform: rotate(45deg); border-radius: 1px; }
.gantt-legend--task::before { width: 8px; height: 8px; background: color-mix(in srgb, var(--pms-primary) 70%, #fff); border-radius: 50%; }
.gantt__zoom {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 6px;
  color: var(--pms-text-muted);
  background: var(--pms-surface-muted);
  border: 1px solid var(--pms-border);
  border-radius: 8px;
}
.gantt__zoom-label { font-size: var(--pms-font-size-caption); }
.gantt__zoom-value {
  min-width: 36px;
  color: var(--pms-text);
  font-size: var(--pms-font-size-caption);
  font-variant-numeric: tabular-nums;
  text-align: center;
}
.gantt__zoom-button { min-width: 28px; padding: 0 6px; }
.gantt__today {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 12px;
  color: #5d6d85;
  background: #fff;
  border: 1px solid #d7dfeb;
  border-radius: 8px;
  font-size: var(--pms-font-size-compact);
  font-weight: 680;
  cursor: pointer;
}
.gantt__today:hover { color: #1769e0; background: #eaf2ff; border-color: #b9d2f7; }
.gantt__scroll {
  position: relative;
  overflow: auto;
  max-height: min(68vh, 720px);
  border: 1px solid var(--pms-border);
  border-radius: 10px;
  background:
    linear-gradient(180deg, #fbfcfe 0%, #ffffff 36px),
    var(--pms-surface);
  box-shadow: var(--pms-shadow-sm);
}
.gantt__frame { position: relative; width: max-content; min-width: 100%; }
.gantt__grid {
  display: grid;
  grid-template-columns: var(--gantt-label-width) var(--gantt-track-width);
  min-width: calc(var(--gantt-label-width) + var(--gantt-track-width));
}
.gantt__corner,
.gantt__label {
  position: sticky;
  left: 0;
  z-index: 3;
  background: #fff;
  border-right: 1px solid var(--pms-border);
  border-bottom: 1px solid var(--pms-border);
}
.gantt__corner {
  z-index: 5;
  display: flex;
  align-items: flex-end;
  min-height: 64px;
  padding: 0 14px 10px;
  color: var(--pms-text-faint);
  font-size: var(--pms-font-size-caption);
  font-weight: 650;
  letter-spacing: 0.04em;
}
.gantt__head {
  position: sticky;
  top: 0;
  z-index: 4;
  background: #f8fafc;
  border-bottom: 1px solid var(--pms-border);
}
.gantt__months { display: flex; }
.gantt__month {
  display: flex;
  align-items: center;
  min-height: 28px;
  padding: 0 8px;
  color: var(--pms-text);
  font-size: var(--pms-font-size-compact);
  font-weight: 700;
  border-right: 1px solid var(--pms-border);
}
.gantt__days { display: flex; }
.gantt__day {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: var(--gantt-day-width);
  min-height: 36px;
  color: var(--pms-text-muted);
  border-right: 1px solid color-mix(in srgb, var(--pms-border) 70%, transparent);
}
.gantt__day small { font-size: 10px; line-height: 1; }
.gantt__day strong { font-size: var(--pms-font-size-caption); font-weight: 680; line-height: 1.2; }
.gantt__day--weekend { color: var(--pms-text-faint); background: color-mix(in srgb, var(--pms-surface-strong) 55%, transparent); }
.gantt__day--today { color: var(--pms-primary); background: var(--pms-primary-soft); }
.gantt__label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 8px 12px;
  cursor: default;
}
.gantt__label--node { cursor: pointer; }
.gantt__label--selected { background: var(--pms-primary-soft); }
.gantt__label--project { min-height: 48px; }
.gantt__swatch { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 8px; }
.gantt__swatch--project { background: var(--pms-primary); box-shadow: 0 0 0 3px var(--pms-primary-soft); }
.gantt__swatch--active { background: var(--pms-status-active); }
.gantt__swatch--completed { background: var(--pms-success); }
.gantt__swatch--locked { background: var(--pms-status-neutral); }
.gantt__swatch--terminated { background: var(--pms-danger); }
.gantt__swatch--iteration-plan { background: var(--pms-warning); transform: rotate(45deg); border-radius: 1px; }
.gantt__swatch--task { background: color-mix(in srgb, var(--pms-primary) 65%, #fff); }
.gantt__label-copy { min-width: 0; display: grid; gap: 1px; }
.gantt__label-copy strong {
  overflow: hidden;
  color: var(--pms-text);
  font-size: var(--pms-font-size-compact);
  font-weight: 680;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gantt__label-copy small { color: var(--pms-text-faint); font-size: 10px; }
.gantt__track {
  position: relative;
  display: flex;
  min-height: 44px;
  border-bottom: 1px solid var(--pms-border);
  background: repeating-linear-gradient(
    90deg,
    transparent,
    transparent calc(var(--gantt-day-width) - 1px),
    color-mix(in srgb, var(--pms-border) 70%, transparent) calc(var(--gantt-day-width) - 1px),
    color-mix(in srgb, var(--pms-border) 70%, transparent) var(--gantt-day-width)
  );
}
.gantt__track--creatable { cursor: crosshair; touch-action: none; }
.gantt__track--selected { background-color: color-mix(in srgb, var(--pms-primary-soft) 55%, transparent); }
.gantt__cell { width: var(--gantt-day-width); flex: 0 0 var(--gantt-day-width); }
.gantt__cell--weekend { background: color-mix(in srgb, var(--pms-surface-strong) 45%, transparent); }
.gantt-bar {
  position: absolute;
  top: 11px;
  z-index: 2;
  display: flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  overflow: hidden;
  color: #fff;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 1px 2px rgb(16 34 63 / 10%), 0 6px 14px rgb(16 34 63 / 8%);
}
.gantt-bar__glow {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgb(255 255 255 / 28%), transparent 58%);
  pointer-events: none;
}
.gantt-bar__label {
  position: relative;
  overflow: hidden;
  font-size: var(--pms-font-size-caption);
  font-weight: 700;
  letter-spacing: 0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gantt-bar--project {
  top: 12px;
  height: 24px;
  background: linear-gradient(90deg, var(--pms-primary-dark), var(--pms-primary) 48%, color-mix(in srgb, var(--pms-primary) 62%, #8bb4ea));
}
.gantt-bar--active { background: linear-gradient(90deg, #d97706, var(--pms-status-active)); }
.gantt-bar--completed { background: linear-gradient(90deg, #066540, var(--pms-success)); }
.gantt-bar--locked { background: linear-gradient(90deg, #6d7a8b, var(--pms-status-neutral)); }
.gantt-bar--terminated { background: linear-gradient(90deg, #9c242c, var(--pms-danger)); }
.gantt-bar--creating { pointer-events: none; border: 1px dashed rgb(255 255 255 / 72%); opacity: .88; }
.gantt-bar--selected { box-shadow: 0 0 0 3px var(--pms-primary-soft), 0 8px 18px rgb(10 93 194 / 18%); }
.gantt-bar--editable { cursor: grab; touch-action: none; }
.gantt-bar--editable:hover { filter: saturate(1.06) brightness(1.03); }
.gantt-bar--dragging { cursor: grabbing; opacity: .9; box-shadow: 0 0 0 3px var(--pms-primary-soft), 0 8px 18px rgb(10 93 194 / 24%); }
.gantt-bar__handle {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 4;
  width: 10px;
  cursor: ew-resize;
  touch-action: none;
}
.gantt-bar__handle::after { content: ''; position: absolute; top: 5px; bottom: 5px; left: 4px; width: 2px; background: rgb(255 255 255 / 72%); border-radius: 2px; opacity: 0; transition: opacity 120ms ease; }
.gantt-bar:hover .gantt-bar__handle::after,
.gantt-bar--dragging .gantt-bar__handle::after { opacity: 1; }
.gantt-bar__handle--start { left: 0; }
.gantt-bar__handle--end { right: 0; }
.gantt-empty {
  position: absolute;
  left: 10px;
  top: 50%;
  z-index: 2;
  padding: 2px 8px;
  color: var(--pms-text-faint);
  background: color-mix(in srgb, var(--pms-surface-muted) 88%, #fff);
  border: 1px dashed var(--pms-border-strong);
  border-radius: 999px;
  font-size: 10px;
  pointer-events: none;
  transform: translateY(-50%);
}
.gantt-empty--editable { cursor: crosshair; }
.gantt-mark {
  position: absolute;
  top: 50%;
  z-index: 2;
  width: 12px;
  height: 12px;
  padding: 0;
  border: 2px solid #fff;
  transform: translate(-50%, -50%);
  cursor: pointer;
  box-shadow: 0 1px 4px rgb(16 34 63 / 16%);
}
.gantt-mark--iteration-plan {
  background: var(--pms-warning);
  border-radius: 2px;
  transform: translate(-50%, -50%) rotate(45deg);
}
.gantt-mark--task { border-radius: 50%; }
.gantt-mark--task.gantt-mark--task { background: color-mix(in srgb, var(--pms-primary) 72%, #fff); }
.gantt-mark--task.gantt-mark--active { background: var(--pms-status-active); }
.gantt-mark--task.gantt-mark--completed { background: var(--pms-success); }
.gantt__today-line {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 1;
  width: 0;
  border-left: 2px dashed color-mix(in srgb, var(--pms-primary) 70%, #fff);
  pointer-events: none;
}
.gantt__today-line span {
  position: absolute;
  top: 6px;
  left: 6px;
  padding: 1px 6px;
  color: var(--pms-primary);
  background: #fff;
  border: 1px solid color-mix(in srgb, var(--pms-primary) 22%, var(--pms-border));
  border-radius: 999px;
  font-size: 10px;
  font-weight: 720;
  box-shadow: var(--pms-shadow-sm);
}
.gantt__tip {
  position: absolute;
  z-index: 8;
  display: grid;
  gap: 2px;
  min-width: 140px;
  padding: 8px 10px;
  color: var(--pms-text);
  background: #fff;
  border: 1px solid var(--pms-border);
  border-radius: 8px;
  box-shadow: var(--pms-shadow-md);
  pointer-events: none;
}
.gantt__tip strong { font-size: var(--pms-font-size-compact); font-weight: 700; }
.gantt__tip small { color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); }
.gantt__hint { margin: 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
:global(body.gantt-is-dragging) { user-select: none; }
@media (max-width: 640px) {
  .gantt { --gantt-label-width: 148px; }
  .gantt__toolbar { align-items: flex-start; flex-wrap: wrap; }
  .gantt__toolbar-actions { margin-left: auto; }
}
</style>
