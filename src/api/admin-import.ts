import { http } from '/@/plugins/http'
import type { ImportPreview } from '/@/types/api'

export function previewImport(type: 'organizations' | 'users', file: File): Promise<ImportPreview> {
  const form = new FormData()
  form.append('file', file)
  return http.post(`/admin/import/preview/${type}`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export function commitImport(jobId: string) { return http.post(`/admin/import/${jobId}/commit`) }
export function downloadImportTemplate(type: 'organizations' | 'users'): Promise<Blob> {
  return http.getBlob(`/admin/import/template/${type}.csv`)
}
