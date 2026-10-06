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
export const STORY_WORKBENCH_FIELDS: Readonly<Record<StoryWorkbenchVariant, ReadonlyArray<{ key: string; type: 'text' | 'textarea' | 'date' | 'select' }>>>
export function normalizeStoryWorkbenchState(values: unknown, variant: StoryWorkbenchVariant): Record<string, string>
export function mergeStoryWorkbenchState(values: unknown, variant: StoryWorkbenchVariant, state: Record<string, string>): Record<string, unknown>
export const STORY_WORKBENCH_PALETTE: readonly StoryWorkbenchPaletteEntry[]
export interface StoryWritingIdentity { title?: string; topicId?: number | null; topicTitle?: string }
export function normalizeStoryWritingState(values: unknown, story?: StoryWritingIdentity): Record<string, string>
export function mergeStoryWritingState(values: unknown, state: Record<string, string>, story?: StoryWritingIdentity): Record<string, unknown>
export function reconcileStoryWritingIdentity(draft: Record<string, string>, baseline: StoryWritingIdentity, story?: StoryWritingIdentity): void
export function rebaseStoryWritingAcknowledgement(values: unknown, sentValues: unknown, story?: StoryWritingIdentity): Record<string, unknown>
export interface StoryIterationIdentity { iterationPlanId?: number | null }
export interface StoryIterationState { iterationPlanId: string; developerIds: number[]; testerIds: number[] }
export function normalizeStoryIterationState(values: unknown, story?: StoryIterationIdentity): StoryIterationState
export function mergeStoryIterationState(values: unknown, state: StoryIterationState, story?: StoryIterationIdentity): Record<string, unknown>
export function reconcileStoryIterationIdentity(draft: StoryIterationState, baseline: StoryIterationIdentity, story?: StoryIterationIdentity): void
export interface StoryTestCase { id: string; name: string; priority: string; expectedResult: string }
export interface StoryDevelopmentState { testCases: StoryTestCase[]; mergeStatus: string; deployEnv: string }
export function normalizeStoryDevelopmentState(values: unknown): StoryDevelopmentState
export function mergeStoryDevelopmentState(values: unknown, state: StoryDevelopmentState): Record<string, unknown>
export function getStoryDevelopmentPeople(nodes?: Array<{ componentConfigs?: Record<string, Record<string, unknown>>; fieldValues?: unknown }>): { developerIds: number[]; testerIds: number[] }
