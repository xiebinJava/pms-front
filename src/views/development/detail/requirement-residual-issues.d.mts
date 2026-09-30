export interface ResidualIssue { id: string; description: string }
export function normalizeResidualIssues(value: unknown): ResidualIssue[]
