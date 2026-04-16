import config from '../config';
import { redis } from '../utils/redis';
import { randomSmsCode } from '../utils/crypto';
import logger from '../utils/logger';
import { AppError } from '../utils/AppError';
import { ErrorCode, SmsScene } from '../types/enums';
import { isPhone } from '../utils/validate';

export const sendSmsCode = async (
  phone: string,
  scene: SmsScene | string,
): Promise<{ expireIn: number }> => {
  if (!isPhone(phone)) {
    throw new AppError(ErrorCode.PARAM_INVALID, '手机号格式不正确', 400, [
      { field: 'phone', message: '手机号格式不正确' },
    ]);
  }

  if (await redis.hasSmsLimit(phone)) {
    throw new AppError(ErrorCode.TOO_FREQUENT, '操作过于频繁，请稍后重试', 429);
  }

  const daily = await redis.incrSmsDaily(phone, 24 * 3600);
  if (daily > config.sms.dailyLimit) {
    throw new AppError(ErrorCode.DAILY_LIMIT_REACHED, '今日发送次数已达上限', 429);
  }

  const code = config.sms.mock ? config.sms.mockCode : randomSmsCode(6);

  await redis.setSmsCode(phone, code, config.sms.codeTtl);
  await redis.setSmsLimit(phone, config.sms.limitTtl);

  if (config.sms.mock) {
    logger.info(`[SMS-MOCK] phone=${phone} scene=${scene} code=${code}`);
  } else {
    await realSendSms(phone, code, String(scene));
  }

  return { expireIn: config.sms.codeTtl };
};

export const verifySmsCode = async (
  phone: string,
  code: string,
  options?: { consume?: boolean },
): Promise<void> => {
  const stored = await redis.getSmsCode(phone);
  if (!stored) {
    throw new AppError(ErrorCode.VERIFY_CODE_ERROR, '验证码已过期，请重新获取', 400);
  }
  if (stored !== code) {
    throw new AppError(ErrorCode.VERIFY_CODE_ERROR, '验证码错误', 400);
  }
  if (options?.consume !== false) {
    await redis.deleteSmsCode(phone);
  }
};

const realSendSms = async (phone: string, code: string, scene: string): Promise<void> => {
  try {
    logger.info(`[SMS] 发送短信 phone=${phone} scene=${scene} code=${code}`);
  } catch (error) {
    const err = error as Error;
    logger.error(`短信发送失败: ${err.message}`);
    throw new AppError(ErrorCode.SMS_SEND_FAILED, '短信发送失败，请稍后重试', 500);
  }
};
