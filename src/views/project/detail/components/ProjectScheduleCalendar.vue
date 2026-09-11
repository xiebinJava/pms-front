<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { LeftOutlined, RightOutlined } from '@ant-design/icons-vue'
import type { NodeIterationPlan, Project, ProjectNode, Task } from '/@/types/domain'
import { buildCalendarEvents, buildCalendarWeeks, monthLabel, type CalendarEvent } from '../schedule'

const props = defineProps<{
  project: Project
  nodes: ProjectNode[]
  tasks: Task[]
  iterationPlans: NodeIterationPlan[]
  selectedNodeId?: number | null
}>()

const emit = defineEmits<{
  selectNode: [nodeId: number]
  openTask: [taskId: number, nodeId?: number]
}>()

const { t, locale } = useI18n()
const now = new Date()
const cursor = ref({ year: now.getFullYear(), month: now.getMonth() + 1 })

const events = computed(() => buildCalendarEvents({
  project: props.project,
  nodes: props.nodes,
  tasks: props.tasks,
  iterationPlans: props.iterationPlans,
}))

const weeks = computed(() => buildCalendarWeeks(cursor.value.year, cursor.value.month, events.value))
const title = computed(() => monthLabel(cursor.value.year, cursor.value.month, locale.value))

function shift(delta: number) {
  const next = new Date(cursor.value.year, cursor.value.month - 1 + delta, 1)
  cursor.value = { year: next.getFullYear(), month: next.getMonth() + 1 }
}

function goToday() {
  const today = new Date()
  cursor.value = { year: today.getFullYear(), month: today.getMonth() + 1 }
}

function onDayEvent(event: CalendarEvent) {
  if (event.kind === 'task') emit('openTask', event.refId, event.nodeId)
}

function onRange(bar: { kind: 'project' | 'node'; refId: number; nodeId?: number }) {
  if (bar.kind === 'node') emit('selectNode', bar.nodeId || bar.refId)
}
</script>

<template>
  <div class="cal">
    <div class="cal__toolbar">
      <div class="cal__nav">
        <button type="button" class="cal__icon pms-project-button pms-project-button--secondary pms-project-button--small pms-project-button--icon" :aria-label="$t('schedule.prevMonth')" @click="shift(-1)">
          <LeftOutlined />
        </button>
        <strong>{{ title }}</strong>
        <button type="button" class="cal__icon pms-project-button pms-project-button--secondary pms-project-button--small pms-project-button--icon" :aria-label="$t('schedule.nextMonth')" @click="shift(1)">
          <RightOutlined />
        </button>
      </div>
      <button type="button" class="cal__today pms-project-button pms-project-button--secondary pms-project-button--small" @click="goToday">{{ $t('schedule.today') }}</button>
    </div>

    <div class="cal__weekdays">
      <span v-for="index in 7" :key="index">{{ $t(`schedule.weekdayMon.${index - 1}`) }}</span>
    </div>

    <div class="cal__month">
      <div v-for="(week, weekIndex) in weeks" :key="weekIndex" class="cal-week">
        <div class="cal-week__ranges">
          <button
            v-for="bar in week.rangeBars"
            :key="bar.id"
            type="button"
            class="cal-range"
            :class="[`cal-range--${bar.tone}`, { 'cal-range--selected': bar.nodeId === selectedNodeId }]"
            :style="{ gridColumn: `${bar.startCol + 1} / span ${bar.span}` }"
            @click="onRange(bar)"
          >
            {{ bar.title }}
          </button>
        </div>
        <div class="cal-week__days">
          <div
            v-for="day in week.days"
            :key="day.date"
            class="cal-day"
            :class="{
              'cal-day--out': !day.inMonth,
              'cal-day--today': day.isToday,
              'cal-day--weekend': day.isWeekend,
            }"
          >
            <span class="cal-day__num">{{ Number(day.date.slice(-2)) }}</span>
            <div class="cal-day__events">
              <button
                v-for="event in day.events.slice(0, 3)"
                :key="event.id"
                type="button"
                class="cal-chip"
                :class="`cal-chip--${event.kind}`"
                @click="onDayEvent(event)"
              >
                {{ event.title }}
              </button>
              <span v-if="day.events.length > 3" class="cal-more">+{{ day.events.length - 3 }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cal { display: grid; gap: 12px; }
.cal__toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.cal__nav { display: flex; align-items: center; gap: 10px; }
.cal__nav strong { min-width: 128px; color: var(--pms-text); font-size: var(--pms-font-size-section); font-weight: 720; text-align: center; }
.cal__icon,
.cal__today {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  color: #5d6d85;
  background: #fff;
  border: 1px solid #d7dfeb;
  border-radius: 8px;
  transition: color 160ms ease, background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  cursor: pointer;
}
.cal__icon { width: 32px; }
.cal__today { padding: 0 12px; font-size: var(--pms-font-size-compact); font-weight: 680; }
.cal__icon:hover,
.cal__today:hover { color: #1769e0; background: #eaf2ff; border-color: #b9d2f7; }
.cal__weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
  color: var(--pms-text-faint);
  font-size: var(--pms-font-size-caption);
  font-weight: 680;
  text-align: center;
}
.cal__month {
  display: grid;
  gap: 6px;
  padding: 10px;
  background: linear-gradient(180deg, #fbfcfe, #fff);
  border: 1px solid var(--pms-border);
  border-radius: 10px;
  box-shadow: var(--pms-shadow-sm);
}
.cal-week { display: grid; gap: 4px; }
.cal-week__ranges {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
  min-height: 18px;
}
.cal-range {
  overflow: hidden;
  min-height: 18px;
  padding: 0 8px;
  color: #fff;
  border: 0;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 720;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.cal-range--project { background: linear-gradient(90deg, var(--pms-primary-dark), var(--pms-primary)); }
.cal-range--active { background: var(--pms-status-active); }
.cal-range--completed { background: var(--pms-success); }
.cal-range--locked { background: var(--pms-status-neutral); }
.cal-range--terminated { background: var(--pms-danger); }
.cal-range--selected { box-shadow: 0 0 0 2px var(--pms-primary-soft); }
.cal-week__days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
.cal-day {
  min-height: 92px;
  padding: 8px 8px 6px;
  background: #fff;
  border: 1px solid var(--pms-border);
  border-radius: 8px;
}
.cal-day--weekend { background: var(--pms-surface-muted); }
.cal-day--out { opacity: 0.42; }
.cal-day--today { border-color: color-mix(in srgb, var(--pms-primary) 40%, var(--pms-border)); box-shadow: inset 0 0 0 1px var(--pms-primary-soft); }
.cal-day__num { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; color: var(--pms-text); font-size: var(--pms-font-size-compact); font-weight: 720; }
.cal-day--today .cal-day__num { color: #fff; background: var(--pms-primary); border-radius: 999px; }
.cal-day__events { display: grid; gap: 4px; margin-top: 6px; }
.cal-chip {
  overflow: hidden;
  padding: 2px 6px;
  border: 0;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 680;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.cal-chip--iteration-plan { color: var(--pms-warning); background: var(--pms-warning-soft); }
.cal-chip--task { color: var(--pms-primary); background: var(--pms-primary-soft); }
.cal-more { color: var(--pms-text-faint); font-size: 10px; }
@media (max-width: 720px) {
  .cal-day { min-height: 72px; padding: 6px; }
  .cal-chip { display: none; }
}
</style>
