import { Router } from 'express';
import Joi from 'joi';
import { tokenAuth, riderOnly } from '../middleware/auth';
import { validate, phoneSchema } from '../middleware/validator';
import { asyncHandler } from '../middleware/errorHandler';
import { success } from '../middleware/responseFormatter';
import * as riderService from '../services/rider.service';

const router = Router();
router.use(tokenAuth(), riderOnly);

router.post(
  '/apply',
  validate({
    body: Joi.object({
      name: Joi.string().max(32).optional(),
      avatar: Joi.string().max(512).allow(''),
      idCardNo: Joi.string().max(64).optional(),
      idCardFront: Joi.string().max(512).optional(),
      idCardBack: Joi.string().max(512).optional(),
      healthCert: Joi.string().max(512).optional(),
      vehicleType: Joi.string().valid('BICYCLE', 'ELECTRIC', 'MOTORCYCLE').optional(),
      vehicleNo: Joi.string().max(32).allow(''),
      emergencyContact: Joi.string().max(32).allow(''),
      emergencyPhone: phoneSchema.allow(''),
    }).min(1),
  }),
  asyncHandler(async (req, res) => {
    const data = await riderService.submitApply(req.user!.userId, req.body);
    success(res, data, '已提交审核');
  }),
);

router.get(
  '/audit-status',
  asyncHandler(async (req, res) => {
    const data = await riderService.getAuditStatus(req.user!.userId);
    success(res, data);
  }),
);

router.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const data = await riderService.getProfile(req.user!.userId);
    success(res, data);
  }),
);

router.put(
  '/profile',
  validate({
    body: Joi.object({
      name: Joi.string().max(32),
      avatar: Joi.string().max(512).allow(''),
      vehicleType: Joi.string().valid('BICYCLE', 'ELECTRIC', 'MOTORCYCLE'),
      vehicleNo: Joi.string().max(32).allow(''),
      emergencyContact: Joi.string().max(32).allow(''),
      emergencyPhone: phoneSchema.allow(''),
    }).min(1),
  }),
  asyncHandler(async (req, res) => {
    const data = await riderService.updateProfile(req.user!.userId, req.body);
    success(res, data);
  }),
);

router.patch(
  '/online-status',
  validate({
    body: Joi.object({
      status: Joi.string().valid('ONLINE', 'OFFLINE', 'BUSY').required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await riderService.switchOnlineStatus(req.user!.userId, req.body.status);
    success(res, data, '在线状态已更新');
  }),
);

router.post(
  '/location',
  validate({
    body: Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required(),
      speed: Joi.number().min(0).optional(),
      direction: Joi.number().min(0).max(360).optional(),
      accuracy: Joi.number().min(0).optional(),
      orderId: Joi.number().integer().positive().allow(null).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await riderService.reportLocation(req.user!.userId, req.body);
    success(res, data);
  }),
);

router.get(
  '/accept-settings',
  asyncHandler(async (req, res) => {
    const data = await riderService.getAcceptSettings(req.user!.userId);
    success(res, data);
  }),
);

router.put(
  '/accept-settings',
  validate({
    body: Joi.object({
      acceptRadius: Joi.number().integer().min(500).max(20000),
      acceptOrderTypes: Joi.array().items(Joi.string().valid('PRODUCT', 'ERRAND')),
      serviceAreaId: Joi.number().integer().allow(null),
    }).min(1),
  }),
  asyncHandler(async (req, res) => {
    const data = await riderService.updateAcceptSettings(req.user!.userId, req.body);
    success(res, data);
  }),
);

router.get(
  '/tracks/:orderId',
  validate({
    params: Joi.object({ orderId: Joi.number().integer().positive().required() }),
  }),
  asyncHandler(async (req, res) => {
    const data = await riderService.getTracksByOrder(Number(req.params.orderId));
    success(res, { list: data });
  }),
);

router.get(
  '/income',
  asyncHandler(async (req, res) => {
    const data = await riderService.getRiderIncome(req.user!.userId);
    success(res, data);
  }),
);

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const data = await riderService.getRiderStats(req.user!.userId);
    success(res, data);
  }),
);

export default router;
