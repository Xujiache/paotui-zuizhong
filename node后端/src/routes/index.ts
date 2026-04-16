import { Router, Application, Request, Response } from 'express';
import express from 'express';
import path from 'path';
import config from '../config';
import { success } from '../middleware/responseFormatter';
import { ErrorCode } from '../types/enums';
import { testConnection } from '../utils/database';
import { isRedisReady } from '../utils/redis';
import authRoutes from './auth.routes';
import commonRoutes from './common.routes';
import userRoutes from './user.routes';
import merchantRoutes from './merchant.routes';
import riderRoutes from './rider.routes';
import productRoutes from './product.routes';
import orderRoutes from './order.routes';
import pricingRoutes from './pricing.routes';
import dispatchRoutes from './dispatch.routes';
import aftersaleRoutes from './aftersale.routes';
import settlementRoutes from './settlement.routes';
import messageRoutes from './message.routes';
import configRoutes from './config.routes';
import riskRoutes from './risk.routes';
import adminRoutes from './admin.routes';

const router = Router();

const handleLegacyHealth = async (_req: Request, res: Response): Promise<void> => {
  const dbOk = await testConnection();
  const redisOk = isRedisReady();
  const payload = {
    status: dbOk && redisOk ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    dependencies: {
      database: dbOk ? 'connected' : 'disconnected',
      redis: redisOk ? 'connected' : 'disconnected',
    },
  };
  if (!dbOk || !redisOk) {
    res.status(503).json({
      code: ErrorCode.SERVER_ERROR,
      message: '部分依赖不可用',
      data: payload,
    });
    return;
  }
  success(res, payload, 'Server is running');
};

const registerRoutes = (app: Application): void => {
  const uploadAbs = path.isAbsolute(config.upload.dir)
    ? config.upload.dir
    : path.resolve(process.cwd(), config.upload.dir);
  app.use(config.upload.urlPrefix, express.static(uploadAbs));

  router.get('/api/v1/health', handleLegacyHealth);

  router.use('/api/v1/common', commonRoutes);
  router.use('/api/v1/auth', authRoutes);
  router.use('/api/v1/user', userRoutes);
  router.use('/api/v1/merchant', merchantRoutes);
  router.use('/api/v1/rider', riderRoutes);
  router.use('/api/v1/product', productRoutes);
  router.use('/api/v1/order', orderRoutes);
  router.use('/api/v1/pricing', pricingRoutes);
  router.use('/api/v1/dispatch', dispatchRoutes);
  router.use('/api/v1/aftersale', aftersaleRoutes);
  router.use('/api/v1/settlement', settlementRoutes);
  router.use('/api/v1/message', messageRoutes);
  router.use('/api/v1/config', configRoutes);
  router.use('/api/v1/risk', riskRoutes);
  router.use('/api/v1/admin', adminRoutes);

  app.use(router);
};

export default registerRoutes;
