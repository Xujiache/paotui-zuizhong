import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { UserRole } from '../types/enums';
import { findAdminById } from '../models/admin.model';
import { findRoleById, findPermissionsByRoleId } from '../models/role.model';
import { SUPER_ADMIN_ROLE_CODE } from '../config/constants';

export const requirePermission = (...permissions: string[]) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(AppError.unauthorized());

      if (req.user.role !== UserRole.ADMIN) {
        return next(AppError.forbidden('仅管理员可访问此接口'));
      }

      const admin = await findAdminById(req.user.userId);
      if (!admin) return next(AppError.forbidden('管理员账号不存在'));

      const role = await findRoleById(admin.role_id);
      if (!role) return next(AppError.forbidden('角色不存在'));

      if (role.code === SUPER_ADMIN_ROLE_CODE) {
        return next();
      }

      const rolePerms = await findPermissionsByRoleId(admin.role_id);
      const hasPermission = permissions.some((p) => rolePerms.includes(p));
      if (!hasPermission) {
        return next(AppError.forbidden('权限不足'));
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
