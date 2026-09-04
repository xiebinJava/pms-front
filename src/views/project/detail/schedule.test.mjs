import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCalendarEvents,
  buildCalendarWeeks,
  buildScheduleModel,
  buildTimelineWindow,
  clampDayWidth,
  dayWidthForSpan,
  applyScheduleDrag,
  createScheduleFromDrag,
  nodeScheduleTone,
  toDateKey,
} from './schedule.ts'

test('builds a padded window around the known dates', () => {
  const window = buildTimelineWindow(['2026-09-10', '2026-09-20'], '2026-09-15')
  assert.equal(window.start, '2026-09-05')
  assert.equal(window.end, '2026-09-25')
  assert.equal(window.days.length, 21)
  assert.equal(window.todayOffset, 10)
  assert.equal(window.dayWidth, 34)
  assert.ok(window.days[10].isToday)
  assert.ok(window.days.some((day) => day.isWeekend))
})

test('expands a short span to the minimum readable window', () => {
  const window = buildTimelineWindow(['2026-09-01', '2026-09-02'], '2026-09-01')
  assert.equal(window.days.length, 21)
})

test('uses today when no dates exist', () => {
  const window = buildTimelineWindow([], '2026-09-01')
  assert.equal(window.days.length, 21)
  assert.ok(window.days.some((day) => day.date === '2026-09-01' && day.isToday))
})

test('maps node status to timeline tones', () => {
  assert.equal(nodeScheduleTone(1), 'active')
  assert.equal(nodeScheduleTone(2), 'completed')
  assert.equal(nodeScheduleTone(0), 'locked')
  assert.equal(nodeScheduleTone(3), 'terminated')
})

test('places project, nodes, milestones and dated tasks on the chart', () => {
  const model = buildScheduleModel({
    today: '2026-09-10',
    selectedNodeId: 2,
    project: { id: 1, name: 'Alpha', startDate: '2026-09-01', endDate: '2026-09-30' },
    nodes: [
      { id: 2, name: 'Kickoff', status: 1, startDate: '2026-09-01', endDate: '2026-09-08', ownerName: '张伟' },
      { id: 3, name: 'Review', status: 0 },
    ],
    milestones: [{ id: 9, title: 'Freeze', dueDate: '2026-09-15', status: 0 }],
    tasks: [
      { id: 11, title: 'Write brief', dueDate: '2026-09-05', status: 1, nodeId: 2 },
      { id: 12, title: 'Child', dueDate: '2026-09-06', status: 0, parentId: 11, nodeId: 2 },
      { id: 13, title: 'No date', status: 0, nodeId: 2 },
    ],
  })

  assert.equal(model.lanes[0].kind, 'project')
  assert.equal(model.lanes[0].bar?.daySpan, 30)
  assert.equal(model.lanes[1].kind, 'node')
  assert.equal(model.lanes[1].selected, true)
  assert.equal(model.lanes[1].bar?.tone, 'active')
  assert.equal(model.lanes[2].kind, 'node')
  assert.equal(model.lanes[2].bar, undefined)
  assert.equal(model.unscheduledNodes.map((node) => node.id).join(','), '3')
  const milestoneLane = model.lanes.find((lane) => lane.kind === 'milestone')
  const taskLane = model.lanes.find((lane) => lane.kind === 'task')
  assert.equal(milestoneLane?.markers.length, 1)
  assert.equal(taskLane?.markers.map((marker) => marker.refId).join(','), '11')
})

test('calendar keeps range bars on week rows and day chips on dates', () => {
  const events = buildCalendarEvents({
    project: { id: 1, name: 'Alpha', startDate: '2026-09-01', endDate: '2026-09-10' },
    nodes: [{ id: 2, name: 'Kickoff', status: 1, startDate: '2026-09-02', endDate: '2026-09-04' }],
    milestones: [{ id: 9, title: 'Freeze', dueDate: '2026-09-03' }],
    tasks: [{ id: 11, title: 'Write brief', dueDate: '2026-09-03', status: 0, nodeId: 2 }],
  })
  const weeks = buildCalendarWeeks(2026, 9, events, '2026-09-03')
  const week = weeks.find((row) => row.days.some((day) => day.date === '2026-09-03'))
  assert.ok(week)
  assert.ok(week.rangeBars.some((bar) => bar.kind === 'node' && bar.span === 3))
  const wednesday = week.days.find((day) => day.date === '2026-09-03')
  assert.equal(wednesday?.isToday, true)
  assert.deepEqual(wednesday?.events.map((event) => event.kind).sort(), ['milestone', 'task'])
})

test('keeps day width readable as the window grows', () => {
  assert.equal(dayWidthForSpan(21), 34)
  assert.equal(dayWidthForSpan(80), 18)
  assert.equal(clampDayWidth(8), 14)
  assert.equal(clampDayWidth(31.5), 32)
  assert.equal(clampDayWidth(60), 52)
  assert.equal(toDateKey('not-a-date'), undefined)
})

test('moves a scheduled node by whole days while preserving its duration', () => {
  assert.deepEqual(applyScheduleDrag({
    start: '2026-09-01',
    end: '2026-09-04',
    mode: 'move',
    deltaDays: 3,
  }), {
    start: '2026-09-04',
    end: '2026-09-07',
  })
})

test('resizes a scheduled node from either edge and clamps invalid ranges', () => {
  assert.deepEqual(applyScheduleDrag({
    start: '2026-09-01',
    end: '2026-09-10',
    mode: 'resize-start',
    deltaDays: 3,
  }), {
    start: '2026-09-04',
    end: '2026-09-10',
  })
  assert.deepEqual(applyScheduleDrag({
    start: '2026-09-01',
    end: '2026-09-10',
    mode: 'resize-end',
    deltaDays: -20,
  }), {
    start: '2026-09-01',
    end: '2026-09-01',
  })
})

test('keeps moved node dates inside the visible timeline window', () => {
  assert.deepEqual(applyScheduleDrag({
    start: '2026-09-01',
    end: '2026-09-04',
    mode: 'move',
    deltaDays: -20,
    minDate: '2026-08-30',
    maxDate: '2026-09-30',
  }), {
    start: '2026-08-30',
    end: '2026-09-02',
  })
  assert.deepEqual(applyScheduleDrag({
    start: '2026-09-01',
    end: '2026-09-04',
    mode: 'resize-end',
    deltaDays: 20,
    minDate: '2026-08-30',
    maxDate: '2026-09-05',
  }), {
    start: '2026-09-01',
    end: '2026-09-05',
  })
})

test('creates a node schedule from a blank timeline drag', () => {
  assert.deepEqual(createScheduleFromDrag({
    anchor: '2026-09-10',
    current: '2026-09-13',
  }), {
    start: '2026-09-10',
    end: '2026-09-13',
  })
  assert.deepEqual(createScheduleFromDrag({
    anchor: '2026-09-13',
    current: '2026-09-10',
  }), {
    start: '2026-09-10',
    end: '2026-09-13',
  })
  assert.deepEqual(createScheduleFromDrag({
    anchor: '2026-09-10',
    current: '2026-09-10',
  }), {
    start: '2026-09-10',
    end: '2026-09-10',
  })
})

test('clamps a blank timeline drag to the visible window', () => {
  assert.deepEqual(createScheduleFromDrag({
    anchor: '2026-09-01',
    current: '2026-09-20',
    minDate: '2026-09-05',
    maxDate: '2026-09-15',
  }), {
    start: '2026-09-05',
    end: '2026-09-15',
  })
  assert.equal(createScheduleFromDrag({
    anchor: 'invalid',
    current: '2026-09-10',
  }), undefined)
})
