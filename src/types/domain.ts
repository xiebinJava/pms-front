export interface User {
  id: number
  username?: string
  nameZh?: string
  displayName?: string
  nickname?: string
  email?: string
  phone?: string
  avatar?: string
  systemRole?: number
  status?: string
  permissionCodes?: string[]
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
  createdBy?: number
  createdByName?: string
  createdByAvatar?: string
  projectManagerId?: number
  projectManagerName?: string
  projectManagerAvatar?: string
  startDate?: string
  endDate?: string
  progress: number
  taskCount: number
  doneTaskCount: number
  memberCount: number
  orgUnitId?: number
  orgUnitName?: string
  orgUnitPath?: string
  orgUnitLeaderName?: string
  createdAt: string
  updatedAt: string
  permissions?: ProjectPermissions
}

export interface ProjectPermissions {
  canManageProject: boolean
  canManageMembers: boolean
  canSetProjectManager: boolean
  canAssignNodeOwner: boolean
  canTerminateProject: boolean
  canRestoreProject: boolean
  canDeleteProject: boolean
}

export interface NodePermissions {
  canEdit: boolean
  canManageTasks: boolean
  canComplete: boolean
  canRollback: boolean
  readOnly: boolean
}

export interface TaskPermissions {
  canEdit: boolean
  canMove: boolean
  canDelete: boolean
  readOnly: boolean
}

export interface ProjectMember {
  id: number
  projectId: number
  userId: number
  username?: string
  email?: string
  nickname?: string
  displayName?: string
  avatar?: string
  role: number
  createdAt: string
}

export interface OrgUnit {
  id: number
  parentId?: number
  code: string
  name: string
  leaderUserId?: number
  typeCode?: string
  status: string
  leaderDisplayName?: string
  memberCount?: number
  children?: OrgUnit[]
}

export interface Personnel {
  id: number
  username?: string
  nameZh?: string
  displayName?: string
  email?: string
  phone?: string
  status: string
  primaryOrgName?: string
  primaryOrgUnitId?: number
  primaryPositionName?: string
  partTimePositionIds: number[]
  partTimeOrgUnitIds: number[]
  roles: string[]
  partTimeOrgNames: string[]
}

export interface Role {
  id: number
  code: string
  name: string
  builtin: boolean
  dataScopeType: string
  enabled: boolean
  permissionCodes: string[]
  customOrgUnitIds: number[]
}

export interface Task {
  id: number
  projectId: number
  nodeId?: number
  parentId?: number
  title: string
  description?: string
  deliverable?: string
  status: number
  priority: number
  assigneeId?: number
  assigneeName?: string
  milestoneId?: number
  sort: number
  dueDate?: string
  createdAt: string
  updatedAt: string
  subtaskCount?: number
  permissions?: TaskPermissions
}

export interface TaskAttachment {
  id: number
  taskId: number
  projectId: number
  originalName: string
  contentType?: string
  sizeBytes: number
  url: string
  createdBy?: number
  createdByName?: string
  createdAt: string
}

export interface TaskDetail extends Task {
  subtasks: Task[]
  comments: Comment[]
  attachments: TaskAttachment[]
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

export interface ProjectNode {
  id: number
  projectId: number
  nodeKey: string
  name: string
  description?: string
  deliverable?: string
  roles?: string
  ownerId?: number
  ownerName?: string
  ownerAvatar?: string
  status: number
  sort: number
  startDate?: string
  endDate?: string
  createdAt: string
  permissions?: NodePermissions
}

export type NotificationType = 'TASK_ASSIGNED' | 'TASK_COMMENTED' | 'PROJECT_COMMENTED'

export interface UserNotification {
  id: number
  type: NotificationType
  title: string
  content?: string
  projectId?: number
  taskId?: number
  actorId?: number
  actorName?: string
  readAt?: string | null
  createdAt: string
}

export interface SearchHit {
  id: number
  projectId: number
  projectName?: string
  title: string
  snippet?: string
  taskId?: number
}

export interface SearchResult {
  projects: SearchHit[]
  tasks: SearchHit[]
  comments: SearchHit[]
}
