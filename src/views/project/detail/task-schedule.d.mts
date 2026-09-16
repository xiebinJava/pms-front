import type { TaskScheduleState } from '../../../types/domain'

export declare function scheduleTone(state?: TaskScheduleState): 'none' | 'due-today' | 'on-time' | 'overdue' | 'completed'
export declare function scheduleLabelKey(state?: TaskScheduleState): string
