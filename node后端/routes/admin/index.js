/**
 * 后台路由索引文件
 * 集中管理所有后台API路由
 */
const express = require('express');
const router = express.Router();
const { authMiddleware, USER_TYPES } = require('../../utils/jwt');
const { success } = require('../../utils/response');

// 示例路由 - 不需要认证
router.get('/public', (req, res) => {
  success(res, { message: '这是一个公开的后台API' });
});

// 示例路由 - 需要后台认证
router.get('/protected', authMiddleware(USER_TYPES.ADMIN), (req, res) => {
  success(res, { 
    message: '这是一个受保护的后台API',
    user: req.user
  });
});

// 注册子路由模块
// 当实际开发时，取消注释并导入对应模块
/*
const authRoutes = require('./auth');
const userRoutes = require('./users');
const roleRoutes = require('./roles');

// 认证相关路由
router.use('/auth', authRoutes);

// 用户管理路由
router.use('/users', userRoutes);

// 角色管理路由
router.use('/roles', roleRoutes);
*/

module.exports = router; 