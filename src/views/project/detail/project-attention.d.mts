export interface ProjectAttentionRouteItem {
  projectId: number
  nodeId?: number
  taskId?: number
}

export interface ProjectActionItemLike {
  type?: string
  severity?: string
}

export function buildAttentionRoute(item: ProjectAttentionRouteItem): {
  path: string
  query?: Record<string, string>
}
export function attentionTone(severity?: string): 'critical' | 'warning' | 'info'
export function isCurrentNodeAction(item: ProjectActionItemLike): boolean
export function groupAttentionItems(items?: ProjectActionItemLike[]): Record<string, ProjectActionItemLike[]>
