const scheduleTones = {
  NO_DUE_DATE: 'none',
  DUE_TODAY: 'due-today',
  ON_TIME: 'on-time',
  OVERDUE: 'overdue',
  COMPLETED: 'completed',
}

const scheduleLabelKeys = {
  NO_DUE_DATE: 'task.scheduleState.noDueDate',
  DUE_TODAY: 'task.scheduleState.dueToday',
  ON_TIME: 'task.scheduleState.onTime',
  OVERDUE: 'task.scheduleState.overdue',
  COMPLETED: 'task.scheduleState.completed',
}

export function scheduleTone(state) {
  return scheduleTones[state] ?? 'none'
}

export function scheduleLabelKey(state) {
  return scheduleLabelKeys[state] ?? 'task.scheduleState.noDueDate'
}
