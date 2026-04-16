/**
 * 接口业务状态码（来自后端 PRD《错误码表》）
 *
 * 后端响应的 code 字段属于业务层语义，和 HTTP 状态码是两个独立维度：
 * - 业务成功统一返回 code = 0
 * - 业务异常返回 10000-23099 之间的枚举值
 *
 * 真实的 HTTP 状态码（200/401/429/500 等）不在本枚举范围内。
 */
export enum ApiStatus {
  /** 业务成功 */
  success = 0,

  // 10000-10099 通用
  paramInvalid = 10001,
  dataNotFound = 10002,
  dataAlreadyExists = 10003,
  operationFailed = 10004,
  serverError = 10005,

  // 10100-10199 网关
  rateLimitExceeded = 10100,
  requestFormatError = 10101,
  methodNotAllowed = 10102,

  // 11000-11099 认证授权
  notLoggedIn = 11001,
  tokenInvalid = 11002,
  permissionDenied = 11003,
  accountFrozen = 11004,
  verifyCodeError = 11005,
  tooFrequent = 11006,
  dailyLimitReached = 11007,
}

/**
 * HTTP 状态码（供传输层判断使用，例如 axios 默认 validateStatus）
 */
export enum HttpStatus {
  ok = 200,
  badRequest = 400,
  unauthorized = 401,
  forbidden = 403,
  notFound = 404,
  methodNotAllowed = 405,
  requestTimeout = 408,
  tooManyRequests = 429,
  internalServerError = 500,
  notImplemented = 501,
  badGateway = 502,
  serviceUnavailable = 503,
  gatewayTimeout = 504,
}
