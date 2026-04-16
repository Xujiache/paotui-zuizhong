import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { ErrorCode } from '../types/enums';

export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
  res.status(404).json({
    code: ErrorCode.DATA_NOT_FOUND,
    message: `找不到路径: ${req.originalUrl}`,
    data: null,
  });
};

export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction): void => {
  logger.error(`错误: ${err.message}`);
  logger.error(err.stack || '');

  const statusCode = (err as Error & { statusCode?: number }).statusCode || 500;
  const message = err.message || '服务器内部错误';

  res.status(statusCode).json({
    code: ErrorCode.SERVER_ERROR,
    message,
    data: null,
  });
};
