/**
 * API 响应类型定义模块（对齐后端 PRD 《接口规范与状态机》§1.1）
 *
 * - 成功响应: { code: 0, message: string, data: T }
 * - 分页响应: data.list + data.pagination{ page, pageSize, total, totalPages }
 * - 错误响应: { code: number, message: string, data: null, errors?: FieldError[] }
 *
 * @module types/common/response
 */

/** 字段级校验错误 */
export interface FieldError {
  /** 出错的字段名（可能带 body. / query. 前缀） */
  field: string
  /** 错误信息 */
  message: string
}

/** 基础 API 响应结构 */
export interface BaseResponse<T = unknown> {
  /** 业务状态码，0 表示成功，其余见错误码表 */
  code: number
  /** 可读消息 */
  message: string
  /** 业务数据 */
  data: T
  /** 参数校验失败时的字段明细（可选） */
  errors?: FieldError[]
}

/** 分页响应包装 */
export interface PaginationWrapper<T> {
  list: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}
