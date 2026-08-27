import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import { message } from 'ant-design-vue'
import type { ApiResult } from '/@/types/api'

let accessToken = ''
let refreshPromise: Promise<string> | null = null

const instance = axios.create({
  baseURL: '/api',
  timeout: 15000,
  withCredentials: true,
})

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean; _skipAuthRefresh?: boolean }

instance.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

instance.interceptors.response.use(
  (response) => {
    const res = response.data as ApiResult
    if (res.code !== 200) {
      message.error(res.msg || '请求失败')
      return Promise.reject(new Error(res.msg))
    }
    return res.data as any
  },
  async (error) => {
    const config = error.config as RetryConfig | undefined
    const isAuthEndpoint = typeof config?.url === 'string' && ['/auth/login', '/auth/refresh', '/auth/activate'].some((path) => config.url?.includes(path))
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
          message.error('登录会话已失效，请重新登录')
          window.location.href = '/login'
        }
      }
    } else if (error.response?.status !== 401 && !isAuthEndpoint) {
      message.error(error.response?.data?.msg || '网络异常，请稍后重试')
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
}

export function setAccessToken(token: string) { accessToken = token }
export function getAccessToken() { return accessToken }
export function clearAccessToken() { accessToken = '' }
