import dayjs from 'dayjs'

export function formatDate(value?: string | null, pattern = 'YYYY-MM-DD'): string {
  return value ? dayjs(value).format(pattern) : '—'
}

export function formatDateTime(value?: string | null): string {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '—'
}
