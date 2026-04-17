import { Router } from 'express';
import Joi from 'joi';
import { tokenAuth, userOnly, merchantOnly } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { paginate } from '../middleware/pagination';
import { asyncHandler } from '../middleware/errorHandler';
import { success, paginated } from '../middleware/responseFormatter';
import * as aftersaleService from '../services/aftersale.service';

const router = Router();

const idParam = Joi.object({ id: Joi.number().integer().positive().required() });

router.post(
  '/refund',
  tokenAuth(),
  userOnly,
  validate({
    body: Joi.object({
      orderId: Joi.number().integer().positive().required(),
      type: Joi.string().valid('REFUND', 'CANCEL').optional(),
      reason: Joi.string().max(512).required(),
      description: Joi.string().max(1000).allow(''),
      images: Joi.array().items(Joi.string().max(512)).optional(),
      refundAmountFen: Joi.number().integer().min(1).required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await aftersaleService.userSubmitRefund(
      req.user!.userId,
      req.body,
    );
    success(res, data, '退款申请已提交', 201);
  }),
);

router.post(
  '/complaints',
  tokenAuth(),
  validate({
    body: Joi.object({
      orderId: Joi.number().integer().positive().allow(null).optional(),
      complainantType: Joi.string().valid('USER', 'MERCHANT', 'RIDER').required(),
      targetType: Joi.string().valid('MERCHANT', 'RIDER', 'PLATFORM').required(),
      targetId: Joi.number().integer().positive().allow(null).optional(),
      type: Joi.string().max(64).required(),
      description: Joi.string().max(1000).required(),
      images: Joi.array().items(Joi.string().max(512)).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await aftersaleService.submitComplaint(
      req.user!.userId,
      req.body,
    );
    success(res, data, '投诉已提交', 201);
  }),
);

router.get(
  '/aftersales',
  tokenAuth(),
  userOnly,
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
    const data = await aftersaleService.listUserAftersales(
      req.user!.userId,
      req.query.status as string | undefined,
      page,
      pageSize,
    );
    paginated(res, data);
  }),
);

router.get(
  '/merchant-aftersales',
  tokenAuth(),
  merchantOnly,
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
    const data = await aftersaleService.listMerchantAftersalesPage(
      req.user!.userId,
      req.query.status as string | undefined,
      page,
      pageSize,
    );
    paginated(res, data);
  }),
);

router.get(
  '/aftersales/:id',
  tokenAuth(),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const data = await aftersaleService.getAftersaleDetail(Number(req.params.id));
    success(res, data);
  }),
);

router.post(
  '/aftersales/:id/merchant-handle',
  tokenAuth(),
  merchantOnly,
  validate({
    params: idParam,
    body: Joi.object({
      action: Joi.string().valid('AGREE', 'REJECT').required(),
      remark: Joi.string().max(512).allow(''),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await aftersaleService.merchantHandleAftersale(
      req.user!.userId,
      Number(req.params.id),
      req.body.action,
      req.body.remark ?? '',
    );
    success(res, data);
  }),
);

router.post(
  '/aftersales/:id/refund',
  tokenAuth(),
  asyncHandler(async (req, res) => {
    const data = await aftersaleService.executeRefund(Number(req.params.id));
    success(res, data, '退款已执行');
  }),
);

// 退款回调（无鉴权）
router.post(
  '/refund/callback',
  validate({
    body: Joi.object({
      aftersaleNo: Joi.string().required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await aftersaleService.handleRefundCallback(req.body.aftersaleNo);
    success(res, data);
  }),
);

router.post(
  '/merchant-exception',
  tokenAuth(),
  merchantOnly,
  validate({
    body: Joi.object({
      orderId: Joi.number().integer().positive().required(),
      reason: Joi.string().max(256).required(),
      description: Joi.string().max(1000).allow(''),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await aftersaleService.merchantReportException(
      req.user!.userId,
      req.body,
    );
    success(res, data, '异常已上报');
  }),
);

export default router;
