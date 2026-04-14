const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config();

module.exports = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
  },
  
  // 数据库配置
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || '20250525',
    password: process.env.DB_PASSWORD || 'mD43JwxxDK8yDmmh',
    database: process.env.DB_NAME || '20250525',
  },
  
  // Redis配置
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
  },
  
  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'mD43JwxxDK8yDmmh',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    mobileSecret: process.env.JWT_MOBILE_SECRET || 'mD43JwxxDK8yDmmh_mobile',
    adminSecret: process.env.JWT_ADMIN_SECRET || 'mD43JwxxDK8yDmmh_admin',
  },
}; 