/**
 * HTTP 错误处理模块
 *
 * 约定：HttpError.code 存业务码（与后端 PRD 错误码表对齐），
 * 传输层的 HTTP 状态码通过 HttpStatus 处理并转成对应业务码。
 *
 * @module utils/http/error
 */
import { AxiosError } from 'axios'
import { ApiStatus, HttpStatus } from './status'
import { $t } from '@/locales'
import type { BaseResponse, FieldError } from '@/types/common/response'

// 错误日志数据接口
export interface ErrorLogData {
  /** 业务错误码 */
  code: number
  /** 错误消息 */
  message: string
  /** 错误附加数据 */
  data?: unknown
  /** 字段级校验错误 */
  errors?: FieldError[]
  /** 错误发生时间戳 */
  timestamp: string
  /** 请求 URL */
  url?: string
  /** 请求方法 */
  method?: string
  /** 错误堆栈信息 */
  stack?: string
}

// 自定义 HttpError 类
export class HttpError extends Error {
  public readonly code: number
  public readonly data?: unknown
  public readonly errors?: FieldError[]
  public readonly timestamp: string
  public readonly url?: string
  public readonly method?: string

  constructor(
    message: string,
    code: number,
    options?: {
      data?: unknown
      errors?: FieldError[]
      url?: string
      method?: string
    }
  ) {
    super(message)
    this.name = 'HttpError'
    this.code = code
    this.data = options?.data
    this.errors = options?.errors
    this.timestamp = new Date().toISOString()
    this.url = options?.url
    this.method = options?.method
  }

  public toLogData(): ErrorLogData {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
      errors: this.errors,
      timestamp: this.timestamp,
      url: this.url,
      method: this.method,
      stack: this.stack
    }
  }
}

/**
 * 将 HTTP 状态码映射到业务错误码
 */
const mapHttpStatusToApiCode = (status: number): number => {
  switch (status) {
    case HttpStatus.unauthorized:
      return ApiStatus.notLoggedIn
    case HttpStatus.forbidden:
      return ApiStatus.permissionDenied
    case HttpStatus.notFound:
      return ApiStatus.dataNotFound
    case HttpStatus.methodNotAllowed:
      return ApiStatus.methodNotAllowed
    case HttpStatus.tooManyRequests:
      return ApiStatus.rateLimitExceeded
    case HttpStatus.requestTimeout:
    case HttpStatus.gatewayTimeout:
    case HttpStatus.serviceUnavailable:
    case HttpStatus.badGateway:
    case HttpStatus.internalServerError:
      return ApiStatus.serverError
    default:
      return ApiStatus.operationFailed
  }
}

/**
 * 根据状态码返回本地化错误消息
 */
const getErrorMessage = (status: number): string => {
  const map: Record<number, string> = {
    [HttpStatus.unauthorized]: 'httpMsg.unauthorized',
    [HttpStatus.forbidden]: 'httpMsg.forbidden',
    [HttpStatus.notFound]: 'httpMsg.notFound',
    [HttpStatus.methodNotAllowed]: 'httpMsg.methodNotAllowed',
    [HttpStatus.requestTimeout]: 'httpMsg.requestTimeout',
    [HttpStatus.internalServerError]: 'httpMsg.internalServerError',
    [HttpStatus.badGateway]: 'httpMsg.badGateway',
    [HttpStatus.serviceUnavailable]: 'httpMsg.serviceUnavailable',
    [HttpStatus.gatewayTimeout]: 'httpMsg.gatewayTimeout'
  }
  return $t(map[status] || 'httpMsg.internalServerError')
}

/**
 * 处理错误（axios 的网络层错误或业务错误）
 */
export function handleError(error: AxiosError<BaseResponse>): never {
  if (error.code === 'ERR_CANCELED') {
    console.warn('Request cancelled:', error.message)
    throw new HttpError($t('httpMsg.requestCancelled'), ApiStatus.operationFailed)
  }

  const statusCode = error.response?.status
  const backendPayload = error.response?.data
  const requestConfig = error.config

  // 处理网络错误
  if (!error.response) {
    throw new HttpError($t('httpMsg.networkError'), ApiStatus.serverError, {
      url: requestConfig?.url,
      method: requestConfig?.method?.toUpperCase()
    })
  }

  // 后端已返回结构化 body，优先使用
  if (backendPayload && typeof backendPayload === 'object' && 'code' in backendPayload) {
    throw new HttpError(
      backendPayload.message || $t('httpMsg.requestFailed'),
      backendPayload.code ?? mapHttpStatusToApiCode(statusCode ?? 0),
      {
        data: backendPayload.data,
        errors: backendPayload.errors,
        url: requestConfig?.url,
        method: requestConfig?.method?.toUpperCase()
      }
    )
  }

  // 无结构化 body：根据 HTTP 状态码翻译
  const message = statusCode ? getErrorMessage(statusCode) : $t('httpMsg.requestFailed')
  throw new HttpError(message, mapHttpStatusToApiCode(statusCode ?? 0), {
    data: error.response.data,
    url: requestConfig?.url,
    method: requestConfig?.method?.toUpperCase()
  })
}

/**
 * 显示错误消息
 */
export function showError(error: HttpError, showMessage: boolean = true): void {
  if (showMessage) {
    ElMessage.error(error.message)
  }
  console.error('[HTTP Error]', error.toLogData())
}

/**
 * 显示成功消息
 */
export function showSuccess(message: string, showMessage: boolean = true): void {
  if (showMessage) {
    ElMessage.success(message)
  }
}

/**
 * 判断是否为 HttpError 类型
 */
export const isHttpError = (error: unknown): error is HttpError => {
  return error instanceof HttpError
}

/**
 * 判断业务码是否属于"未登录/Token 失效"类（用于自动登出）
 */
export const isAuthExpired = (code: number): boolean =>
  code === ApiStatus.notLoggedIn || code === ApiStatus.tokenInvalid
