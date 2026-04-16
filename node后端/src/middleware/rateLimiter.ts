import rateLimit from 'express-rate-limit';
import { ErrorCode } from '../types/enums';

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: ErrorCode.RATE_LIMIT_EXCEEDED,
    message: '请求过于频繁，请稍后再试',
    data: null,
  },
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: ErrorCode.TOO_FREQUENT,
    message: '登录请求过于频繁，请稍后再试',
    data: null,
  },
});
