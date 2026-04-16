import jwt from 'jsonwebtoken';
import config from '../config';
import { JwtPayload } from '../types';
import { UserType } from '../types/enums';

const ACCESS_EXPIRES = 7200;
const REFRESH_EXPIRES = 604800;

export const generateAccessToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  return jwt.sign({ ...payload }, config.jwt.accessSecret, { expiresIn: ACCESS_EXPIRES });
};

export const generateRefreshToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  return jwt.sign({ ...payload }, config.jwt.refreshSecret, { expiresIn: REFRESH_EXPIRES });
};

export const verifyAccessToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, config.jwt.accessSecret) as JwtPayload;
  } catch {
    return null;
  }
};

export const verifyRefreshToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret) as JwtPayload;
  } catch {
    return null;
  }
};

export const generateTokenPair = (payload: { id: number; type: UserType; role?: string }) => {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  return { accessToken, refreshToken };
};
