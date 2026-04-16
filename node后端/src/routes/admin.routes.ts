import { Router } from 'express';
import Joi from 'joi';
import { tokenAuth, adminOnly } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { paginate } from '../middleware/pagination';
import { asyncHandler } from '../middleware/errorHandler';
import { success, paginated } from '../middleware/responseFormatter';
import * as merchantService from '../services/merchant.service';
import * as riderService from '../services/rider.service';
import * as aftersaleService from '../services/aftersale.service';
import * as settlementService from '../services/settlement.service';

const router = Router();
router.use(tokenAuth(), adminOnly);

const idParam = Joi.object({ id: Joi.number().integer().positive().required() });

// ========== 商家管理 ==========

router.get(
  '/merchants',
  paginate(),
  validate({
    query: Joi.object({
      keyword: Joi.string().max(64).allow('').optional(),
      status: Joi.string().valid('PENDING', 'ACTIVE', 'FROZEN', 'REJECTED').optional(),
      auditStatus: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED').optional(),
      page: Joi.number().integer().min(1).optional(),
      pageSize: Joi.number().integer().min(1).max(100).optional(),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().valid('asc', 'desc').optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.pagination!;
    const data = await merchantService.adminListMerchants({
      keyword: req.query.keyword as string | undefined,
      status: req.query.status as string | undefined,
      auditStatus: req.query.auditStatus as string | undefined,
      page,
      pageSize,
    });
    paginated(res, data);
  }),
);

router.get(
  '/merchants/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const data = await merchantService.adminGetMerchant(Number(req.params.id));
    success(res, data);
  }),
);

router.post(
  '/merchants/:id/audit',
  validate({
    params: idParam,
    body: Joi.object({
      action: Joi.string().valid('APPROVE', 'REJECT').required(),
      remark: Joi.string().max(512).allow('').optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await merchantService.adminAuditMerchant(
      Number(req.params.id),
      req.body,
      req.user!.userId,
    );
    success(res, data, '审核完成');
  }),
);

router.patch(
  '/merchants/:id/status',
  validate({
    params: idParam,
    body: Joi.object({
      status: Joi.string().valid('ACTIVE', 'FROZEN').required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await merchantService.adminSetMerchantStatus(
      Number(req.params.id),
      req.body.status,
      req.user!.userId,
    );
    success(res, data, '状态已变更');
  }),
);

// ========== 骑手管理 ==========

router.get(
  '/riders',
  paginate(),
  validate({
    query: Joi.object({
      keyword: Joi.string().max(64).allow('').optional(),
      status: Joi.string().valid('PENDING', 'ACTIVE', 'FROZEN', 'REJECTED').optional(),
      auditStatus: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED').optional(),
      onlineStatus: Joi.string().valid('ONLINE', 'OFFLINE', 'BUSY').optional(),
      page: Joi.number().integer().min(1).optional(),
      pageSize: Joi.number().integer().min(1).max(100).optional(),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().valid('asc', 'desc').optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.pagination!;
    const data = await riderService.adminListRiders({
      keyword: req.query.keyword as string | undefined,
      status: req.query.status as string | undefined,
      auditStatus: req.query.auditStatus as string | undefined,
      onlineStatus: req.query.onlineStatus as string | undefined,
      page,
      pageSize,
    });
    paginated(res, data);
  }),
);

router.get(
  '/riders/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const data = await riderService.adminGetRider(Number(req.params.id));
    success(res, data);
  }),
);

router.post(
  '/riders/:id/audit',
  validate({
    params: idParam,
    body: Joi.object({
      action: Joi.string().valid('APPROVE', 'REJECT').required(),
      remark: Joi.string().max(512).allow('').optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await riderService.adminAuditRider(
      Number(req.params.id),
      req.body.action,
      req.body.remark ?? '',
      req.user!.userId,
    );
    success(res, data, '审核完成');
  }),
);

router.patch(
  '/riders/:id/status',
  validate({
    params: idParam,
    body: Joi.object({
      status: Joi.string().valid('ACTIVE', 'FROZEN').required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await riderService.adminSetRiderStatus(
      Number(req.params.id),
      req.body.status,
      req.user!.userId,
    );
    success(res, data, '状态已变更');
  }),
);

// ========== 售后管理 ==========

router.get(
  '/aftersales',
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
    const data = await aftersaleService.adminListAftersales(
      req.query.status as string | undefined,
      page,
      pageSize,
    );
    paginated(res, data);
  }),
);

router.post(
  '/aftersales/:id/handle',
  validate({
    params: idParam,
    body: Joi.object({
      action: Joi.string().valid('APPROVE', 'REJECT').required(),
      remark: Joi.string().max(512).allow(''),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await aftersaleService.adminHandleAftersale(
      req.user!.userId,
      Number(req.params.id),
      req.body.action,
      req.body.remark ?? '',
    );
    success(res, data);
  }),
);

router.get(
  '/complaints',
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
    const data = await aftersaleService.adminListComplaints(
      req.query.status as string | undefined,
      page,
      pageSize,
    );
    paginated(res, data);
  }),
);

router.post(
  '/complaints/:id/handle',
  validate({
    params: idParam,
    body: Joi.object({ handleResult: Joi.string().max(1000).required() }),
  }),
  asyncHandler(async (req, res) => {
    const data = await aftersaleService.adminHandleComplaint(
      req.user!.userId,
      Number(req.params.id),
      req.body.handleResult,
    );
    success(res, data);
  }),
);

// ========== 结算与提现管理 ==========

router.get(
  '/settlements',
  paginate(),
  validate({
    query: Joi.object({
      targetType: Joi.string().valid('MERCHANT', 'RIDER').optional(),
      status: Joi.string().optional(),
      page: Joi.number().integer().optional(),
      pageSize: Joi.number().integer().optional(),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.pagination!;
    const data = await settlementService.adminListSettlements({
      targetType: req.query.targetType as 'MERCHANT' | 'RIDER' | undefined,
      status: req.query.status as string | undefined,
      page,
      pageSize,
    });
    paginated(res, data);
  }),
);

router.get(
  '/withdrawals',
  paginate(),
  validate({
    query: Joi.object({
      targetType: Joi.string().valid('MERCHANT', 'RIDER').optional(),
      status: Joi.string().optional(),
      page: Joi.number().integer().optional(),
      pageSize: Joi.number().integer().optional(),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.pagination!;
    const data = await settlementService.adminListWithdrawals({
      targetType: req.query.targetType as 'MERCHANT' | 'RIDER' | undefined,
      status: req.query.status as string | undefined,
      page,
      pageSize,
    });
    paginated(res, data);
  }),
);

router.post(
  '/withdrawals/:id/audit',
  validate({
    params: idParam,
    body: Joi.object({
      action: Joi.string().valid('APPROVE', 'REJECT').required(),
      remark: Joi.string().max(512).allow(''),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await settlementService.adminAuditWithdrawal(
      Number(req.params.id),
      req.user!.userId,
      req.body.action,
      req.body.remark ?? '',
    );
    success(res, data);
  }),
);

export default router;
