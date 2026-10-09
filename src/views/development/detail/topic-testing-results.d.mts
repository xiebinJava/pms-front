export interface TopicTestingIssue { id: string; name: string; type: string; level: string; description: string; expectedResult: string; owner: number | string | null; [key: string]: unknown }
export interface TopicTestingState {
  buildVersion: string
  testStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'PASSED' | 'FAILED'
  reportUrl: string
  residualIssues: TopicTestingIssue[]
}
export const DEFECT_TYPES: ['RND', 'UI', 'PRODUCT']
export const DEFECT_LEVELS: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
export function isTestingResultsEnabled(config: unknown): boolean
export function configureTopicTesting(node: WorkflowNodeDefinitionV2, enabled: boolean): WorkflowNodeDefinitionV2
export function normalizeTopicTesting(values: unknown): TopicTestingState
export function mergeTopicTesting(values: unknown, state: TopicTestingState): Record<string, unknown>
export function summarizeStoryTesting(stories: unknown): { total: number; passed: number; failed: number; testing: number; notStarted: number; unknown: number }
import type { WorkflowNodeDefinitionV2 } from '../../../types/workflow'
