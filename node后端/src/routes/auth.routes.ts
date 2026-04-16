import { Router } from 'express';
import Joi from 'joi';
import { validate, phoneSchema, smsCodeSchema, passwordSchema } from '../middleware/validator';
import { asyncHandler } from '../middleware/errorHandler';
import { authLimiter } from '../middleware/rateLimiter';
import { tokenAuth, userOnly, adminOnly } from '../middleware/auth';
import { success } from '../middleware/responseFormatter';
import * as authService from '../services/auth.service';
import { sendSmsCode } from '../services/sms.service';
import { AppError } from '../utils/AppError';

const router = Router();

const pickClientType = (req: unknown): string | undefined => {
  const headers = (req as { headers: Record<string, unknown> }).headers;
  const raw = headers?.['x-client-type'];
  return typeof raw === 'string' ? raw : undefined;
};

const extractBearer = (req: unknown): string | null => {
  const headers = (req as { headers: Record<string, unknown> }).headers;
  const auth = headers?.authorization;
  if (typeof auth !== 'string') return null;
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : auth.trim();
};

router.post(
  '/user/wx-login',
  authLimiter,
  validate({
    body: Joi.object({
      code: Joi.string().required(),
      encryptedData: Joi.string().optional(),
      iv: Joi.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { code } = req.body as { code: string };
    const data = await authService.wxLogin(code, pickClientType(req));
    success(res, data);
  }),
);

router.post(
  '/user/bind-phone',
  tokenAuth(),
  userOnly,
  validate({
    body: Joi.object({
      phone: phoneSchema.required(),
      code: smsCodeSchema.required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { phone, code } = req.body as { phone: string; code: string };
    const data = await authService.bindUserPhone(req.user!.userId, phone, code);
    success(res, data);
  }),
);

router.post(
  '/user/send-code',
  validate({
    body: Joi.object({
      phone: phoneSchema.required(),
      scene: Joi.string().default('LOGIN'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await sendSmsCode(req.body.phone, req.body.scene || 'LOGIN');
    success(res, data, '验证码已发送');
  }),
);

router.post(
  '/user/phone-login',
  authLimiter,
  validate({
    body: Joi.object({
      phone: phoneSchema.required(),
      code: smsCodeSchema.required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { phone, code } = req.body as { phone: string; code: string };
    const data = await authService.userPhoneLogin(phone, code, pickClientType(req));
    success(res, data);
  }),
);

router.put(
  '/user/profile',
  tokenAuth(),
  userOnly,
  validate({
    body: Joi.object({
      nickname: Joi.string().max(64).optional(),
      avatar: Joi.string().max(512).optional(),
      gender: Joi.number().valid(0, 1, 2).optional(),
    }).min(1),
  }),
  asyncHandler(async (req, res) => {
    const data = await authService.updateUser(req.user!.userId, req.body);
    success(res, data);
  }),
);

router.post(
  '/merchant/send-code',
  validate({
    body: Joi.object({
      phone: phoneSchema.required(),
      scene: Joi.string().default('LOGIN'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await sendSmsCode(req.body.phone, req.body.scene || 'LOGIN');
    success(res, data, '验证码已发送');
  }),
);

router.post(
  '/merchant/register',
  validate({
    body: Joi.object({
      phone: phoneSchema.required(),
      code: smsCodeSchema.required(),
      password: passwordSchema.required(),
      name: Joi.string().max(128).required(),
      contactName: Joi.string().max(32).required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await authService.merchantRegister(req.body, pickClientType(req));
    success(res, data, '注册成功');
  }),
);

router.post(
  '/merchant/login',
  authLimiter,
  validate({
    body: Joi.object({
      phone: phoneSchema.required(),
      code: smsCodeSchema.required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { phone, code } = req.body as { phone: string; code: string };
    const data = await authService.merchantLoginByCode(phone, code, pickClientType(req));
    success(res, data);
  }),
);

router.post(
  '/merchant/login-pwd',
  authLimiter,
  validate({
    body: Joi.object({
      phone: phoneSchema.required(),
      password: Joi.string().required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { phone, password } = req.body as { phone: string; password: string };
    const data = await authService.merchantLoginByPassword(phone, password, pickClientType(req));
    success(res, data);
  }),
);

router.post(
  '/rider/send-code',
  validate({
    body: Joi.object({
      phone: phoneSchema.required(),
      scene: Joi.string().default('LOGIN'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await sendSmsCode(req.body.phone, req.body.scene || 'LOGIN');
    success(res, data, '验证码已发送');
  }),
);

router.post(
  '/rider/register',
  validate({
    body: Joi.object({
      phone: phoneSchema.required(),
      code: smsCodeSchema.required(),
      password: passwordSchema.required(),
      name: Joi.string().max(32).required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await authService.riderRegister(req.body, pickClientType(req));
    success(res, data, '注册成功');
  }),
);

router.post(
  '/rider/login',
  authLimiter,
  validate({
    body: Joi.object({
      phone: phoneSchema.required(),
      code: smsCodeSchema.required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { phone, code } = req.body as { phone: string; code: string };
    const data = await authService.riderLoginByCode(phone, code, pickClientType(req));
    success(res, data);
  }),
);

router.post(
  '/admin/login',
  authLimiter,
  validate({
    body: Joi.object({
      username: Joi.string().min(3).max(64).required(),
      password: Joi.string().min(6).max(128).required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body as { username: string; password: string };
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || '';
    const userAgent = (req.headers['user-agent'] as string) || '';
    const data = await authService.adminLogin(
      username,
      password,
      ip,
      userAgent,
      pickClientType(req),
    );
    success(res, data);
  }),
);

router.get(
  '/admin/info',
  tokenAuth(),
  adminOnly,
  asyncHandler(async (req, res) => {
    const data = await authService.getAdminInfo(req.user!.userId);
    success(res, data);
  }),
);

router.post(
  '/refresh-token',
  validate({
    body: Joi.object({
      refreshToken: Joi.string().required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as { refreshToken: string };
    const data = await authService.refreshTokens(refreshToken);
    success(res, data);
  }),
);

router.post(
  '/logout',
  tokenAuth(),
  asyncHandler(async (req, res) => {
    const token = extractBearer(req);
    if (!token) throw AppError.unauthorized();
    await authService.logout(token, {
      userId: req.user!.userId,
      role: String(req.user!.role),
    });
    success(res, null, '登出成功');
  }),
);

export default router;
