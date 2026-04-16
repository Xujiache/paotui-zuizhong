import mysql, { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import config from '../config';
import logger from './logger';

const pool: Pool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  waitForConnections: true,
  connectionLimit: config.database.poolMax,
  queueLimit: 0,
  charset: 'utf8mb4',
});

export const testConnection = async (): Promise<boolean> => {
  try {
    const connection = await pool.getConnection();
    logger.info('数据库连接成功');
    connection.release();
    return true;
  } catch (error) {
    const err = error as Error;
    logger.error(`数据库连接失败: ${err.message}`);
    return false;
  }
};

export const query = async <T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: (string | number | boolean | null)[],
): Promise<T> => {
  const [rows] = await pool.execute<T>(sql, params);
  return rows;
};

export { pool };
export default { pool, query, testConnection };
