import type { Comment, Project, Task } from '/@/types/domain'

export interface WorkbenchTask extends Task {
  projectName: string
  projectCode: string
}

export interface WorkbenchActivity extends Comment {
  projectName: string
  actorName: string
}

export interface WorkbenchSummary {
  pendingTaskCount: number
  inProgressTaskCount: number
  dueSoonTaskCount: number
  participatingProjectCount: number
}

const DONE_STATUS = 2
const IN_PROGRESS_STATUS = 1
const PENDING_STATUS = 0
const DAY_MS = 24 * 60 * 60 * 1000

function projectMap(projects: Project[]) {
  return new Map(projects.map((project) => [project.id, project]))
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
  const nowTime = now.getTime()
  const dueLimit = nowTime + 7 * DAY_MS
  const dueSoonTaskCount = myTasks.filter((task) => {
    if (task.status === DONE_STATUS || !task.dueDate) return false
    const dueTime = new Date(task.dueDate).getTime()
    return Number.isFinite(dueTime) && dueTime >= nowTime && dueTime <= dueLimit
  }).length

  return {
    pendingTaskCount: myTasks.filter((task) => task.status === PENDING_STATUS).length,
    inProgressTaskCount: myTasks.filter((task) => task.status === IN_PROGRESS_STATUS).length,
    dueSoonTaskCount,
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
