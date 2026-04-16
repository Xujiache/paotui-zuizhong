import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { ErrorCode } from '../types/enums';

export const checkPermission = (resource: string, action: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user || !user.permissions) {
      res.status(403).json({ code: ErrorCode.PERMISSION_DENIED, message: '无权限访问', data: null });
      return;
    }

    const perms = user.permissions;
    if ((perms as Record<string, unknown>)['admin'] === true) {
      next();
      return;
    }

    if (perms[resource] && Array.isArray(perms[resource]) && perms[resource].includes(action)) {
      next();
      return;
    }

    res.status(403).json({ code: ErrorCode.PERMISSION_DENIED, message: '无权限执行此操作', data: null });
  };
};

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const user = req.user;
  if (!user || !user.permissions) {
    res.status(403).json({ code: ErrorCode.PERMISSION_DENIED, message: '需要管理员权限', data: null });
    return;
  }
  if ((user.permissions as Record<string, unknown>)['admin'] === true) {
    next();
    return;
  }
  res.status(403).json({ code: ErrorCode.PERMISSION_DENIED, message: '需要管理员权限', data: null });
};
