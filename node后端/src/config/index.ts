import dotenv from 'dotenv';
import path from 'path';
import { databaseConfig } from './database';
import { redisConfig } from './redis';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  server: {
    port: parseInt(process.env.APP_PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
    name: process.env.APP_NAME || 'o2o-delivery',
  },

  database: databaseConfig,
  redis: redisConfig,

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '2h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    accessExpiresSeconds: 2 * 60 * 60,
    refreshExpiresSeconds: 7 * 24 * 60 * 60,
  },

  wx: {
    miniAppId: process.env.WX_MINI_APP_ID || '',
    miniAppSecret: process.env.WX_MINI_APP_SECRET || '',
  },

  sms: {
    accessKeyId: process.env.SMS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET || '',
    signName: process.env.SMS_SIGN_NAME || '',
    templateCodeVerify: process.env.SMS_TEMPLATE_CODE_VERIFY || '',
    mock: process.env.SMS_MOCK === 'true' || process.env.NODE_ENV === 'development',
    mockCode: process.env.SMS_MOCK_CODE || '123456',
    codeTtl: 5 * 60,
    limitTtl: 60,
    dailyLimit: 10,
  },

  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760', 10),
    allowedTypes: (
      process.env.UPLOAD_ALLOWED_TYPES || 'image/jpeg,image/png,image/gif,image/webp'
    ).split(','),
    urlPrefix: process.env.UPLOAD_URL_PREFIX || '/uploads',
  },

  log: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
    dir: process.env.LOG_DIR || './logs',
  },

  rateLimit: {
    globalWindowMs: 60 * 1000,
    globalMax: 60,
    authWindowMs: 60 * 1000,
    authMax: 10,
  },
} as const;

export type AppConfig = typeof config;
export default config;
