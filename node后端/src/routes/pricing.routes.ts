import { Router } from 'express';
import Joi from 'joi';
import { tokenAuth } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { asyncHandler } from '../middleware/errorHandler';
import { success } from '../middleware/responseFormatter';
import * as pricingService from '../services/pricing.service';

const router = Router();

router.post(
  '/product-order',
  tokenAuth(),
  validate({
    body: Joi.object({
      storeId: Joi.number().integer().positive().required(),
      items: Joi.array()
        .items(
          Joi.object({
            skuId: Joi.number().integer().positive().required(),
            quantity: Joi.number().integer().min(1).required(),
          }),
        )
        .min(1)
        .required(),
      deliveryLat: Joi.number().min(-90).max(90).required(),
      deliveryLng: Joi.number().min(-180).max(180).required(),
      couponRecordId: Joi.number().integer().allow(null).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    // 让预览价也能应用优惠券，前提是登录用户；未登录预览（不会发生，这里走 tokenAuth 必填）则不算折扣。
    const data = await pricingService.calculateProductOrder({
      ...req.body,
      userId: req.user?.userId ?? null,
    });
    success(res, data);
  }),
);

router.post(
  '/errand-estimate',
  tokenAuth({ optional: true }),
  validate({
    body: Joi.object({
      serviceType: Joi.string().valid('DELIVER', 'PICKUP', 'BUY', 'ERRAND').required(),
      pickupLat: Joi.number().min(-90).max(90).optional(),
      pickupLng: Joi.number().min(-180).max(180).optional(),
      deliveryLat: Joi.number().min(-90).max(90).required(),
      deliveryLng: Joi.number().min(-180).max(180).required(),
      itemWeight: Joi.number().min(0).optional(),
      floorInfo: Joi.string().max(32).allow(''),
      tipAmount: Joi.number().integer().min(0).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = pricingService.calculateErrandOrder(req.body);
    success(res, data);
  }),
);

router.post(
  '/errand-order',
  tokenAuth(),
  validate({
    body: Joi.object({
      serviceType: Joi.string().valid('DELIVER', 'PICKUP', 'BUY', 'ERRAND').required(),
      pickupLat: Joi.number().optional(),
      pickupLng: Joi.number().optional(),
      deliveryLat: Joi.number().required(),
      deliveryLng: Joi.number().required(),
      itemWeight: Joi.number().min(0).optional(),
      floorInfo: Joi.string().max(32).allow(''),
      tipAmount: Joi.number().integer().min(0).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = pricingService.calculateErrandOrder(req.body);
    success(res, data);
  }),
);

router.post(
  '/delivery-fee',
  tokenAuth(),
  validate({
    body: Joi.object({
      storeId: Joi.number().integer().positive().required(),
      deliveryLat: Joi.number().min(-90).max(90).required(),
      deliveryLng: Joi.number().min(-180).max(180).required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await pricingService.calculateDeliveryFee(
      req.body.storeId,
      req.body.deliveryLat,
      req.body.deliveryLng,
    );
    success(res, data);
  }),
);

export default router;
