export interface User {
  id: number
  username: string
  nickname: string
  email?: string
  avatar?: string
}

export interface Project {
  id: number
  code: string
  name: string
  description?: string
  status: number
  priority: number
  ownerId: number
  ownerName?: string
  startDate?: string
  endDate?: string
  progress: number
  taskCount: number
  doneTaskCount: number
  memberCount: number
  createdAt: string
  updatedAt: string
}

export interface ProjectMember {
  id: number
  projectId: number
  userId: number
  username?: string
  nickname?: string
  avatar?: string
  role: number
  createdAt: string
}

export interface Task {
  id: number
  projectId: number
  parentId?: number
  title: string
  description?: string
  status: number
  priority: number
  assigneeId?: number
  assigneeName?: string
  milestoneId?: number
  sort: number
  dueDate?: string
  createdAt: string
  updatedAt: string
}

export interface Milestone {
  id: number
  projectId: number
  title: string
  description?: string
  dueDate?: string
  status: number
  taskCount: number
  doneTaskCount: number
  createdAt: string
}

export interface Comment {
  id: number
  projectId: number
  taskId?: number
  content: string
  userId: number
  userNickname?: string
  createdAt: string
}
