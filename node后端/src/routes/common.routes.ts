import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { validate, phoneSchema } from '../middleware/validator';
import { asyncHandler } from '../middleware/errorHandler';
import { tokenAuth } from '../middleware/auth';
import { success } from '../middleware/responseFormatter';
import { sendSmsCode } from '../services/sms.service';
import { uploader, formatUploadResult } from '../services/upload.service';
import { testConnection } from '../utils/database';
import { isRedisReady } from '../utils/redis';
import { AppError } from '../utils/AppError';
import { ErrorCode } from '../types/enums';

const router = Router();

router.get(
  '/health',
  asyncHandler(async (_req: Request, res: Response) => {
    const dbOk = await testConnection();
    const redisOk = isRedisReady();
    const payload = {
      status: dbOk && redisOk ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      dependencies: {
        database: dbOk ? 'connected' : 'disconnected',
        redis: redisOk ? 'connected' : 'disconnected',
      },
    };
    if (!dbOk || !redisOk) {
      res.status(503).json({
        code: ErrorCode.SERVER_ERROR,
        message: '部分依赖不可用',
        data: payload,
      });
      return;
    }
    success(res, payload, 'Server is running');
  }),
);

router.post(
  '/sms/send-code',
  validate({
    body: Joi.object({
      phone: phoneSchema.required(),
      scene: Joi.string().default('LOGIN'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { phone, scene } = req.body as { phone: string; scene?: string };
    const data = await sendSmsCode(phone, scene || 'LOGIN');
    success(res, data, '验证码已发送');
  }),
);

router.post(
  '/upload/image',
  tokenAuth(),
  uploader.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw AppError.paramInvalid('未接收到文件', [{ field: 'file', message: '文件不能为空' }]);
    }
    success(res, formatUploadResult(req.file));
  }),
);

router.post(
  '/upload/images',
  tokenAuth(),
  uploader.array('files', 9),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      throw AppError.paramInvalid('未接收到文件', [{ field: 'files', message: '至少上传一张图片' }]);
    }
    const list = files.map((f) => formatUploadResult(f));
    success(res, { list, count: list.length });
  }),
);

export default router;
