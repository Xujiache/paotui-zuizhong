import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { redis } from '../utils/redis';
import { AppError } from '../utils/AppError';
import { ErrorCode, UserRole } from '../types/enums';

const extractToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (!header) return null;
  if (header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return header.trim();
};

export const tokenAuth = (options?: { optional?: boolean }) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = extractToken(req);

      if (!token) {
        if (options?.optional) return next();
        return next(AppError.unauthorized('未登录或Token过期'));
      }

      if (await redis.isBlacklisted(token)) {
        return next(AppError.tokenInvalid('Token已失效，请重新登录'));
      }

      const payload = verifyAccessToken(token);
      if (!payload) {
        return next(new AppError(ErrorCode.NOT_LOGGED_IN, 'Token无效或已过期', 401));
      }

      req.user = {
        userId: payload.userId,
        role: payload.role,
        clientType: payload.clientType,
        iat: payload.iat,
        exp: payload.exp,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const requireRole = (...roles: Array<UserRole | string>) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }
    if (!roles.includes(req.user.role as UserRole)) {
      return next(AppError.forbidden(`仅 ${roles.join('/')} 角色可访问`));
    }
    next();
  };
};

export const userOnly = requireRole(UserRole.USER);
export const merchantOnly = requireRole(UserRole.MERCHANT);
export const riderOnly = requireRole(UserRole.RIDER);
export const adminOnly = requireRole(UserRole.ADMIN);
