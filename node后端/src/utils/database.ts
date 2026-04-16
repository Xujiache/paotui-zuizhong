import mysql, { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { databaseConfig } from '../config/database';
import logger from './logger';

export const pool: Pool = mysql.createPool({
  host: databaseConfig.host,
  port: databaseConfig.port,
  user: databaseConfig.user,
  password: databaseConfig.password,
  database: databaseConfig.database,
  waitForConnections: true,
  connectionLimit: databaseConfig.poolMax,
  queueLimit: 0,
  charset: databaseConfig.charset,
  timezone: databaseConfig.timezone,
  dateStrings: false,
  supportBigNumbers: true,
});

export type QueryParams = (string | number | boolean | Date | null | Buffer)[] | undefined;

export const testConnection = async (): Promise<boolean> => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    logger.info('数据库连接成功');
    return true;
  } catch (error) {
    const err = error as Error;
    logger.error(`数据库连接失败: ${err.message}`);
    return false;
  }
};

export const query = async <T extends RowDataPacket[]>(
  sql: string,
  params?: QueryParams,
): Promise<T> => {
  const [rows] = await pool.execute<T>(sql, params);
  return rows;
};

export const queryOne = async <T extends RowDataPacket>(
  sql: string,
  params?: QueryParams,
): Promise<T | null> => {
  const rows = await query<T[]>(sql, params);
  return rows.length > 0 ? (rows[0] as T) : null;
};

export const execute = async (sql: string, params?: QueryParams): Promise<ResultSetHeader> => {
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return result;
};

export const transaction = async <T>(
  handler: (conn: PoolConnection) => Promise<T>,
): Promise<T> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await handler(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

export const closePool = async (): Promise<void> => {
  await pool.end();
  logger.info('数据库连接池已关闭');
};

export default { pool, query, queryOne, execute, transaction, testConnection, closePool };
