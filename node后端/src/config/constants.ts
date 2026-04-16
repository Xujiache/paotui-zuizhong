export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_SORT_ORDER: 'asc' | 'desc' = 'desc';

export const TOKEN_ACCESS_PREFIX = 'token:access';
export const TOKEN_REFRESH_PREFIX = 'token:refresh';
export const TOKEN_BLACKLIST_KEY = 'token:blacklist';

export const SMS_CODE_PREFIX = 'sms:code';
export const SMS_LIMIT_PREFIX = 'sms:limit';
export const SMS_DAILY_PREFIX = 'sms:daily';

export const RATE_LIMIT_PREFIX = 'ratelimit';
export const IDEMPOTENT_PREFIX = 'idempotent';
export const CONFIG_CACHE_PREFIX = 'config';

export const PASSWORD_SALT_ROUNDS = 10;

export const CLIENT_TYPES = ['miniapp', 'wxapp', 'merchant-app', 'rider-app', 'admin-web'] as const;
export type ClientTypeLiteral = (typeof CLIENT_TYPES)[number];

export const ORDER_NO_PREFIXES = {
  PRODUCT: 'P',
  ERRAND: 'E',
  PAYMENT: 'PAY',
  AFTERSALE: 'AS',
  SETTLEMENT: 'ST',
  WITHDRAWAL: 'WD',
  COMPLAINT: 'CP',
};

export const SUPER_ADMIN_ROLE_CODE = 'SUPER_ADMIN';
