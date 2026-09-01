import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import { message } from 'ant-design-vue'
import type { ApiResult } from '/@/types/api'
import { t } from '/@/i18n'

let accessToken = ''
let refreshPromise: Promise<string> | null = null

const instance = axios.create({
  baseURL: '/api',
  timeout: 15000,
  withCredentials: true,
})

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean; _skipAuthRefresh?: boolean; _raw?: boolean; _silentError?: boolean }

instance.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

instance.interceptors.response.use(
  (response) => {
    if ((response.config as RetryConfig)._raw) return response.data as any
    const res = response.data as ApiResult
    if (res.code !== 200) {
      const businessError = new Error(res.msg || t('http.requestFailed')) as Error & { _businessHandled?: boolean }
      businessError._businessHandled = true
      message.error(businessError.message)
      return Promise.reject(businessError)
    }
    return res.data as any
  },
  async (error) => {
    const config = error.config as RetryConfig | undefined
    const isAuthEndpoint = typeof config?.url === 'string'
      && ['/auth/login', '/auth/refresh', '/auth/activate', '/auth/password-reset/'].some((path) => config.url?.includes(path))
    if (error.response?.status === 401 && config && !config._retry && !config._skipAuthRefresh && !isAuthEndpoint) {
      config._retry = true
      try {
        if (!refreshPromise) {
          refreshPromise = instance.post('/auth/refresh', undefined, { _skipAuthRefresh: true } as AxiosRequestConfig)
            .then((data: any) => {
              const token = data?.accessToken || data?.token || ''
              if (!token) throw new Error('refresh token missing')
              accessToken = token
              return token
            })
            .finally(() => { refreshPromise = null })
        }
        await refreshPromise
        return instance.request(config)
      } catch {
        accessToken = ''
        if (window.location.pathname !== '/login') {
          message.error(t('http.sessionExpired'))
          const redirect = `${window.location.pathname}${window.location.search}`
          window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`
        }
      }
    } else if (!isAuthEndpoint && !(config?._silentError) && !(error as { _businessHandled?: boolean })._businessHandled) {
      const backendMessage = error.response?.data?.msg
      message.error(backendMessage || error.message || t('http.networkError'))
    }
    return Promise.reject(error)
  },
)

function request<T>(config: AxiosRequestConfig): Promise<T> {
  return instance.request<unknown, T>(config)
}

export const http = {
  get: <T>(url: string, config?: AxiosRequestConfig) => request<T>({ ...config, method: 'GET', url }),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => request<T>({ ...config, method: 'POST', url, data }),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => request<T>({ ...config, method: 'PUT', url, data }),
  delete: <T>(url: string, config?: AxiosRequestConfig) => request<T>({ ...config, method: 'DELETE', url }),
  getBlob: (url: string) => request<Blob>({ method: 'GET', url, responseType: 'blob', _raw: true } as AxiosRequestConfig & { _raw: boolean }),
}

export function setAccessToken(token: string) { accessToken = token }
export function getAccessToken() { return accessToken }
export function clearAccessToken() { accessToken = '' }
