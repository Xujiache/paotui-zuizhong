import crypto from 'crypto';

export const generateOrderNo = (prefix: string = 'ORD'): string => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timePart = now.toISOString().slice(11, 19).replace(/:/g, '');
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}${datePart}${timePart}${randomPart}`;
};

export const maskPhone = (phone: string): string => {
  if (phone.length < 7) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
};

export const maskIdCard = (idCard: string): string => {
  if (idCard.length < 8) return idCard;
  return idCard.slice(0, 4) + '**********' + idCard.slice(-4);
};

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
