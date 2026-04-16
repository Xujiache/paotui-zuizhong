/**
 * HTTP 请求封装模块
 *
 * 对齐后端 PRD《接口规范与状态机》§1.1：
 * - 成功：{ code: 0, message, data }
 * - 错误：{ code: <业务码>, message, data: null, errors? }
 * - 认证头：Authorization: Bearer <accessToken>
 *
 * @module utils/http
 */

import axios, { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { useUserStore } from '@/store/modules/user'
import { ApiStatus } from './status'
import { HttpError, handleError, isAuthExpired, showError, showSuccess } from './error'
import { $t } from '@/locales'
import type { BaseResponse } from '@/types/common/response'

/** 请求配置常量 */
const REQUEST_TIMEOUT = 15000
const LOGOUT_DELAY = 500
const MAX_RETRIES = 0
const RETRY_DELAY = 1000
const UNAUTHORIZED_DEBOUNCE_TIME = 3000

/** 401防抖状态 */
let isUnauthorizedErrorShown = false
let unauthorizedTimer: NodeJS.Timeout | null = null

/** 扩展 AxiosRequestConfig */
interface ExtendedAxiosRequestConfig extends AxiosRequestConfig {
  showErrorMessage?: boolean
  showSuccessMessage?: boolean
}

const { VITE_API_URL, VITE_WITH_CREDENTIALS } = import.meta.env

/** Axios实例 */
const axiosInstance = axios.create({
  timeout: REQUEST_TIMEOUT,
  baseURL: VITE_API_URL,
  withCredentials: VITE_WITH_CREDENTIALS === 'true',
  validateStatus: (status) => status >= 200 && status < 300,
  transformResponse: [
    (data, headers) => {
      const contentType = headers['content-type']
      if (contentType?.includes('application/json')) {
        try {
          return JSON.parse(data)
        } catch {
          return data
        }
      }
      return data
    }
  ]
})

/** 请求拦截器：注入 Bearer Token 和通用头 */
axiosInstance.interceptors.request.use(
  (request: InternalAxiosRequestConfig) => {
    const { accessToken } = useUserStore()
    if (accessToken) {
      const value = accessToken.startsWith('Bearer ') ? accessToken : `Bearer ${accessToken}`
      request.headers.set('Authorization', value)
    }

    if (!request.headers.has('X-Client-Type')) {
      request.headers.set('X-Client-Type', 'admin-web')
    }

    if (request.data && !(request.data instanceof FormData) && !request.headers['Content-Type']) {
      request.headers.set('Content-Type', 'application/json')
      request.data = JSON.stringify(request.data)
    }

    return request
  },
  (error) => {
    showError(createHttpError($t('httpMsg.requestConfigError'), ApiStatus.operationFailed))
    return Promise.reject(error)
  }
)

/** 响应拦截器：按后端业务契约判成功/失败 */
axiosInstance.interceptors.response.use(
  (response: AxiosResponse<BaseResponse>) => {
    const body = response.data
    if (!body || typeof body !== 'object') {
      throw createHttpError($t('httpMsg.requestFailed'), ApiStatus.operationFailed)
    }
    const { code, message, errors } = body

    if (code === ApiStatus.success) return response
    if (isAuthExpired(code)) handleUnauthorizedError(message)
    throw createHttpError(message || $t('httpMsg.requestFailed'), code, errors)
  },
  (error) => {
    const status = error.response?.status
    const code = error.response?.data?.code as number | undefined
    if (status === 401 || (typeof code === 'number' && isAuthExpired(code))) {
      handleUnauthorizedError()
    }
    return Promise.reject(handleError(error))
  }
)

/** 统一创建HttpError */
function createHttpError(message: string, code: number, errors?: BaseResponse['errors']) {
  return new HttpError(message, code, { errors })
}

/** 处理未登录/Token 过期错误（带防抖） */
function handleUnauthorizedError(message?: string): never {
  const error = createHttpError(message || $t('httpMsg.unauthorized'), ApiStatus.notLoggedIn)

  if (!isUnauthorizedErrorShown) {
    isUnauthorizedErrorShown = true
    logOut()
    unauthorizedTimer = setTimeout(resetUnauthorizedError, UNAUTHORIZED_DEBOUNCE_TIME)
    showError(error, true)
    throw error
  }

  throw error
}

/** 重置401防抖状态 */
function resetUnauthorizedError() {
  isUnauthorizedErrorShown = false
  if (unauthorizedTimer) clearTimeout(unauthorizedTimer)
  unauthorizedTimer = null
}

/** 退出登录函数 */
function logOut() {
  setTimeout(() => {
    useUserStore().logOut()
  }, LOGOUT_DELAY)
}

/** 是否需要重试（仅服务器/网关类错误） */
function shouldRetry(code: number) {
  return code === ApiStatus.serverError
}

/** 请求重试逻辑 */
async function retryRequest<T>(
  config: ExtendedAxiosRequestConfig,
  retries: number = MAX_RETRIES
): Promise<T> {
  try {
    return await request<T>(config)
  } catch (error) {
    if (retries > 0 && error instanceof HttpError && shouldRetry(error.code)) {
      await delay(RETRY_DELAY)
      return retryRequest<T>(config, retries - 1)
    }
    throw error
  }
}

/** 延迟函数 */
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 请求函数 */
async function request<T = any>(config: ExtendedAxiosRequestConfig): Promise<T> {
  // POST | PUT 参数自动填充
  if (
    ['POST', 'PUT'].includes(config.method?.toUpperCase() || '') &&
    config.params &&
    !config.data
  ) {
    config.data = config.params
    config.params = undefined
  }

  try {
    const res = await axiosInstance.request<BaseResponse<T>>(config)

    if (config.showSuccessMessage && res.data.message) {
      showSuccess(res.data.message)
    }

    return res.data.data as T
  } catch (error) {
    if (error instanceof HttpError && !isAuthExpired(error.code)) {
      const showMsg = config.showErrorMessage !== false
      showError(error, showMsg)
    }
    return Promise.reject(error)
  }
}

/** API方法集合 */
const api = {
  get<T>(config: ExtendedAxiosRequestConfig) {
    return retryRequest<T>({ ...config, method: 'GET' })
  },
  post<T>(config: ExtendedAxiosRequestConfig) {
    return retryRequest<T>({ ...config, method: 'POST' })
  },
  put<T>(config: ExtendedAxiosRequestConfig) {
    return retryRequest<T>({ ...config, method: 'PUT' })
  },
  del<T>(config: ExtendedAxiosRequestConfig) {
    return retryRequest<T>({ ...config, method: 'DELETE' })
  },
  request<T>(config: ExtendedAxiosRequestConfig) {
    return retryRequest<T>(config)
  }
}

export default api
