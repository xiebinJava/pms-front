import { http } from '/@/plugins/http'
import type { WorkbenchActionCenter, WorkbenchActivity, WorkbenchSummary, WorkbenchTask } from '/@/views/workbench/workbench'
import type { Project } from '/@/types/domain'

export interface WorkbenchPayload {
  summary: WorkbenchSummary
  tasks: WorkbenchTask[]
  projects: Project[]
  activities: WorkbenchActivity[]
  actionCenter?: WorkbenchActionCenter
}

export function getWorkbench(): Promise<WorkbenchPayload> {
  return http.get('/workbench')
}
