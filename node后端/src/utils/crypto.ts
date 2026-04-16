import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { PASSWORD_SALT_ROUNDS } from '../config/constants';

export const hashPassword = async (password: string): Promise<string> =>
  bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

export const comparePassword = async (password: string, hash: string): Promise<boolean> =>
  bcrypt.compare(password, hash);

export const randomSmsCode = (length = 6): string => {
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += digits[crypto.randomInt(0, 10)];
  }
  return code;
};

export const randomHex = (bytes = 16): string => crypto.randomBytes(bytes).toString('hex');

export const md5 = (text: string): string =>
  crypto.createHash('md5').update(text).digest('hex');
