import { createClient, RedisClientType } from 'redis';
import config from '../config';
import logger from './logger';

const redisConfig: { socket: { host: string; port: number }; password?: string; database?: number } =
  {
    socket: {
      host: config.redis.host,
      port: config.redis.port,
    },
  };

if (config.redis.password && config.redis.password.trim() !== '') {
  redisConfig.password = config.redis.password;
}

if (config.redis.db > 0) {
  redisConfig.database = config.redis.db;
}

const redisClient: RedisClientType = createClient(redisConfig);

export const connectRedis = async (): Promise<boolean> => {
  try {
    await redisClient.connect();
    logger.info('Redis连接成功');
    return true;
  } catch (error) {
    const err = error as Error;
    logger.error(`Redis连接失败: ${err.message}`);
    return false;
  }
};

export const disconnectRedis = async (): Promise<void> => {
  try {
    await redisClient.disconnect();
    logger.info('Redis断开连接');
  } catch (error) {
    const err = error as Error;
    logger.error(`Redis断开连接失败: ${err.message}`);
  }
};

redisClient.on('error', (err: Error) => {
  logger.error(`Redis错误: ${err.message}`);
});

export { redisClient };
export default { redisClient, connectRedis, disconnectRedis };
