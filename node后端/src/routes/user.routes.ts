import { Router } from 'express';
import Joi from 'joi';
import { tokenAuth, userOnly } from '../middleware/auth';
import { validate, phoneSchema } from '../middleware/validator';
import { paginate } from '../middleware/pagination';
import { asyncHandler } from '../middleware/errorHandler';
import { success, paginated } from '../middleware/responseFormatter';
import * as userService from '../services/user.service';

const router = Router();
router.use(tokenAuth(), userOnly);

// ========== 地址 ==========

const addressBody = Joi.object({
  contactName: Joi.string().max(32).required(),
  contactPhone: phoneSchema.required(),
  province: Joi.string().max(32).required(),
  city: Joi.string().max(32).required(),
  district: Joi.string().max(32).required(),
  address: Joi.string().max(256).required(),
  houseNumber: Joi.string().max(64).allow(''),
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  tag: Joi.string().max(16).allow(''),
  isDefault: Joi.boolean().default(false),
});

const addressUpdateBody = Joi.object({
  contactName: Joi.string().max(32),
  contactPhone: phoneSchema,
  province: Joi.string().max(32),
  city: Joi.string().max(32),
  district: Joi.string().max(32),
  address: Joi.string().max(256),
  houseNumber: Joi.string().max(64).allow(''),
  lat: Joi.number().min(-90).max(90),
  lng: Joi.number().min(-180).max(180),
  tag: Joi.string().max(16).allow(''),
}).min(1);

const idParam = Joi.object({ id: Joi.number().integer().positive().required() });

router.get(
  '/addresses',
  asyncHandler(async (req, res) => {
    const list = await userService.getUserAddresses(req.user!.userId);
    success(res, { list });
  }),
);

router.post(
  '/addresses',
  validate({ body: addressBody }),
  asyncHandler(async (req, res) => {
    const data = await userService.addUserAddress(req.user!.userId, req.body);
    success(res, data, '新增地址成功', 201);
  }),
);

router.put(
  '/addresses/:id',
  validate({ params: idParam, body: addressUpdateBody }),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const data = await userService.modifyUserAddress(req.user!.userId, id, req.body);
    success(res, data);
  }),
);

router.delete(
  '/addresses/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await userService.removeUserAddress(req.user!.userId, id);
    success(res, null, '删除成功');
  }),
);

router.patch(
  '/addresses/:id/default',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await userService.setUserDefaultAddress(req.user!.userId, id);
    success(res, null, '已设为默认');
  }),
);

// ========== 收藏 ==========

router.get(
  '/favorites',
  paginate(),
  validate({
    query: Joi.object({
      targetType: Joi.string().valid('STORE', 'PRODUCT').optional(),
      page: Joi.number().integer().min(1).optional(),
      pageSize: Joi.number().integer().min(1).max(100).optional(),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().valid('asc', 'desc').optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.pagination!;
    const data = await userService.getUserFavorites(
      req.user!.userId,
      req.query.targetType as 'STORE' | 'PRODUCT' | undefined,
      page,
      pageSize,
    );
    paginated(res, data);
  }),
);

router.post(
  '/favorites',
  validate({
    body: Joi.object({
      targetType: Joi.string().valid('STORE', 'PRODUCT').required(),
      targetId: Joi.number().integer().positive().required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { targetType, targetId } = req.body as {
      targetType: 'STORE' | 'PRODUCT';
      targetId: number;
    };
    const data = await userService.addUserFavorite(req.user!.userId, targetType, targetId);
    success(res, data, '收藏成功', 201);
  }),
);

router.delete(
  '/favorites/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await userService.removeUserFavorite(req.user!.userId, id);
    success(res, null, '取消收藏成功');
  }),
);

// ========== 浏览历史 ==========

router.get(
  '/history',
  paginate(),
  validate({
    query: Joi.object({
      targetType: Joi.string().valid('STORE', 'PRODUCT').optional(),
      page: Joi.number().integer().min(1).optional(),
      pageSize: Joi.number().integer().min(1).max(100).optional(),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().valid('asc', 'desc').optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.pagination!;
    const data = await userService.getUserViewHistory(
      req.user!.userId,
      req.query.targetType as 'STORE' | 'PRODUCT' | undefined,
      page,
      pageSize,
    );
    paginated(res, data);
  }),
);

router.post(
  '/history',
  validate({
    body: Joi.object({
      targetType: Joi.string().valid('STORE', 'PRODUCT').required(),
      targetId: Joi.number().integer().positive().required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { targetType, targetId } = req.body as {
      targetType: 'STORE' | 'PRODUCT';
      targetId: number;
    };
    await userService.logUserView(req.user!.userId, targetType, targetId);
    success(res, null, '已记录');
  }),
);

router.delete(
  '/history',
  asyncHandler(async (req, res) => {
    await userService.clearUserViewHistory(req.user!.userId);
    success(res, null, '已清空');
  }),
);

// ========== 资料 ==========

router.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const data = await userService.getUserProfile(req.user!.userId);
    success(res, data);
  }),
);

router.put(
  '/profile',
  validate({
    body: Joi.object({
      nickname: Joi.string().max(64).optional(),
      avatar: Joi.string().max(512).optional(),
      gender: Joi.number().valid(0, 1, 2).optional(),
    }).min(1),
  }),
  asyncHandler(async (req, res) => {
    const data = await userService.updateUserProfileData(req.user!.userId, req.body);
    success(res, data);
  }),
);

export default router;
