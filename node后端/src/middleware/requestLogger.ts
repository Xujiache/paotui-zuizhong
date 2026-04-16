import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';

const pickClientType = (req: Request): string =>
  (req.headers['x-client-type'] as string) || 'unknown';

const pickRequestId = (req: Request): string => {
  const existing = (req.headers['x-request-id'] as string) || '';
  if (existing) return existing;
  return crypto.randomBytes(8).toString('hex');
};

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  req.startTime = Date.now();
  req.requestId = pickRequestId(req);
  res.setHeader('X-Request-ID', req.requestId);

  const clientType = pickClientType(req);
  const ip = (req.headers['x-forwarded-for'] as string) || req.ip || '';

  res.on('finish', () => {
    const duration = Date.now() - (req.startTime ?? Date.now());
    logger.info(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms client=${clientType} ip=${ip} rid=${req.requestId}`,
    );
  });

  next();
};
