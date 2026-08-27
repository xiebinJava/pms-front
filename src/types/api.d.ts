export interface ApiResult<T = unknown> {
  code: number
  msg: string
  data: T
}

export interface PageResult<T = unknown> {
  total: number
  currPage: number
  pageSize: number
  totalPage: number
  list: T[]
}

export interface ImportRowError {
  row: number
  field: string
  message: string
}

export interface ImportPreview {
  jobId: string
  importType: string
  filename: string
  rowCount: number
  rows: Record<string, string>[]
  errors: ImportRowError[]
}
