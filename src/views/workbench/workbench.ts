import type { Project, ProjectActionItem, Task } from '/@/types/domain'

export interface WorkbenchTask extends Task {
  projectName: string
  projectCode: string
}

export interface WorkbenchActivity {
  id: number
  projectId: number
  projectName: string
  actorName: string
  content: string
  createdAt: string
}

export interface WorkbenchSummary {
  pendingTaskCount: number
  inProgressTaskCount: number
  dueSoonTaskCount: number
  overdueTaskCount: number
  participatingProjectCount: number
}

export interface WorkbenchActionCenter {
  totalCount: number
  criticalCount: number
  warningCount: number
  items: ProjectActionItem[]
}

const DONE_STATUS = 2
const IN_PROGRESS_STATUS = 1
const PENDING_STATUS = 0
const DUE_SOON_DAYS = 7
const SHANGHAI_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function projectMap(projects: Project[]) {
  return new Map(projects.map((project) => [project.id, project]))
}

function dateKey(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : undefined
}

function shanghaiDateKey(now: Date) {
  const parts = SHANGHAI_DATE_FORMATTER.formatToParts(now)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return `${year}-${month}-${day}`
}

function addDays(dateKeyValue: string, days: number) {
  const date = new Date(`${dateKeyValue}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function selectMyTasks(tasks: Task[], projects: Project[], userId?: number): WorkbenchTask[] {
  const projectsById = projectMap(projects)
  return tasks
    .filter((task) => userId != null && task.assigneeId === userId)
    .map((task) => {
      const project = projectsById.get(task.projectId)
      return {
        ...task,
        projectName: project?.name || '未命名项目',
        projectCode: project?.code || '',
      }
    })
}

export function selectMyProjects(projects: Project[], tasks: Task[], userId?: number): Project[] {
  if (userId == null) return []
  const assignedProjectIds = new Set(
    tasks.filter((task) => task.assigneeId === userId).map((task) => task.projectId),
  )
  return projects.filter((project) => (
    project.ownerId === userId
    || project.projectManagerId === userId
    || assignedProjectIds.has(project.id)
  ))
}

export function buildWorkbenchSummary(
  projects: Project[],
  tasks: Task[],
  userId: number | undefined,
  now = new Date(),
): WorkbenchSummary {
  const myTasks = tasks.filter((task) => userId != null && task.assigneeId === userId)
  const today = shanghaiDateKey(now)
  const dueLimit = addDays(today, DUE_SOON_DAYS)
  const dueSoonTaskCount = myTasks.filter((task) => {
    if (task.status === DONE_STATUS || !task.dueDate) return false
    const dueDate = dateKey(task.dueDate)
    return dueDate != null && dueDate >= today && dueDate <= dueLimit
  }).length
  const overdueTaskCount = myTasks.filter((task) => {
    if (task.status === DONE_STATUS || !task.dueDate) return false
    const dueDate = dateKey(task.dueDate)
    return dueDate != null && dueDate < today
  }).length

  return {
    pendingTaskCount: myTasks.filter((task) => task.status === PENDING_STATUS).length,
    inProgressTaskCount: myTasks.filter((task) => task.status === IN_PROGRESS_STATUS).length,
    dueSoonTaskCount,
    overdueTaskCount,
    participatingProjectCount: selectMyProjects(projects, tasks, userId).length,
  }
}

export function sortWorkbenchTasks(tasks: WorkbenchTask[]): WorkbenchTask[] {
  return [...tasks].sort((left, right) => {
    if (left.status !== right.status) return left.status - right.status
    const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.POSITIVE_INFINITY
    const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.POSITIVE_INFINITY
    if (leftDue !== rightDue) return leftDue - rightDue
    if (left.priority !== right.priority) return right.priority - left.priority
    return left.title.localeCompare(right.title, 'zh-CN')
  })
}

export function selectRecentActivities<T extends { createdAt: string }>(activities: T[], limit = 5): T[] {
  return [...activities]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, Math.max(0, limit))
}
