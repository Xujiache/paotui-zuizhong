import { Router } from 'express';
import Joi from 'joi';
import { tokenAuth, merchantOnly, riderOnly } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { paginate } from '../middleware/pagination';
import { asyncHandler } from '../middleware/errorHandler';
import { success, paginated } from '../middleware/responseFormatter';
import * as settlementService from '../services/settlement.service';

const router = Router();

const idParam = Joi.object({ id: Joi.number().integer().positive().required() });

router.get(
  '/merchant-bills',
  tokenAuth(),
  merchantOnly,
  paginate(),
  validate({
    query: Joi.object({
      page: Joi.number().integer().optional(),
      pageSize: Joi.number().integer().optional(),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.pagination!;
    const data = await settlementService.listMerchantBills(
      req.user!.userId,
      page,
      pageSize,
    );
    paginated(res, data);
  }),
);

router.get(
  '/rider-bills',
  tokenAuth(),
  riderOnly,
  paginate(),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.pagination!;
    const data = await settlementService.listRiderBills(
      req.user!.userId,
      page,
      pageSize,
    );
    paginated(res, data);
  }),
);

router.get(
  '/bills/:id',
  tokenAuth(),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const data = await settlementService.getBillDetail(Number(req.params.id));
    success(res, data);
  }),
);

router.get(
  '/balance',
  tokenAuth(),
  asyncHandler(async (req, res) => {
    const role = req.user!.role;
    if (role !== 'MERCHANT' && role !== 'RIDER') {
      res.status(403).json({
        code: 11003,
        message: '仅商家/骑手可查询余额',
        data: null,
      });
      return;
    }
    const data = await settlementService.getBalance(
      role as 'MERCHANT' | 'RIDER',
      req.user!.userId,
    );
    success(res, data);
  }),
);

router.post(
  '/withdraw',
  tokenAuth(),
  validate({
    body: Joi.object({
      amountFen: Joi.number().integer().min(100).required(),
      accountType: Joi.string().valid('WECHAT', 'BANK').required(),
      accountName: Joi.string().max(64).allow(''),
      accountNo: Joi.string().max(64).allow(''),
      bankName: Joi.string().max(64).allow(''),
    }),
  }),
  asyncHandler(async (req, res) => {
    const role = req.user!.role;
    if (role !== 'MERCHANT' && role !== 'RIDER') {
      res.status(403).json({
        code: 11003,
        message: '仅商家/骑手可申请提现',
        data: null,
      });
      return;
    }
    const data = await settlementService.applyWithdraw({
      targetType: role as 'MERCHANT' | 'RIDER',
      targetId: req.user!.userId,
      ...req.body,
    });
    success(res, data, '提现申请已提交');
  }),
);

router.get(
  '/withdrawals',
  tokenAuth(),
  paginate(),
  asyncHandler(async (req, res) => {
    const role = req.user!.role;
    if (role !== 'MERCHANT' && role !== 'RIDER') {
      res.status(403).json({
        code: 11003,
        message: '仅商家/骑手可查询提现记录',
        data: null,
      });
      return;
    }
    const { page, pageSize } = req.pagination!;
    const data = await settlementService.listMyWithdrawals(
      role as 'MERCHANT' | 'RIDER',
      req.user!.userId,
      page,
      pageSize,
    );
    paginated(res, data);
  }),
);

export default router;
