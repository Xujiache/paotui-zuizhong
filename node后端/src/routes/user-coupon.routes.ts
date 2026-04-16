import { Router } from 'express';
import Joi from 'joi';
import { tokenAuth, userOnly } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { paginate } from '../middleware/pagination';
import { asyncHandler } from '../middleware/errorHandler';
import { success, paginated } from '../middleware/responseFormatter';
import * as couponService from '../services/coupon.service';

const router = Router();
router.use(tokenAuth(), userOnly);

router.get(
  '/coupons',
  paginate(),
  validate({
    query: Joi.object({
      status: Joi.string().valid('UNUSED', 'USED', 'EXPIRED').optional(),
      page: Joi.number().integer().optional(),
      pageSize: Joi.number().integer().optional(),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.pagination!;
    const data = await couponService.getMyCoupons(
      req.user!.userId,
      req.query.status as string | undefined,
      page,
      pageSize,
    );
    paginated(res, data);
  }),
);

router.get(
  '/coupons/applicable',
  validate({
    query: Joi.object({
      storeId: Joi.number().integer().positive().required(),
      orderAmount: Joi.number().integer().min(0).required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await couponService.getApplicableForOrder(
      req.user!.userId,
      Number(req.query.storeId),
      Number(req.query.orderAmount),
    );
    success(res, data);
  }),
);

export default router;
