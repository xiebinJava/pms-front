import type { WorkflowWorkbenchType } from './workflow-component-registry'

export const STORY_NODE_WORKBENCH_COMPONENT: 'story-node-workbench'
export const STORY_TESTING_COMPONENT: 'story-testing'

export type StoryWorkbenchVariant =
  | 'writing' | 'iteration' | 'development' | 'acceptance' | 'release' | 'launch'

export interface StoryNodeWorkbenchConfig {
  [key: string]: unknown
  nodeKey: string
  nodeName: string
  variant: StoryWorkbenchVariant
  purpose: string
  activities: string[]
}

export interface StoryWorkbenchPaletteEntry {
  key: string
  runtimeKey: string
  processTypeCodes: readonly string[]
  workbenchTypes: readonly WorkflowWorkbenchType[]
  nodeNameIncludes: readonly string[]
}

export function getStoryWorkbenchVariant(node?: { name?: string; nodeName?: string } | null): StoryWorkbenchVariant | null
export function getStoryNodeWorkbenchBlueprint(node?: { name?: string; nodeName?: string } | null): {
  variant: StoryWorkbenchVariant
  purpose: string
  activities: string[]
} | null
export function createStoryNodeWorkbenchConfig(node?: { key?: string; nodeKey?: string; name?: string; nodeName?: string } | null): StoryNodeWorkbenchConfig | null
export const STORY_WORKBENCH_FIELDS: Readonly<Record<StoryWorkbenchVariant, ReadonlyArray<{ key: string; type: 'text' | 'textarea' | 'date' }>>>
export function normalizeStoryWorkbenchState(values: unknown, variant: StoryWorkbenchVariant): Record<string, string>
export function mergeStoryWorkbenchState(values: unknown, variant: StoryWorkbenchVariant, state: Record<string, string>): Record<string, unknown>
export const STORY_WORKBENCH_PALETTE: readonly StoryWorkbenchPaletteEntry[]
