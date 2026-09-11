import dayjs from 'dayjs'
import type { NodeIterationPlan, Project, ProjectNode, Task } from '/@/types/domain'

export type ScheduleTone = 'project' | 'active' | 'completed' | 'locked' | 'terminated' | 'iteration-plan' | 'task'

export interface TimelineDay {
  date: string
  weekday: number
  isWeekend: boolean
  isToday: boolean
  day: number
  isMonthStart: boolean
}

export interface TimelineMonth {
  key: string
  label: string
  startOffset: number
  dayCount: number
}

export interface TimelineWindow {
  start: string
  end: string
  days: TimelineDay[]
  months: TimelineMonth[]
  todayOffset: number | null
  dayWidth: number
}

export interface ScheduleBar {
  id: string
  kind: 'project' | 'node'
  refId: number
  title: string
  start: string
  end: string
  startOffset: number
  daySpan: number
  tone: ScheduleTone
  ownerName?: string
  status?: number
}

export interface ScheduleMarker {
  id: string
  kind: 'iteration-plan' | 'task'
  refId: number
  title: string
  date: string
  offset: number
  tone: ScheduleTone
  nodeId?: number
  status?: number
}

export interface ScheduleLane {
  id: string
  kind: 'project' | 'node' | 'iteration-plan' | 'task'
  title: string
  subtitle?: string
  tone: ScheduleTone
  selected?: boolean
  bar?: ScheduleBar
  markers: ScheduleMarker[]
  nodeId?: number
}

export interface UnscheduledNode {
  id: number
  title: string
  ownerName?: string
}

export interface ScheduleModel {
  window: TimelineWindow
  lanes: ScheduleLane[]
  unscheduledNodes: UnscheduledNode[]
}

export interface CalendarEvent {
  id: string
  kind: 'project' | 'node' | 'iteration-plan' | 'task'
  refId: number
  title: string
  date: string
  endDate?: string
  tone: ScheduleTone
  nodeId?: number
}

export interface CalendarDayCell {
  date: string
  inMonth: boolean
  isToday: boolean
  isWeekend: boolean
  events: CalendarEvent[]
}

export interface CalendarRangeBar {
  id: string
  title: string
  tone: ScheduleTone
  startCol: number
  span: number
  refId: number
  kind: 'project' | 'node'
  nodeId?: number
}

export interface CalendarWeek {
  days: CalendarDayCell[]
  rangeBars: CalendarRangeBar[]
}

const MIN_WINDOW_DAYS = 21
const PAD_DAYS = 4

export function toDateKey(value?: string | null): string | undefined {
  if (!value) return undefined
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : undefined
}

export function nodeScheduleTone(status?: number): ScheduleTone {
  if (status === 2) return 'completed'
  if (status === 1) return 'active'
  if (status === 3) return 'terminated'
  return 'locked'
}

export function taskMarkerTone(status?: number): ScheduleTone {
  if (status === 2) return 'completed'
  if (status === 1) return 'active'
  return 'task'
}

export function dayWidthForSpan(dayCount: number): number {
  if (dayCount <= 36) return 34
  if (dayCount <= 72) return 24
  if (dayCount <= 120) return 18
  return 14
}

export function clampDayWidth(value: number, min = 14, max = 52): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

export type ScheduleDragMode = 'move' | 'resize-start' | 'resize-end'

export function applyScheduleDrag(input: {
  start: string
  end: string
  mode: ScheduleDragMode
  deltaDays: number
  minDate?: string
  maxDate?: string
}): { start: string; end: string } | undefined {
  const start = toDateKey(input.start)
  const end = toDateKey(input.end)
  if (!start || !end || start > end || !Number.isFinite(input.deltaDays)) return undefined

  const minDate = toDateKey(input.minDate)
  const maxDate = toDateKey(input.maxDate)
  if (minDate && maxDate && minDate > maxDate) return undefined

  const shift = (date: string, days: number) => dayjs(date).add(days, 'day').format('YYYY-MM-DD')
  let nextStart = start
  let nextEnd = end

  if (input.mode === 'move') {
    let delta = Math.round(input.deltaDays)
    if (minDate && shift(start, delta) < minDate) delta += dayjs(minDate).diff(dayjs(shift(start, delta)), 'day')
    if (maxDate && shift(end, delta) > maxDate) delta -= dayjs(shift(end, delta)).diff(dayjs(maxDate), 'day')
    nextStart = shift(start, delta)
    nextEnd = shift(end, delta)
  } else if (input.mode === 'resize-start') {
    nextStart = shift(start, Math.round(input.deltaDays))
    if (minDate && nextStart < minDate) nextStart = minDate
    if (nextStart > end) nextStart = end
  } else {
    nextEnd = shift(end, Math.round(input.deltaDays))
    if (maxDate && nextEnd > maxDate) nextEnd = maxDate
    if (nextEnd < start) nextEnd = start
  }

  return { start: nextStart, end: nextEnd }
}

export function createScheduleFromDrag(input: {
  anchor: string
  current: string
  minDate?: string
  maxDate?: string
}): { start: string; end: string } | undefined {
  const anchor = toDateKey(input.anchor)
  const current = toDateKey(input.current)
  if (!anchor || !current) return undefined

  const minDate = toDateKey(input.minDate)
  const maxDate = toDateKey(input.maxDate)
  if (minDate && maxDate && minDate > maxDate) return undefined

  const clamp = (date: string) => {
    if (minDate && date < minDate) return minDate
    if (maxDate && date > maxDate) return maxDate
    return date
  }
  const dates = [clamp(anchor), clamp(current)].sort()
  return { start: dates[0], end: dates[1] }
}

function collectKeys(values: Array<string | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value && dayjs(value).isValid()))
}

export function buildTimelineWindow(
  dates: Array<string | undefined>,
  today = dayjs().format('YYYY-MM-DD'),
): TimelineWindow {
  const todayKey = toDateKey(today) || dayjs().format('YYYY-MM-DD')
  const keys = collectKeys([...dates, todayKey])
  let start = keys.length
    ? keys.reduce((min, key) => (key < min ? key : min))
    : todayKey
  let end = keys.length
    ? keys.reduce((max, key) => (key > max ? key : max))
    : todayKey

  start = dayjs(start).subtract(PAD_DAYS, 'day').format('YYYY-MM-DD')
  end = dayjs(end).add(PAD_DAYS, 'day').format('YYYY-MM-DD')

  let span = dayjs(end).diff(dayjs(start), 'day') + 1
  if (span < MIN_WINDOW_DAYS) {
    const extra = MIN_WINDOW_DAYS - span
    const before = Math.floor(extra / 2)
    start = dayjs(start).subtract(before, 'day').format('YYYY-MM-DD')
    end = dayjs(end).add(extra - before, 'day').format('YYYY-MM-DD')
    span = MIN_WINDOW_DAYS
  }

  const days: TimelineDay[] = []
  const months: TimelineMonth[] = []
  let cursor = dayjs(start)
  const last = dayjs(end)
  let todayOffset: number | null = null

  while (!cursor.isAfter(last, 'day')) {
    const date = cursor.format('YYYY-MM-DD')
    const weekday = cursor.day()
    const isMonthStart = cursor.date() === 1 || days.length === 0
    days.push({
      date,
      weekday,
      isWeekend: weekday === 0 || weekday === 6,
      isToday: date === todayKey,
      day: cursor.date(),
      isMonthStart,
    })
    if (date === todayKey) todayOffset = days.length - 1
    if (isMonthStart) {
      months.push({
        key: cursor.format('YYYY-MM'),
        label: cursor.format('YYYY-MM'),
        startOffset: days.length - 1,
        dayCount: 0,
      })
    }
    months[months.length - 1].dayCount += 1
    cursor = cursor.add(1, 'day')
  }

  return {
    start,
    end,
    days,
    months,
    todayOffset,
    dayWidth: dayWidthForSpan(days.length),
  }
}

function offsetOf(window: TimelineWindow, date: string): number {
  return Math.max(0, dayjs(date).diff(dayjs(window.start), 'day'))
}

function clampBar(window: TimelineWindow, start?: string, end?: string) {
  const from = toDateKey(start)
  const to = toDateKey(end)
  if (!from || !to || from > to) return undefined
  const left = from < window.start ? window.start : from
  const right = to > window.end ? window.end : to
  if (left > window.end || right < window.start) return undefined
  return {
    start: from,
    end: to,
    startOffset: offsetOf(window, left),
    daySpan: dayjs(right).diff(dayjs(left), 'day') + 1,
  }
}

export function buildScheduleModel(input: {
  project: Project
  nodes: ProjectNode[]
  tasks?: Task[]
  iterationPlans?: NodeIterationPlan[]
  selectedNodeId?: number | null
  today?: string
}): ScheduleModel {
  const nodeRanges = input.nodes.flatMap((node) => [node.startDate, node.endDate])
  const taskDates = (input.tasks || []).map((task) => task.dueDate)
  const iterationPlanDates = (input.iterationPlans || []).flatMap((plan) => [plan.startDate, plan.dueDate])
  const window = buildTimelineWindow([
    input.project.startDate,
    input.project.endDate,
    ...nodeRanges,
    ...taskDates,
    ...iterationPlanDates,
  ], input.today)

  const lanes: ScheduleLane[] = []
  const projectSpan = clampBar(window, input.project.startDate, input.project.endDate)
  lanes.push({
    id: `project-${input.project.id}`,
    kind: 'project',
    title: input.project.name,
    subtitle: [input.project.startDate, input.project.endDate].filter(Boolean).join(' → ') || undefined,
    tone: 'project',
    bar: projectSpan
      ? {
          id: `project-bar-${input.project.id}`,
          kind: 'project',
          refId: input.project.id,
          title: input.project.name,
          tone: 'project',
          ...projectSpan,
        }
      : undefined,
    markers: [],
  })

  const unscheduledNodes: UnscheduledNode[] = []
  input.nodes.forEach((node) => {
    const span = clampBar(window, node.startDate, node.endDate)
    if (!span) {
      unscheduledNodes.push({ id: node.id, title: node.name, ownerName: node.ownerName })
    }
    lanes.push({
      id: `node-${node.id}`,
      kind: 'node',
      title: node.name,
      subtitle: node.ownerName,
      tone: nodeScheduleTone(node.status),
      selected: node.id === input.selectedNodeId,
      nodeId: node.id,
      bar: span
        ? {
            id: `node-bar-${node.id}`,
            kind: 'node',
            refId: node.id,
            title: node.name,
            tone: nodeScheduleTone(node.status),
            ownerName: node.ownerName,
            status: node.status,
            ...span,
          }
        : undefined,
      markers: [],
    })
  })

  const iterationPlanMarkers: ScheduleMarker[] = []
  ;(input.iterationPlans || []).forEach((plan) => {
    const date = toDateKey(plan.dueDate || plan.startDate)
    if (!date || date < window.start || date > window.end) return
    iterationPlanMarkers.push({
      id: `iteration-plan-${plan.id || plan.sort || date}`,
      kind: 'iteration-plan',
      refId: plan.id || 0,
      title: plan.name,
      date,
      offset: offsetOf(window, date),
      tone: 'iteration-plan',
    })
  })

  lanes.push({
    id: 'iteration-plans',
    kind: 'iteration-plan',
    title: '',
    tone: 'iteration-plan',
    markers: iterationPlanMarkers,
  })

  const taskMarkers: ScheduleMarker[] = []
  ;(input.tasks || []).filter((task) => !task.parentId).forEach((task) => {
    const date = toDateKey(task.dueDate)
    if (!date || date < window.start || date > window.end) return
    taskMarkers.push({
      id: `task-${task.id}`,
      kind: 'task',
      refId: task.id,
      title: task.title,
      date,
      offset: offsetOf(window, date),
      tone: taskMarkerTone(task.status),
      nodeId: task.nodeId,
      status: task.status,
    })
  })

  lanes.push({
    id: 'tasks',
    kind: 'task',
    title: '',
    tone: 'task',
    markers: taskMarkers,
  })

  return { window, lanes, unscheduledNodes }
}

export function buildCalendarEvents(input: {
  project: Project
  nodes: ProjectNode[]
  tasks?: Task[]
  iterationPlans?: NodeIterationPlan[]
}): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const projectStart = toDateKey(input.project.startDate)
  const projectEnd = toDateKey(input.project.endDate)
  if (projectStart && projectEnd && projectStart <= projectEnd) {
    events.push({
      id: `project-${input.project.id}`,
      kind: 'project',
      refId: input.project.id,
      title: input.project.name,
      date: projectStart,
      endDate: projectEnd,
      tone: 'project',
    })
  }

  input.nodes.forEach((node) => {
    const start = toDateKey(node.startDate)
    const end = toDateKey(node.endDate)
    if (!start || !end || start > end) return
    events.push({
      id: `node-${node.id}`,
      kind: 'node',
      refId: node.id,
      title: node.name,
      date: start,
      endDate: end,
      tone: nodeScheduleTone(node.status),
      nodeId: node.id,
    })
  })

  ;(input.iterationPlans || []).forEach((plan) => {
    const date = toDateKey(plan.dueDate || plan.startDate)
    if (!date) return
    events.push({
      id: `iteration-plan-${plan.id || plan.sort || date}`,
      kind: 'iteration-plan',
      refId: plan.id || 0,
      title: plan.name,
      date,
      tone: 'iteration-plan',
    })
  })

  ;(input.tasks || []).filter((task) => !task.parentId).forEach((task) => {
    const date = toDateKey(task.dueDate)
    if (!date) return
    events.push({
      id: `task-${task.id}`,
      kind: 'task',
      refId: task.id,
      title: task.title,
      date,
      tone: taskMarkerTone(task.status),
      nodeId: task.nodeId,
    })
  })

  return events
}

function mondayOf(date: string): string {
  const current = dayjs(date)
  const shift = (current.day() + 6) % 7
  return current.subtract(shift, 'day').format('YYYY-MM-DD')
}

export function buildCalendarWeeks(
  year: number,
  month: number,
  events: CalendarEvent[],
  today = dayjs().format('YYYY-MM-DD'),
): CalendarWeek[] {
  const monthStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`)
  const gridStart = dayjs(mondayOf(monthStart.format('YYYY-MM-DD')))
  const monthEnd = monthStart.endOf('month')
  const gridEndShift = (7 - ((monthEnd.day() + 6) % 7) - 1 + 7) % 7
  const gridEnd = monthEnd.add(gridEndShift, 'day')
  const todayKey = toDateKey(today) || dayjs().format('YYYY-MM-DD')
  const weeks: CalendarWeek[] = []
  let cursor = gridStart

  while (!cursor.isAfter(gridEnd, 'day')) {
    const days: CalendarDayCell[] = []
    for (let index = 0; index < 7; index += 1) {
      const date = cursor.add(index, 'day').format('YYYY-MM-DD')
      const weekday = cursor.add(index, 'day').day()
      days.push({
        date,
        inMonth: dayjs(date).month() + 1 === month,
        isToday: date === todayKey,
        isWeekend: weekday === 0 || weekday === 6,
        events: events.filter((event) => event.kind === 'iteration-plan' || event.kind === 'task')
          .filter((event) => event.date === date),
      })
    }

    const weekStart = days[0].date
    const weekEnd = days[6].date
    const rangeBars: CalendarRangeBar[] = []
    events.forEach((event) => {
      if (event.kind !== 'project' && event.kind !== 'node') return
      const start = event.date
      const end = event.endDate || event.date
      if (end < weekStart || start > weekEnd) return
      const left = start < weekStart ? weekStart : start
      const right = end > weekEnd ? weekEnd : end
      rangeBars.push({
        id: `${event.id}-${weekStart}`,
        title: event.title,
        tone: event.tone,
        startCol: dayjs(left).diff(dayjs(weekStart), 'day'),
        span: dayjs(right).diff(dayjs(left), 'day') + 1,
        refId: event.refId,
        kind: event.kind,
        nodeId: event.nodeId,
      })
    })

    weeks.push({ days, rangeBars })
    cursor = cursor.add(7, 'day')
  }

  return weeks
}

export function monthLabel(year: number, month: number, locale: string): string {
  const value = dayjs(`${year}-${String(month).padStart(2, '0')}-01`)
  return locale.startsWith('zh') ? value.format('YYYY年M月') : value.format('MMMM YYYY')
}
