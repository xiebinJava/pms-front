export interface TopicTestingIssue { id: string; description: string; [key: string]: unknown }
export interface TopicTestingState {
  buildVersion: string
  testStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'PASSED' | 'FAILED'
  reportUrl: string
  residualIssues: TopicTestingIssue[]
}
export function isTestingResultsEnabled(config: unknown): boolean
export function configureTopicTesting(node: WorkflowNodeDefinitionV2, enabled: boolean): WorkflowNodeDefinitionV2
export function normalizeTopicTesting(values: unknown): TopicTestingState
export function mergeTopicTesting(values: unknown, state: TopicTestingState): Record<string, unknown>
export function summarizeStoryTesting(stories: unknown): { total: number; passed: number; failed: number; testing: number; notStarted: number; unknown: number }
import type { WorkflowNodeDefinitionV2 } from '../../../types/workflow'
