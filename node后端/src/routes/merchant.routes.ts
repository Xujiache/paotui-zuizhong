import { Router } from 'express';
import Joi from 'joi';
import { tokenAuth, merchantOnly } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { paginate } from '../middleware/pagination';
import { asyncHandler } from '../middleware/errorHandler';
import { success, paginated } from '../middleware/responseFormatter';
import * as merchantService from '../services/merchant.service';

const router = Router();

const idParam = Joi.object({ id: Joi.number().integer().positive().required() });

// ========== 商家自己的接口 ==========

const merchantScope = Router();
merchantScope.use(tokenAuth(), merchantOnly);

merchantScope.post(
  '/apply',
  validate({
    body: Joi.object({
      name: Joi.string().max(128).optional(),
      contactName: Joi.string().max(32).optional(),
      licenseNo: Joi.string().max(64).optional(),
      licenseImage: Joi.string().max(512).optional(),
      idCardFront: Joi.string().max(512).optional(),
      idCardBack: Joi.string().max(512).optional(),
      category: Joi.string().max(64).optional(),
    }).min(1),
  }),
  asyncHandler(async (req, res) => {
    const data = await merchantService.submitApply(req.user!.userId, req.body);
    success(res, data, '已提交审核');
  }),
);

merchantScope.get(
  '/audit-status',
  asyncHandler(async (req, res) => {
    const data = await merchantService.getAuditStatus(req.user!.userId);
    success(res, data);
  }),
);

merchantScope.get(
  '/stores',
  asyncHandler(async (req, res) => {
    const list = await merchantService.getMerchantStores(req.user!.userId);
    success(res, { list });
  }),
);

merchantScope.get(
  '/stores/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const data = await merchantService.getMerchantStore(
      req.user!.userId,
      Number(req.params.id),
    );
    success(res, data);
  }),
);

merchantScope.post(
  '/stores',
  validate({
    body: Joi.object({
      name: Joi.string().max(128).required(),
      phone: Joi.string().max(20).required(),
      province: Joi.string().max(32).required(),
      city: Joi.string().max(32).required(),
      district: Joi.string().max(32).required(),
      address: Joi.string().max(256).required(),
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required(),
      logo: Joi.string().max(512).allow(''),
      minOrderAmount: Joi.number().min(0).optional(),
      deliveryFee: Joi.number().min(0).optional(),
      deliveryRange: Joi.number().integer().min(500).max(20000).optional(),
      deliveryTime: Joi.number().integer().min(1).max(240).optional(),
      packingFee: Joi.number().min(0).optional(),
      commissionRate: Joi.number().min(0).max(100).optional(),
      areaId: Joi.number().integer().positive().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await merchantService.createMerchantStore(req.user!.userId, req.body);
    success(res, data, '门店创建成功', 201);
  }),
);

merchantScope.put(
  '/stores/:id',
  validate({
    params: idParam,
    body: Joi.object({
      name: Joi.string().max(128),
      phone: Joi.string().max(20),
      province: Joi.string().max(32),
      city: Joi.string().max(32),
      district: Joi.string().max(32),
      address: Joi.string().max(256),
      lat: Joi.number().min(-90).max(90),
      lng: Joi.number().min(-180).max(180),
      logo: Joi.string().max(512).allow(''),
    }).min(1),
  }),
  asyncHandler(async (req, res) => {
    const data = await merchantService.updateMerchantStore(
      req.user!.userId,
      Number(req.params.id),
      req.body,
    );
    success(res, data);
  }),
);

merchantScope.put(
  '/stores/:id/business-hours',
  validate({
    params: idParam,
    body: Joi.object({
      businessHours: Joi.array()
        .items(
          Joi.object({
            start: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
            end: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
          }),
        )
        .required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    await merchantService.setStoreBusinessHours(
      req.user!.userId,
      Number(req.params.id),
      req.body.businessHours,
    );
    success(res, null, '营业时间已更新');
  }),
);

merchantScope.put(
  '/stores/:id/delivery',
  validate({
    params: idParam,
    body: Joi.object({
      minOrderAmount: Joi.number().min(0),
      deliveryFee: Joi.number().min(0),
      deliveryRange: Joi.number().integer().min(500).max(20000),
      deliveryTime: Joi.number().integer().min(1).max(240),
      packingFee: Joi.number().min(0),
    }).min(1),
  }),
  asyncHandler(async (req, res) => {
    await merchantService.setStoreDelivery(
      req.user!.userId,
      Number(req.params.id),
      req.body,
    );
    success(res, null, '配送配置已更新');
  }),
);

merchantScope.patch(
  '/stores/:id/status',
  validate({
    params: idParam,
    body: Joi.object({
      status: Joi.string().valid('OPEN', 'CLOSED', 'SUSPENDED').required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    await merchantService.switchStoreStatus(
      req.user!.userId,
      Number(req.params.id),
      req.body.status,
    );
    success(res, null, '营业状态已切换');
  }),
);

merchantScope.put(
  '/stores/:id/printer',
  validate({
    params: idParam,
    body: Joi.object({
      printerConfig: Joi.object().required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    await merchantService.setStorePrinter(
      req.user!.userId,
      Number(req.params.id),
      req.body.printerConfig,
    );
    success(res, null, '打印配置已更新');
  }),
);

merchantScope.put(
  '/stores/:id/announcement',
  validate({
    params: idParam,
    body: Joi.object({ announcement: Joi.string().max(512).allow('').required() }),
  }),
  asyncHandler(async (req, res) => {
    await merchantService.setStoreAnnouncement(
      req.user!.userId,
      Number(req.params.id),
      req.body.announcement,
    );
    success(res, null, '公告已更新');
  }),
);

merchantScope.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const data = await merchantService.getMerchantDashboard(req.user!.userId);
    success(res, data);
  }),
);

// ========== 用户端开放接口（无需商家鉴权） ==========

router.get(
  '/nearby',
  tokenAuth({ optional: true }),
  paginate(),
  validate({
    query: Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required(),
      distance: Joi.number().integer().min(500).max(20000).optional(),
      keyword: Joi.string().max(64).allow('').optional(),
      category: Joi.string().max(64).allow('').optional(),
      sortBy: Joi.string().valid('distance', 'sales', 'rating').optional(),
      sortOrder: Joi.string().valid('asc', 'desc').optional(),
      page: Joi.number().integer().min(1).optional(),
      pageSize: Joi.number().integer().min(1).max(100).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.pagination!;
    const data = await merchantService.getNearbyStores({
      lat: Number(req.query.lat),
      lng: Number(req.query.lng),
      radius: req.query.distance ? Number(req.query.distance) : undefined,
      keyword: req.query.keyword as string | undefined,
      sortBy: (req.query.sortBy as 'distance' | 'sales' | 'rating') ?? 'distance',
      page,
      pageSize,
    });
    paginated(res, data);
  }),
);

router.get(
  '/stores/:id/detail',
  tokenAuth({ optional: true }),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const data = await merchantService.getPublicStoreDetail(Number(req.params.id));
    success(res, data);
  }),
);

// 将商家作用域挂到根路由
router.use('/', merchantScope);

export default router;
