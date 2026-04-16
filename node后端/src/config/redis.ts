import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface RedisConfig {
  host: string;
  port: number;
  password: string;
  db: number;
  keyPrefix: string;
}

export const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || '',
  db: parseInt(process.env.REDIS_DB || '0', 10),
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'o2o:',
};
