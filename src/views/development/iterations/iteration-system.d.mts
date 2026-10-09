export function applyIterationSystem(form: { systemId?: number | null; systemVersionId?: number | null }, systemId?: number): void
export function selectableIterationVersions<T extends { systemId: number; status: string }>(versions: T[], systemId?: number | null): T[]
export function loadAllOptionPages<T>(fetchPage: (page: number) => Promise<{ list: T[]; total: number }>): Promise<T[]>
