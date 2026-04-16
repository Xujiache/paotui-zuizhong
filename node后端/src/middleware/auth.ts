import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AuthRequest } from '../types';
import { UserType, ErrorCode } from '../types/enums';

export const authMiddleware = (allowedTypes?: UserType | UserType[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        code: ErrorCode.NOT_LOGGED_IN,
        message: '未提供授权令牌',
        data: null,
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      res.status(401).json({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Token无效或已过期',
        data: null,
      });
      return;
    }

    if (allowedTypes) {
      const types = Array.isArray(allowedTypes) ? allowedTypes : [allowedTypes];
      if (!types.includes(decoded.type as UserType)) {
        res.status(403).json({
          code: ErrorCode.PERMISSION_DENIED,
          message: '无权访问此接口',
          data: null,
        });
        return;
      }
    }

    req.user = decoded;
    next();
  };
};
