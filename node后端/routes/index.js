const express = require('express');
const router = express.Router();
const mobileRoutes = require('./mobile/index');
const adminRoutes = require('./admin/index');
const { success } = require('../utils/response');

/**
 * 注册所有路由
 * @param {Express.Application} app - Express应用实例
 */
const registerRoutes = (app) => {
  // 健康检查路由
  router.get('/health', (req, res) => {
    success(res, { status: 'ok' }, 'Server is running');
  });

  // API版本路由
  router.use('/api/v1/mobile', mobileRoutes);
  router.use('/api/v1/admin', adminRoutes);

  // 将路由注册到应用
  app.use(router);

  return app;
};

module.exports = registerRoutes; 