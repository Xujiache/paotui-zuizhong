/**
 * API 接口类型定义模块（对齐后端 PRD《接口规范与状态机》）
 *
 * - 成功响应：{ code: 0, message, data }
 * - 分页响应：{ code, message, data: { list, pagination } }
 * - 双 Token：accessToken + refreshToken
 *
 * @module types/api/api
 */

declare namespace Api {
  /** 通用类型 */
  namespace Common {
    /**
     * 前端表格分页状态（兼容 art-design-pro 模板 useTable hook）
     *
     * 发送后端请求时请用 {@link BackendPaginationParams}
     */
    interface PaginationParams {
      /** 当前页码（从 1 开始） */
      current: number
      /** 每页条数 */
      size: number
      /** 总条数 */
      total: number
    }

    /** 后端分页入参（PRD：page / pageSize） */
    interface BackendPaginationParams {
      page: number
      pageSize: number
      sortBy?: string
      sortOrder?: 'asc' | 'desc'
    }

    /** 通用搜索入参（可叠加 PaginationParams） */
    type CommonSearchParams = Pick<PaginationParams, 'current' | 'size'>

    /**
     * 分页响应（模板 useTable hook 依赖该结构：records / current / size / total）
     *
     * 后端真实响应请使用 {@link BackendPaginatedResponse}
     */
    interface PaginatedResponse<T = any> {
      records: T[]
      current: number
      size: number
      total: number
    }

    /** 后端分页响应（对齐 PRD：list + pagination） */
    interface BackendPaginatedResponse<T = any> {
      list: T[]
      pagination: {
        page: number
        pageSize: number
        total: number
        totalPages: number
      }
    }

    /** 启用状态 */
    type EnableStatus = 'ACTIVE' | 'INACTIVE'
  }

  /** 认证类型 */
  namespace Auth {
    /** 管理员登录入参（对齐后端：username/password） */
    interface LoginParams {
      username: string
      password: string
      /** @deprecated 兼容示例模板，推荐使用 username */
      userName?: string
    }

    /** 双令牌 */
    interface TokenPair {
      accessToken: string
      refreshToken: string
      expiresIn: number
    }

    /** 管理员登录响应 */
    interface LoginResponse extends TokenPair {
      adminInfo: AdminInfo
      /** @deprecated 兼容示例模板，推荐使用 accessToken */
      token?: string
    }

    /** 管理员信息（兼容旧视图：userName / userId 别名） */
    interface AdminInfo {
      id: number
      username: string
      realName: string
      avatar: string
      roleName: string
      roleCode: string
      /** 超管返回 ['*']，其他角色为细粒度权限码列表 */
      permissions: string[]
      /** @deprecated 兼容旧视图，推荐使用 id */
      userId?: number
      /** @deprecated 兼容旧视图，推荐使用 username */
      userName?: string
      /** @deprecated 兼容旧视图 */
      roles?: string[]
      /** @deprecated 兼容旧视图 */
      buttons?: string[]
      /** @deprecated 兼容旧视图 */
      email?: string
    }

    /** 用户信息（兼容历史视图命名） */
    type UserInfo = AdminInfo

    /** 刷新令牌入参 */
    interface RefreshTokenParams {
      refreshToken: string
    }
  }

  /**
   * 系统管理类型
   *
   * 说明：阶段07 会基于后端 /api/v1/admin/* 接口重写这些类型
   * 当前保留模板字段（userName / userPhone / records 等）以便 vue-tsc 通过，
   * 不代表这些字段与后端契约一致，仅用于前端表格骨架。
   */
  namespace SystemManage {
    /** 用户列表（示例模板兼容字段） */
    type UserList = Api.Common.PaginatedResponse<UserListItem>

    /** 用户列表项 */
    interface UserListItem {
      id: number
      avatar: string
      status: string
      userName: string
      userGender: string
      nickName: string
      userPhone: string
      userEmail: string
      userRoles: string[]
      createBy: string
      createTime: string
      updateBy: string
      updateTime: string
    }

    /** 用户搜索参数 */
    type UserSearchParams = Partial<
      Pick<UserListItem, 'id' | 'userName' | 'userGender' | 'userPhone' | 'userEmail' | 'status'> &
        Api.Common.CommonSearchParams
    >

    /** 角色列表 */
    type RoleList = Api.Common.PaginatedResponse<RoleListItem>

    /** 角色列表项 */
    interface RoleListItem {
      roleId: number
      roleName: string
      roleCode: string
      description: string
      enabled: boolean
      createTime: string
    }

    /** 角色搜索参数 */
    type RoleSearchParams = Partial<
      Pick<RoleListItem, 'roleId' | 'roleName' | 'roleCode' | 'description' | 'enabled'> &
        Api.Common.CommonSearchParams
    >
  }
}
