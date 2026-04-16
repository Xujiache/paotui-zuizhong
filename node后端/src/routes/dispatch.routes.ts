import { Router } from 'express';
import Joi from 'joi';
import { tokenAuth, riderOnly, adminOnly } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { paginate } from '../middleware/pagination';
import { asyncHandler } from '../middleware/errorHandler';
import { success, paginated } from '../middleware/responseFormatter';
import * as dispatchService from '../services/dispatch.service';

const router = Router();

const idParam = Joi.object({ id: Joi.number().integer().positive().required() });

router.get(
  '/order-pool',
  tokenAuth(),
  riderOnly,
  paginate(),
  validate({
    query: Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required(),
      radius: Joi.number().integer().min(500).max(20000).optional(),
      orderType: Joi.string().valid('PRODUCT', 'ERRAND').optional(),
      page: Joi.number().integer().optional(),
      pageSize: Joi.number().integer().optional(),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.pagination!;
    const data = await dispatchService.getOrderPool({
      lat: Number(req.query.lat),
      lng: Number(req.query.lng),
      radius: req.query.radius ? Number(req.query.radius) : 5000,
      orderType: req.query.orderType as string | undefined,
      page,
      pageSize,
    });
    paginated(res, data);
  }),
);

router.post(
  '/orders/:id/grab',
  tokenAuth(),
  riderOnly,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const data = await dispatchService.grabOrder(
      req.user!.userId,
      Number(req.params.id),
    );
    success(res, data, '抢单成功');
  }),
);

router.post(
  '/orders/:id/expand',
  tokenAuth(),
  adminOnly,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const data = await dispatchService.expandRadius(Number(req.params.id));
    success(res, data);
  }),
);

router.post(
  '/orders/:id/assign',
  tokenAuth(),
  adminOnly,
  validate({
    params: idParam,
    body: Joi.object({ riderId: Joi.number().integer().positive().required() }),
  }),
  asyncHandler(async (req, res) => {
    const data = await dispatchService.adminAssignRider(
      Number(req.params.id),
      req.body.riderId,
      req.user!.userId,
    );
    success(res, data);
  }),
);

router.get(
  '/stats',
  tokenAuth(),
  adminOnly,
  asyncHandler(async (_req, res) => {
    const data = await dispatchService.getPoolStats();
    success(res, data);
  }),
);

export default router;
