import { Router } from 'express';
import Joi from 'joi';
import { tokenAuth, userOnly } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { paginate } from '../middleware/pagination';
import { asyncHandler } from '../middleware/errorHandler';
import { success, paginated } from '../middleware/responseFormatter';
import * as couponService from '../services/coupon.service';

const router = Router();

const idParam = Joi.object({ id: Joi.number().integer().positive().required() });

router.get(
  '/available',
  tokenAuth(),
  userOnly,
  paginate(),
  validate({
    query: Joi.object({
      storeId: Joi.number().integer().positive().optional(),
      page: Joi.number().integer().optional(),
      pageSize: Joi.number().integer().optional(),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.pagination!;
    const data = await couponService.getAvailableCoupons(
      req.user!.userId,
      req.query.storeId ? Number(req.query.storeId) : undefined,
      page,
      pageSize,
    );
    paginated(res, data);
  }),
);

router.post(
  '/:id/claim',
  tokenAuth(),
  userOnly,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const data = await couponService.claimCoupon(
      req.user!.userId,
      Number(req.params.id),
    );
    success(res, data, '已领取');
  }),
);

export default router;
