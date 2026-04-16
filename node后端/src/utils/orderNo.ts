import crypto from 'crypto';

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}${second}`;
};

export const generateOrderNo = (prefix: string = 'ORD'): string => {
  const datePart = formatDate(new Date());
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}${datePart}${randomPart}`;
};

export const generateProductOrderNo = (): string => generateOrderNo('P');
export const generateErrandOrderNo = (): string => generateOrderNo('E');
export const generatePaymentNo = (): string => generateOrderNo('PAY');
export const generateAftersaleNo = (): string => generateOrderNo('AS');
export const generateSettlementNo = (): string => generateOrderNo('ST');
export const generateWithdrawalNo = (): string => generateOrderNo('WD');
export const generateComplaintNo = (): string => generateOrderNo('CP');
