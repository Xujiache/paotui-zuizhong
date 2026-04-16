import { Router } from 'express';
import Joi from 'joi';
import { tokenAuth, userOnly } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { asyncHandler } from '../middleware/errorHandler';
import { success } from '../middleware/responseFormatter';
import * as cartService from '../services/cart.service';

const router = Router();
router.use(tokenAuth(), userOnly);

const idParam = Joi.object({ id: Joi.number().integer().positive().required() });

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = await cartService.getCart(req.user!.userId);
    success(res, data);
  }),
);

router.post(
  '/items',
  validate({
    body: Joi.object({
      storeId: Joi.number().integer().positive().required(),
      productId: Joi.number().integer().positive().required(),
      skuId: Joi.number().integer().positive().required(),
      quantity: Joi.number().integer().min(1).default(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await cartService.addToCart(req.user!.userId, req.body);
    success(res, data, '已加入购物车', 201);
  }),
);

router.put(
  '/items/:id',
  validate({
    params: idParam,
    body: Joi.object({
      quantity: Joi.number().integer().min(1).required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await cartService.updateCartQuantity(
      req.user!.userId,
      Number(req.params.id),
      req.body.quantity,
    );
    success(res, data);
  }),
);

router.delete(
  '/items/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await cartService.removeCartItem(req.user!.userId, Number(req.params.id));
    success(res, null, '已移除');
  }),
);

router.delete(
  '/',
  validate({
    query: Joi.object({
      storeId: Joi.number().integer().positive().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    await cartService.clearCart(
      req.user!.userId,
      req.query.storeId ? Number(req.query.storeId) : undefined,
    );
    success(res, null, '已清空');
  }),
);

router.post(
  '/check',
  validate({
    body: Joi.object({
      storeId: Joi.number().integer().positive().required(),
      itemIds: Joi.array().items(Joi.number().integer().positive()).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await cartService.checkCart(req.user!.userId, req.body);
    success(res, data);
  }),
);

export default router;
