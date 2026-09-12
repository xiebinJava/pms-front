import type { WorkflowFieldDefinition, WorkflowProjectFieldDefinition } from '../../../types/workflow'

export const legacyWorkflowComponents: Readonly<Record<string, readonly string[]>>
export const defaultProjectFields: readonly WorkflowProjectFieldDefinition[]
export function nodeHasComponent(node: { nodeKey?: string; components?: string[] } | null | undefined, componentKey: string): boolean
export function shouldRefreshRequirements(node: { nodeKey?: string; components?: string[] } | null | undefined): boolean
export function removeWorkflowAttachmentState(
  values: Record<string, unknown>,
  attachments: Record<string, import('../../../types/workflow').WorkflowFieldAttachment[]>,
  fieldKey: string,
  attachmentId: number,
): {
  values: Record<string, unknown>
  attachments: Record<string, import('../../../types/workflow').WorkflowFieldAttachment[]>
}
export function transitionActiveNode<T>(
  currentNodeId: T | null | undefined,
  nextNodeId: T,
  savePendingChanges: () => Promise<boolean | void> | boolean | void,
  selectNode: (nodeId: T) => void,
): Promise<boolean>
export function visibleProjectFields(fields?: WorkflowProjectFieldDefinition[] | null): WorkflowProjectFieldDefinition[]
export function nodeWorkflowFields(node: {
  components?: string[]
  contentOrder?: string[]
  fields?: WorkflowFieldDefinition[]
  projectBasicInfo?: boolean
  projectBasicInfoFields?: WorkflowProjectFieldDefinition[]
} | null | undefined): WorkflowFieldDefinition[]
export function nodeWorkflowContentOrder(node: {
  nodeKey?: string
  components?: string[]
  contentOrder?: string[]
  fields?: WorkflowFieldDefinition[]
  projectBasicInfo?: boolean
  projectBasicInfoFields?: WorkflowProjectFieldDefinition[]
} | null | undefined): string[]
export function missingConfiguredProjectFields(
  fields: Array<WorkflowProjectFieldDefinition | WorkflowFieldDefinition> | null | undefined,
  profile: {
    description?: string
    priority?: number | null
    projectLevel?: number | null
    schedule?: string[]
    orgUnitId?: number | null
    projectManagerId?: number | null
    memberIds?: number[]
    followerIds?: number[]
  },
): string[]
export function emptyWorkflowFieldValue(type: string): unknown
export function isWorkflowFieldEmpty(value: unknown): boolean
