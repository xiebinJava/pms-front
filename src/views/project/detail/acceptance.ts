import type { NodeAcceptanceItem, NodeAcceptanceResult } from '/@/types/domain'

export interface AcceptanceCompletionInput {
  result?: NodeAcceptanceResult
  residualItems?: string
  items: Array<Pick<NodeAcceptanceItem, 'result'>>
}

export function isAcceptanceComplete(input: AcceptanceCompletionInput): boolean {
  if (!input.items.length || input.items.some((item) => item.result !== 'PASS')) return false
  if (input.result === 'PASS') return true
  return input.result === 'CONDITIONAL_PASS' && Boolean(input.residualItems?.trim())
}
