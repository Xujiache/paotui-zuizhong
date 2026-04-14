/**
 * 移动端路由索引文件
 * 集中管理所有移动端API路由
 */
const express = require('express');
const router = express.Router();
const { authMiddleware, USER_TYPES } = require('../../utils/jwt');
const { success } = require('../../utils/response');

// 示例路由 - 不需要认证
router.get('/public', (req, res) => {
  success(res, { message: '这是一个公开的移动端API' });
});

// 示例路由 - 需要移动端认证
router.get('/protected', authMiddleware(USER_TYPES.MOBILE), (req, res) => {
  success(res, { 
    message: '这是一个受保护的移动端API',
    user: req.user
  });
});

// 注册子路由模块
// 当实际开发时，取消注释并导入对应模块
/*
const authRoutes = require('./auth');
const userRoutes = require('./user');
const contentRoutes = require('./content');

// 认证相关路由
router.use('/auth', authRoutes);

// 用户信息路由
router.use('/user', userRoutes);

// 内容相关路由
router.use('/content', contentRoutes);
*/

module.exports = router; 