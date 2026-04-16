import request from '@/utils/http'

/**
 * 管理员登录
 * @see PRD《接口规范与状态机》POST /api/v1/auth/admin/login
 */
export function fetchLogin(params: Api.Auth.LoginParams) {
  return request.post<Api.Auth.LoginResponse>({
    url: '/api/v1/auth/admin/login',
    params
  })
}

/**
 * 获取当前管理员信息（含角色 + 权限码）
 * @see PRD《接口规范与状态机》GET /api/v1/auth/admin/info
 */
export function fetchGetUserInfo() {
  return request.get<Api.Auth.UserInfo>({
    url: '/api/v1/auth/admin/info'
  })
}

/**
 * 刷新 Access Token
 * @see POST /api/v1/auth/refresh-token
 */
export function fetchRefreshToken(params: Api.Auth.RefreshTokenParams) {
  return request.post<Api.Auth.TokenPair>({
    url: '/api/v1/auth/refresh-token',
    params
  })
}

/**
 * 登出（将当前 Token 加入黑名单）
 * @see POST /api/v1/auth/logout
 */
export function fetchLogout() {
  return request.post<null>({
    url: '/api/v1/auth/logout'
  })
}
