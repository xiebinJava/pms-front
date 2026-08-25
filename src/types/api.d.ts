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
