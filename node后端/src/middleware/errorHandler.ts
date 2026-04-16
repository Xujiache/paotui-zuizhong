import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { AppError } from '../utils/AppError';
import { ErrorCode } from '../types/enums';

export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
  res.status(404).json({
    code: ErrorCode.DATA_NOT_FOUND,
    message: `找不到路径: ${req.method} ${req.originalUrl}`,
    data: null,
  });
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    const body: Record<string, unknown> = {
      code: err.code,
      message: err.message,
      data: null,
    };
    if (err.errors && err.errors.length > 0) {
      body.errors = err.errors;
    }

    if (err.statusCode >= 500) {
      logger.error(`[${req.method}] ${req.originalUrl} - ${err.code} ${err.message}`);
      logger.error(err.stack || '');
    } else {
      logger.warn(`[${req.method}] ${req.originalUrl} - ${err.code} ${err.message}`);
    }

    res.status(err.statusCode).json(body);
    return;
  }

  const maybeStatus = (err as Error & { statusCode?: number; status?: number }).statusCode ??
    (err as Error & { statusCode?: number; status?: number }).status ?? 500;
  logger.error(`[${req.method}] ${req.originalUrl} - ${maybeStatus} ${err.message}`);
  logger.error(err.stack || '');

  res.status(maybeStatus >= 400 && maybeStatus < 600 ? maybeStatus : 500).json({
    code: ErrorCode.SERVER_ERROR,
    message: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message,
    data: null,
  });
};

export const asyncHandler =
  <T = unknown>(fn: (req: Request, res: Response, next: NextFunction) => Promise<T>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
