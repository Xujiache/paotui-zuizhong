import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config';
import { JwtPayload } from '../types';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface JwtPayloadWithJti extends JwtPayload {
  jti?: string;
}

const buildJti = (): string => crypto.randomBytes(8).toString('hex');

export const signAccessToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  const body: JwtPayloadWithJti = { ...payload, jti: buildJti() };
  return jwt.sign(body as object, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresSeconds,
  });
};

export const signRefreshToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  const body: JwtPayloadWithJti = { ...payload, jti: buildJti() };
  return jwt.sign(body as object, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresSeconds,
  });
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

export const signTokenPair = (payload: Omit<JwtPayload, 'iat' | 'exp'>): TokenPair => {
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  return {
    accessToken,
    refreshToken,
    expiresIn: config.jwt.accessExpiresSeconds,
  };
};

export const decodeTokenUnsafe = (token: string): JwtPayload | null => {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === 'string') return null;
  return decoded as JwtPayload;
};
