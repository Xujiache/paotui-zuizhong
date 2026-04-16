export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_SORT_ORDER = 'desc' as const;

export const TOKEN_BLACKLIST_PREFIX = 'token:blacklist';
export const SMS_CODE_PREFIX = 'sms:code:';
export const SMS_LIMIT_PREFIX = 'sms:limit:';
export const RATE_LIMIT_PREFIX = 'ratelimit:';
export const IDEMPOTENT_PREFIX = 'idempotent:';

export const PASSWORD_SALT_ROUNDS = 10;

export const CLIENT_TYPES = ['miniapp', 'wxapp', 'merchant-app', 'rider-app', 'admin-web'] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];
