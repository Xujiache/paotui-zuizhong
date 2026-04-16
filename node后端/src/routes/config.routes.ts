import { Router } from 'express';
import Joi from 'joi';
import { tokenAuth } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { asyncHandler } from '../middleware/errorHandler';
import { success } from '../middleware/responseFormatter';
import * as configService from '../services/config.service';

const router = Router();

router.get(
  '/areas',
  tokenAuth({ optional: true }),
  validate({
    query: Joi.object({
      parentId: Joi.number().integer().min(0).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const list = await configService.getAreas(
      req.query.parentId !== undefined ? Number(req.query.parentId) : undefined,
    );
    success(res, { list });
  }),
);

router.get(
  '/banners',
  tokenAuth({ optional: true }),
  validate({
    query: Joi.object({
      position: Joi.string().max(32).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const list = await configService.getActiveBanners(
      req.query.position as string | undefined,
    );
    success(res, { list });
  }),
);

router.get(
  '/service-types',
  tokenAuth({ optional: true }),
  asyncHandler(async (_req, res) => {
    const list = await configService.getServiceTypes();
    success(res, { list });
  }),
);

export default router;
