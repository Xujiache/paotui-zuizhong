import { createClient, RedisClientType } from 'redis';
import { redisConfig } from '../config/redis';
import {
  TOKEN_ACCESS_PREFIX,
  TOKEN_REFRESH_PREFIX,
  TOKEN_BLACKLIST_KEY,
  SMS_CODE_PREFIX,
  SMS_LIMIT_PREFIX,
  SMS_DAILY_PREFIX,
  RATE_LIMIT_PREFIX,
  CONFIG_CACHE_PREFIX,
} from '../config/constants';
import logger from './logger';

const socketOptions: { host: string; port: number } = {
  host: redisConfig.host,
  port: redisConfig.port,
};

const clientOptions: {
  socket: typeof socketOptions;
  password?: string;
  database?: number;
} = { socket: socketOptions };

if (redisConfig.password && redisConfig.password.trim() !== '') {
  clientOptions.password = redisConfig.password;
}
if (redisConfig.db > 0) {
  clientOptions.database = redisConfig.db;
}

const rawClient: RedisClientType = createClient(clientOptions);

rawClient.on('error', (err: Error) => {
  logger.error(`Redis错误: ${err.message}`);
});

rawClient.on('reconnecting', () => {
  logger.warn('Redis正在重连...');
});

rawClient.on('ready', () => {
  logger.info('Redis就绪');
});

const buildKey = (key: string): string => `${redisConfig.keyPrefix}${key}`;

export const connectRedis = async (): Promise<boolean> => {
  try {
    if (!rawClient.isOpen) {
      await rawClient.connect();
    }
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
    if (rawClient.isOpen) {
      await rawClient.disconnect();
    }
    logger.info('Redis断开连接');
  } catch (error) {
    const err = error as Error;
    logger.error(`Redis断开连接失败: ${err.message}`);
  }
};

export const isRedisReady = (): boolean => rawClient.isReady;

export class RedisStore {
  async get(key: string): Promise<string | null> {
    return rawClient.get(buildKey(key));
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await rawClient.set(buildKey(key), value, { EX: ttlSeconds });
    } else {
      await rawClient.set(buildKey(key), value);
    }
  }

  async del(key: string): Promise<number> {
    return rawClient.del(buildKey(key));
  }

  async exists(key: string): Promise<boolean> {
    return (await rawClient.exists(buildKey(key))) > 0;
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const fullKey = buildKey(key);
    const count = await rawClient.incr(fullKey);
    if (count === 1 && ttlSeconds && ttlSeconds > 0) {
      await rawClient.expire(fullKey, ttlSeconds);
    }
    return count;
  }

  async sadd(key: string, member: string, ttlSeconds?: number): Promise<void> {
    const fullKey = buildKey(key);
    await rawClient.sAdd(fullKey, member);
    if (ttlSeconds && ttlSeconds > 0) {
      await rawClient.expire(fullKey, ttlSeconds);
    }
  }

  async sismember(key: string, member: string): Promise<boolean> {
    return rawClient.sIsMember(buildKey(key), member);
  }

  async setAccessToken(
    role: string,
    userId: number,
    token: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.set(`${TOKEN_ACCESS_PREFIX}:${role}:${userId}`, token, ttlSeconds);
  }

  async getAccessToken(role: string, userId: number): Promise<string | null> {
    return this.get(`${TOKEN_ACCESS_PREFIX}:${role}:${userId}`);
  }

  async setRefreshToken(
    role: string,
    userId: number,
    token: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.set(`${TOKEN_REFRESH_PREFIX}:${role}:${userId}`, token, ttlSeconds);
  }

  async getRefreshToken(role: string, userId: number): Promise<string | null> {
    return this.get(`${TOKEN_REFRESH_PREFIX}:${role}:${userId}`);
  }

  async delUserTokens(role: string, userId: number): Promise<void> {
    await this.del(`${TOKEN_ACCESS_PREFIX}:${role}:${userId}`);
    await this.del(`${TOKEN_REFRESH_PREFIX}:${role}:${userId}`);
  }

  async addToBlacklist(token: string, ttlSeconds: number): Promise<void> {
    await this.sadd(TOKEN_BLACKLIST_KEY, token, ttlSeconds);
  }

  async isBlacklisted(token: string): Promise<boolean> {
    return this.sismember(TOKEN_BLACKLIST_KEY, token);
  }

  async setSmsCode(phone: string, code: string, ttlSeconds: number): Promise<void> {
    await this.set(`${SMS_CODE_PREFIX}:${phone}`, code, ttlSeconds);
  }

  async getSmsCode(phone: string): Promise<string | null> {
    return this.get(`${SMS_CODE_PREFIX}:${phone}`);
  }

  async deleteSmsCode(phone: string): Promise<void> {
    await this.del(`${SMS_CODE_PREFIX}:${phone}`);
  }

  async setSmsLimit(phone: string, ttlSeconds: number): Promise<void> {
    await this.set(`${SMS_LIMIT_PREFIX}:${phone}`, '1', ttlSeconds);
  }

  async hasSmsLimit(phone: string): Promise<boolean> {
    return this.exists(`${SMS_LIMIT_PREFIX}:${phone}`);
  }

  async incrSmsDaily(phone: string, ttlSeconds: number): Promise<number> {
    return this.incr(`${SMS_DAILY_PREFIX}:${phone}`, ttlSeconds);
  }

  async incrementRateLimit(key: string, ttlSeconds: number): Promise<number> {
    return this.incr(`${RATE_LIMIT_PREFIX}:${key}`, ttlSeconds);
  }

  async setConfig(
    category: string,
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.set(`${CONFIG_CACHE_PREFIX}:${category}:${key}`, value, ttlSeconds);
  }

  async getConfig(category: string, key: string): Promise<string | null> {
    return this.get(`${CONFIG_CACHE_PREFIX}:${category}:${key}`);
  }

  async deleteConfig(category: string, key?: string): Promise<void> {
    if (key) {
      await this.del(`${CONFIG_CACHE_PREFIX}:${category}:${key}`);
    } else {
      await this.del(`${CONFIG_CACHE_PREFIX}:${category}`);
    }
  }
}

export const redis = new RedisStore();

export { rawClient as redisClient };

export default {
  redis,
  connectRedis,
  disconnectRedis,
  isRedisReady,
};
