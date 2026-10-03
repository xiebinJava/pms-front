export interface StoryTestingIssue { id: string; description: string; [key: string]: unknown }
export interface StoryTestingState {
  buildVersion: string
  testStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'PASSED' | 'FAILED'
  reportUrl: string
  residualIssues: StoryTestingIssue[]
}
export function isStoryTestingEnabled(config: unknown): boolean
export function normalizeStoryTesting(values: unknown): StoryTestingState
export function mergeStoryTesting(values: unknown, state: StoryTestingState): Record<string, unknown>
