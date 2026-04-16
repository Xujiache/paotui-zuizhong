import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  poolMin: number;
  poolMax: number;
  charset: string;
  timezone: string;
}

export const databaseConfig: DatabaseConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'o2o_dev',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'o2o_delivery',
  poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
  poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
  charset: 'utf8mb4',
  timezone: '+08:00',
};
