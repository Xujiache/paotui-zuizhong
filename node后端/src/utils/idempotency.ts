/**
 * 幂等工具：基于 Redis SETNX 实现简易幂等键
 *
 * 用法：
 *   const token = await acquireIdempotency('payment:' + paymentNo, 300);
 *   if (!token) throw AppError.duplicate('重复请求');
 *   try { ... } finally { await releaseIdempotency(token); }
 */

import { redisClient } from './redis';
import { redisConfig } from '../config/redis';
import crypto from 'crypto';

const buildKey = (key: string): string => `${redisConfig.keyPrefix}idempotent:${key}`;

export interface IdempotencyToken {
  key: string;
  value: string;
}

/** 尝试获取幂等锁。成功返回 token；失败（重复）返回 null */
export const acquireIdempotency = async (
  key: string,
  ttlSeconds: number,
): Promise<IdempotencyToken | null> => {
  const fullKey = buildKey(key);
  const value = crypto.randomBytes(8).toString('hex');
  const set = await redisClient.set(fullKey, value, { NX: true, EX: ttlSeconds });
  if (set !== 'OK') return null;
  return { key: fullKey, value };
};

/** 释放幂等锁（只在 value 一致时释放，避免误删） */
export const releaseIdempotency = async (token: IdempotencyToken): Promise<void> => {
  const current = await redisClient.get(token.key);
  if (current === token.value) {
    await redisClient.del(token.key);
  }
};

/** 检查幂等键是否已存在（不加锁，只查询） */
export const checkIdempotency = async (key: string): Promise<boolean> => {
  const val = await redisClient.get(buildKey(key));
  return val !== null;
};
