import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { redis } from '../utils/redis';
import { ErrorCode } from '../types/enums';
import config from '../config';
import { AppError } from '../utils/AppError';

const buildResponseBody = (code: number, message: string) => ({
  code,
  message,
  data: null,
});

/** 测试环境可通过环境变量关闭限流（CI/自动化冒烟场景） */
const disableRateLimit = (): boolean =>
  process.env.DISABLE_RATE_LIMIT === 'true' || process.env.NODE_ENV === 'test';

export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.globalWindowMs,
  max: config.rateLimit.globalMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => disableRateLimit(),
  message: buildResponseBody(ErrorCode.RATE_LIMIT_EXCEEDED, '请求过于频繁，请稍后再试'),
  handler: (_req, res) => {
    res
      .status(429)
      .json(buildResponseBody(ErrorCode.RATE_LIMIT_EXCEEDED, '请求过于频繁，请稍后再试'));
  },
});

export const authLimiter = rateLimit({
  windowMs: config.rateLimit.authWindowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => disableRateLimit(),
  message: buildResponseBody(ErrorCode.TOO_FREQUENT, '登录请求过于频繁，请稍后再试'),
  handler: (_req, res) => {
    res
      .status(429)
      .json(buildResponseBody(ErrorCode.TOO_FREQUENT, '登录请求过于频繁，请稍后再试'));
  },
});

export const smsLimiter = (req: Request, _res: Response, next: NextFunction) => {
  (async () => {
    try {
      const phone = (req.body?.phone || '').toString();
      if (phone) {
        const key = `sms-trigger:${phone}`;
        const count = await redis.incrementRateLimit(key, 60);
        if (count > 3) {
          return next(new AppError(ErrorCode.TOO_FREQUENT, '操作过于频繁，请稍后再试', 429));
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  })();
};
