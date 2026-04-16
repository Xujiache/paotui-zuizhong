const PHONE_REGEX = /^1[3-9]\d{9}$/;
const ID_CARD_REGEX = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[0-9Xx]$/;
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const USERNAME_REGEX = /^[A-Za-z][A-Za-z0-9_]{3,31}$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&_-]{6,32}$/;

export const isPhone = (value: unknown): value is string =>
  typeof value === 'string' && PHONE_REGEX.test(value);

export const isIdCard = (value: unknown): value is string =>
  typeof value === 'string' && ID_CARD_REGEX.test(value);

export const isEmail = (value: unknown): value is string =>
  typeof value === 'string' && EMAIL_REGEX.test(value);

export const isUrl = (value: unknown): value is string =>
  typeof value === 'string' && URL_REGEX.test(value);

export const isUsername = (value: unknown): value is string =>
  typeof value === 'string' && USERNAME_REGEX.test(value);

export const isStrongPassword = (value: unknown): value is string =>
  typeof value === 'string' && PASSWORD_REGEX.test(value);

export const isPositiveInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

export const isLatitude = (value: unknown): value is number =>
  typeof value === 'number' && value >= -90 && value <= 90;

export const isLongitude = (value: unknown): value is number =>
  typeof value === 'number' && value >= -180 && value <= 180;

export const isSmsCode = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4,6}$/.test(value);

export const assertPhone = (value: unknown, fieldName = 'phone'): string => {
  if (!isPhone(value)) {
    throw new Error(`${fieldName} 格式不正确`);
  }
  return value;
};
