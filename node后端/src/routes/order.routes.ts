import { Router } from 'express';
import Joi from 'joi';
import { tokenAuth, userOnly, merchantOnly, riderOnly } from '../middleware/auth';
import { validate, phoneSchema } from '../middleware/validator';
import { paginate } from '../middleware/pagination';
import { asyncHandler } from '../middleware/errorHandler';
import { success, paginated } from '../middleware/responseFormatter';
import * as orderService from '../services/order.service';

const router = Router();

const idParam = Joi.object({ id: Joi.number().integer().positive().required() });

// ========== 用户端 ==========

router.post(
  '/product-orders',
  tokenAuth(),
  userOnly,
  validate({
    body: Joi.object({
      storeId: Joi.number().integer().positive().required(),
      addressId: Joi.number().integer().positive().required(),
      items: Joi.array()
        .items(
          Joi.object({
            skuId: Joi.number().integer().positive().required(),
            quantity: Joi.number().integer().min(1).required(),
          }),
        )
        .min(1)
        .required(),
      remark: Joi.string().max(200).allow(''),
      couponRecordId: Joi.number().integer().allow(null).optional(),
      clearCartAfterCreate: Joi.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await orderService.userCreateProductOrder(req.user!.userId, req.body);
    success(res, data, '订单创建成功', 201);
  }),
);

router.post(
  '/errand-orders',
  tokenAuth(),
  userOnly,
  validate({
    body: Joi.object({
      serviceType: Joi.string().valid('DELIVER', 'PICKUP', 'BUY', 'ERRAND').required(),
      pickupAddress: Joi.string().max(256).allow(''),
      pickupLat: Joi.number().min(-90).max(90).optional(),
      pickupLng: Joi.number().min(-180).max(180).optional(),
      pickupContactName: Joi.string().max(32).allow(''),
      pickupContactPhone: phoneSchema.allow(''),
      deliveryAddressId: Joi.number().integer().positive().required(),
      itemDescription: Joi.string().max(500).allow(''),
      itemWeight: Joi.number().min(0).optional(),
      floorInfo: Joi.string().max(32).allow(''),
      hasElevator: Joi.boolean().optional(),
      budgetAmount: Joi.number().integer().min(0).optional(),
      tipAmount: Joi.number().integer().min(0).optional(),
      remark: Joi.string().max(200).allow(''),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await orderService.userCreateErrandOrder(req.user!.userId, req.body);
    success(res, data, '跑腿订单创建成功', 201);
  }),
);

router.get(
  '/orders',
  tokenAuth(),
  userOnly,
  paginate(),
  validate({
    query: Joi.object({
      status: Joi.string().optional(),
      orderType: Joi.string().valid('PRODUCT', 'ERRAND').optional(),
      page: Joi.number().integer().optional(),
      pageSize: Joi.number().integer().optional(),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.pagination!;
    const data = await orderService.listUserOrders(
      req.user!.userId,
      req.query.status as string | undefined,
      req.query.orderType as string | undefined,
      page,
      pageSize,
    );
    paginated(res, data);
  }),
);

router.get(
  '/orders/:id',
  tokenAuth(),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const data = await orderService.getOrderDetail(Number(req.params.id), {
      userId: req.user!.userId,
      role: String(req.user!.role),
    });
    success(res, data);
  }),
);

router.get(
  '/orders/:id/logs',
  tokenAuth(),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const data = await orderService.getOrderLogs(Number(req.params.id), {
      userId: req.user!.userId,
      role: String(req.user!.role),
    });
    success(res, { list: data });
  }),
);

router.post(
  '/orders/:id/cancel',
  tokenAuth(),
  userOnly,
  validate({
    params: idParam,
    body: Joi.object({ reason: Joi.string().max(256).allow('').optional() }),
  }),
  asyncHandler(async (req, res) => {
    const data = await orderService.userCancel(
      req.user!.userId,
      Number(req.params.id),
      req.body.reason,
    );
    success(res, data);
  }),
);

router.post(
  '/orders/:id/complete',
  tokenAuth(),
  userOnly,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const data = await orderService.userComplete(req.user!.userId, Number(req.params.id));
    success(res, data);
  }),
);

// ========== 商家端 ==========

router.post(
  '/orders/:id/merchant-accept',
  tokenAuth(),
  merchantOnly,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const data = await orderService.merchantAccept(
      req.user!.userId,
      Number(req.params.id),
    );
    success(res, data, '接单成功');
  }),
);

router.post(
  '/orders/:id/merchant-reject',
  tokenAuth(),
  merchantOnly,
  validate({
    params: idParam,
    body: Joi.object({ reason: Joi.string().max(256).required() }),
  }),
  asyncHandler(async (req, res) => {
    const data = await orderService.merchantReject(
      req.user!.userId,
      Number(req.params.id),
      req.body.reason,
    );
    success(res, data, '已拒单');
  }),
);

router.get(
  '/merchant-orders',
  tokenAuth(),
  merchantOnly,
  paginate(),
  validate({
    query: Joi.object({
      storeId: Joi.number().integer().positive().optional(),
      status: Joi.string().optional(),
      page: Joi.number().integer().optional(),
      pageSize: Joi.number().integer().optional(),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.pagination!;
    const data = await orderService.listMerchantOrders(
      req.user!.userId,
      req.query.storeId ? Number(req.query.storeId) : undefined,
      req.query.status as string | undefined,
      page,
      pageSize,
    );
    paginated(res, data);
  }),
);

// ========== 骑手端 ==========

router.post(
  '/orders/:id/pickup',
  tokenAuth(),
  riderOnly,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const data = await orderService.riderPickup(req.user!.userId, Number(req.params.id));
    success(res, data);
  }),
);

router.post(
  '/orders/:id/deliver',
  tokenAuth(),
  riderOnly,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const data = await orderService.riderDeliver(req.user!.userId, Number(req.params.id));
    success(res, data);
  }),
);

router.post(
  '/orders/:id/depart',
  tokenAuth(),
  riderOnly,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const data = await orderService.riderDepart(req.user!.userId, Number(req.params.id));
    success(res, data);
  }),
);

router.post(
  '/orders/:id/start-service',
  tokenAuth(),
  riderOnly,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const data = await orderService.riderStartService(
      req.user!.userId,
      Number(req.params.id),
    );
    success(res, data);
  }),
);

router.get(
  '/rider-orders',
  tokenAuth(),
  riderOnly,
  paginate(),
  validate({
    query: Joi.object({
      status: Joi.string().optional(),
      page: Joi.number().integer().optional(),
      pageSize: Joi.number().integer().optional(),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.pagination!;
    const data = await orderService.listRiderOrders(
      req.user!.userId,
      req.query.status as string | undefined,
      page,
      pageSize,
    );
    paginated(res, data);
  }),
);

// ========== 支付回调（无鉴权） ==========

router.post(
  '/payment/callback',
  validate({
    body: Joi.object({
      paymentNo: Joi.string().required(),
      transactionId: Joi.string().required(),
      amountFen: Joi.number().integer().min(0).required(),
      raw: Joi.string().allow('').optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await orderService.handlePaymentCallback(req.body);
    success(res, data);
  }),
);

/** 测试专用：用订单号获取支付号（没做真正的微信支付对接时做端到端验证用） */
router.get(
  '/payment/:orderNo',
  tokenAuth(),
  validate({ params: Joi.object({ orderNo: Joi.string().required() }) }),
  asyncHandler(async (req, res) => {
    const data = await orderService.getPaymentByOrderNo(req.params.orderNo, {
      userId: req.user!.userId,
      role: String(req.user!.role),
    });
    success(res, data);
  }),
);

export default router;
