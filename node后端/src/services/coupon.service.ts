import { AppError } from '../utils/AppError';
import { ErrorCode } from '../types/enums';
import {
  listAvailableCoupons,
  listUserCoupons,
  listApplicableCouponsForOrder,
  claimCoupon as claimCouponModel,
  findCouponById,
  CouponRow,
  CouponRecordRow,
} from '../models/coupon.model';
import { yuanToFen, readDecimal } from '../utils/money';

const parseJson = (v: unknown) => {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try {
    return typeof v === 'string' ? JSON.parse(v) : v;
  } catch {
    return v;
  }
};

const formatCoupon = (row: CouponRow & { claimed?: boolean }) => ({
  id: row.id,
  name: row.name,
  type: row.type,
  discountValue: readDecimal(row.discount_value),
  minAmount: yuanToFen(readDecimal(row.min_amount)),
  maxDiscount: yuanToFen(readDecimal(row.max_discount)),
  applicableType: row.applicable_type,
  applicableStores: parseJson(row.applicable_stores),
  totalCount: row.total_count,
  issuedCount: row.issued_count,
  usedCount: row.used_count,
  validDays: row.valid_days,
  validStart: row.valid_start,
  validEnd: row.valid_end,
  status: row.status,
  claimed: row.claimed ?? false,
});

const formatRecord = (row: CouponRecordRow & { coupon: CouponRow | null }) => ({
  couponRecordId: row.id,
  couponId: row.coupon_id,
  couponName: row.coupon?.name ?? '',
  type: row.coupon?.type ?? '',
  value: row.coupon ? readDecimal(row.coupon.discount_value) : 0,
  minAmount: row.coupon ? yuanToFen(readDecimal(row.coupon.min_amount)) : 0,
  scope: row.coupon?.applicable_type ?? 'ALL',
  status: row.status,
  validStart: row.valid_start,
  validEnd: row.valid_end,
  usedAt: row.used_at,
  usedOrderId: row.used_order_id,
  claimedAt: row.created_at,
});

export const getAvailableCoupons = async (
  userId: number,
  storeId: number | undefined,
  page: number,
  pageSize: number,
) => {
  const { list, total } = await listAvailableCoupons(storeId, userId, page, pageSize);
  return {
    list: list.map(formatCoupon),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const claimCoupon = async (userId: number, couponId: number) => {
  const coupon = await findCouponById(couponId);
  if (!coupon) throw AppError.notFound('优惠券不存在');
  const result = await claimCouponModel(couponId, userId);
  if (!result) {
    throw new AppError(ErrorCode.COUPON_UNAVAILABLE, '优惠券已领完或已失效', 400);
  }
  return {
    couponRecordId: result.couponRecordId,
    couponName: coupon.name,
    expireTime: result.validEnd,
    alreadyClaimed: result.alreadyClaimed,
  };
};

export const getMyCoupons = async (
  userId: number,
  status: string | undefined,
  page: number,
  pageSize: number,
) => {
  const { list, total } = await listUserCoupons(userId, status, page, pageSize);
  return {
    list: list.map(formatRecord),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const getApplicableForOrder = async (
  userId: number,
  storeId: number,
  orderAmountFen: number,
) => {
  const items = await listApplicableCouponsForOrder(userId, storeId, orderAmountFen);
  const applicable = items
    .filter((i) => i.applicable)
    .sort((a, b) => b.discountAmountFen - a.discountAmountFen)
    .map((i) => ({
      couponRecordId: i.record.id,
      couponName: i.coupon.name,
      type: i.coupon.type,
      value: readDecimal(i.coupon.discount_value),
      minAmount: yuanToFen(readDecimal(i.coupon.min_amount)),
      discountAmount: i.discountAmountFen,
    }));
  const notApplicable = items
    .filter((i) => !i.applicable)
    .map((i) => ({
      couponRecordId: i.record.id,
      couponName: i.coupon.name,
      type: i.coupon.type,
      value: readDecimal(i.coupon.discount_value),
      minAmount: yuanToFen(readDecimal(i.coupon.min_amount)),
      reason: i.reason,
    }));
  return { applicable, notApplicable };
};
