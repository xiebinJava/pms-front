export interface StoryTestingIssue { id: string; name: string; type: string; level: string; description: string; expectedResult: string; owner: number | string | null; [key: string]: unknown }
export interface StoryTestingState {
  buildVersion: string
  testStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'PASSED' | 'FAILED'
  reportUrl: string
  residualIssues: StoryTestingIssue[]
}
export function isStoryTestingEnabled(config: unknown): boolean
export const DEFECT_TYPES: ['RND', 'UI', 'PRODUCT']
export const DEFECT_LEVELS: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
export function normalizeStoryTesting(values: unknown): StoryTestingState
export function mergeStoryTesting(values: unknown, state: StoryTestingState): Record<string, unknown>
