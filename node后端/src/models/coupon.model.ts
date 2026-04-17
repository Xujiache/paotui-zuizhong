import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { execute, query, queryOne, transaction } from '../utils/database';

export interface CouponRow extends RowDataPacket {
  id: number;
  name: string;
  type: string;
  discount_value: string | number;
  min_amount: string | number;
  max_discount: string | number;
  applicable_type: string;
  applicable_stores: unknown;
  total_count: number;
  issued_count: number;
  used_count: number;
  valid_days: number;
  valid_start: Date | null;
  valid_end: Date | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  is_deleted: number;
}

export interface CouponRecordRow extends RowDataPacket {
  id: number;
  coupon_id: number;
  user_id: number;
  status: string;
  used_order_id: number | null;
  valid_start: Date;
  valid_end: Date;
  used_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const findCouponById = async (id: number): Promise<CouponRow | null> =>
  queryOne<CouponRow>(`SELECT * FROM coupons WHERE id = ? AND is_deleted = 0`, [id]);

export const listAvailableCoupons = async (
  storeId: number | undefined,
  userId: number,
  page: number,
  pageSize: number,
): Promise<{ list: Array<CouponRow & { claimed: boolean }>; total: number }> => {
  const where: string[] = [
    "status = 'ACTIVE'",
    'is_deleted = 0',
    '(valid_start IS NULL OR valid_start <= NOW())',
    '(valid_end IS NULL OR valid_end >= NOW())',
    '(total_count = 0 OR issued_count < total_count)',
  ];
  const vals: Array<string | number> = [];
  if (storeId) {
    where.push(
      "(applicable_type = 'ALL' OR JSON_CONTAINS(applicable_stores, JSON_QUOTE(?)))",
    );
    vals.push(String(storeId));
  }
  const whereSql = where.join(' AND ');
  const offset = (page - 1) * pageSize;
  const list = await query<CouponRow[]>(
    `SELECT * FROM coupons WHERE ${whereSql} ORDER BY id DESC LIMIT ${pageSize} OFFSET ${offset}`,
    vals,
  );
  // 标注 claimed
  if (list.length === 0) {
    return { list: [], total: 0 };
  }
  const ids = list.map((c) => c.id);
  const placeholders = ids.map(() => '?').join(',');
  const claimed = await query<(CouponRecordRow & { coupon_id: number })[]>(
    `SELECT coupon_id FROM coupon_records
     WHERE user_id = ? AND coupon_id IN (${placeholders})`,
    [userId, ...ids],
  );
  const claimedSet = new Set(claimed.map((c) => c.coupon_id));
  const enriched = list.map((c) => ({ ...c, claimed: claimedSet.has(c.id) }));
  const totalRow = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM coupons WHERE ${whereSql}`,
    vals,
  );
  return { list: enriched, total: totalRow[0]?.total ?? 0 };
};

export const findUserCouponRecord = async (
  couponId: number,
  userId: number,
): Promise<CouponRecordRow | null> =>
  queryOne<CouponRecordRow>(
    `SELECT * FROM coupon_records WHERE coupon_id = ? AND user_id = ?`,
    [couponId, userId],
  );

export interface ClaimCouponResult {
  couponRecordId: number;
  validStart: Date;
  validEnd: Date;
  alreadyClaimed: boolean;
}

export const claimCoupon = async (
  couponId: number,
  userId: number,
): Promise<ClaimCouponResult | null> =>
  transaction(async (conn) => {
    const existing = await conn.execute<CouponRecordRow[]>(
      `SELECT * FROM coupon_records WHERE coupon_id = ? AND user_id = ? LIMIT 1`,
      [couponId, userId],
    );
    const already = (existing[0] as CouponRecordRow[])[0];
    if (already) {
      return {
        couponRecordId: already.id,
        validStart: already.valid_start,
        validEnd: already.valid_end,
        alreadyClaimed: true,
      };
    }

    const [couponRows] = await conn.execute<CouponRow[]>(
      `SELECT * FROM coupons WHERE id = ? AND is_deleted = 0 FOR UPDATE`,
      [couponId],
    );
    const coupon = (couponRows as CouponRow[])[0];
    if (!coupon) return null;
    if (coupon.total_count > 0 && coupon.issued_count >= coupon.total_count) {
      return null;
    }

    let validStart: Date;
    let validEnd: Date;
    if (coupon.valid_start && coupon.valid_end) {
      validStart = coupon.valid_start;
      validEnd = coupon.valid_end;
    } else {
      validStart = new Date();
      validEnd = new Date(Date.now() + (coupon.valid_days || 30) * 86400000);
    }

    await conn.execute(`UPDATE coupons SET issued_count = issued_count + 1 WHERE id = ?`, [
      couponId,
    ]);
    const [ret] = await conn.execute<ResultSetHeader>(
      `INSERT INTO coupon_records (coupon_id, user_id, status, valid_start, valid_end)
       VALUES (?, ?, 'UNUSED', ?, ?)`,
      [couponId, userId, validStart, validEnd],
    );
    return {
      couponRecordId: ret.insertId,
      validStart,
      validEnd,
      alreadyClaimed: false,
    };
  });

export const listUserCoupons = async (
  userId: number,
  status: string | undefined,
  page: number,
  pageSize: number,
): Promise<{
  list: Array<CouponRecordRow & { coupon: CouponRow | null }>;
  total: number;
}> => {
  const where: string[] = ['cr.user_id = ?'];
  const vals: Array<string | number> = [userId];
  if (status) {
    where.push('cr.status = ?');
    vals.push(status);
  }
  const whereSql = where.join(' AND ');
  const offset = (page - 1) * pageSize;
  const list = await query<(CouponRecordRow & CouponRow)[]>(
    `SELECT cr.*, c.name AS coupon_name, c.type AS coupon_type,
            c.discount_value, c.min_amount, c.max_discount, c.applicable_type
     FROM coupon_records cr LEFT JOIN coupons c ON c.id = cr.coupon_id
     WHERE ${whereSql}
     ORDER BY cr.id DESC LIMIT ${pageSize} OFFSET ${offset}`,
    vals,
  );
  const total = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM coupon_records cr WHERE ${whereSql}`,
    vals,
  );
  const enriched = list.map((row) => {
    const coupon = row.coupon_id
      ? ({
          id: row.coupon_id,
          name: (row as unknown as { coupon_name: string }).coupon_name,
          type: (row as unknown as { coupon_type: string }).coupon_type,
          discount_value: row.discount_value,
          min_amount: row.min_amount,
          max_discount: row.max_discount,
          applicable_type: row.applicable_type,
        } as CouponRow)
      : null;
    return { ...row, coupon };
  });
  return { list: enriched, total: total[0]?.total ?? 0 };
};

export const listApplicableCouponsForOrder = async (
  userId: number,
  storeId: number,
  orderAmountFen: number,
): Promise<
  Array<{
    record: CouponRecordRow;
    coupon: CouponRow;
    applicable: boolean;
    reason?: string;
    discountAmountFen: number;
  }>
> => {
  const { list } = await listUserCoupons(userId, 'UNUSED', 1, 200);
  const result: Array<{
    record: CouponRecordRow;
    coupon: CouponRow;
    applicable: boolean;
    reason?: string;
    discountAmountFen: number;
  }> = [];
  const now = new Date();
  for (const item of list) {
    const coupon = item.coupon;
    if (!coupon) continue;
    const record = item;
    if (record.valid_end && new Date(record.valid_end) < now) {
      continue;
    }
    const minYuan = Number(coupon.min_amount);
    const minFen = Math.round(minYuan * 100);
    let discountFen = 0;
    if (coupon.type === 'FIXED') {
      discountFen = Math.round(Number(coupon.discount_value) * 100);
    } else if (coupon.type === 'PERCENT') {
      discountFen = Math.round(orderAmountFen * (Number(coupon.discount_value) / 100));
      const maxDiscountFen = Math.round(Number(coupon.max_discount) * 100);
      if (maxDiscountFen > 0 && discountFen > maxDiscountFen) {
        discountFen = maxDiscountFen;
      }
    }
    if (orderAmountFen < minFen) {
      result.push({
        record,
        coupon,
        applicable: false,
        reason: `未满足最低订单金额 ${minFen / 100} 元`,
        discountAmountFen: 0,
      });
      continue;
    }
    result.push({
      record,
      coupon,
      applicable: true,
      discountAmountFen: discountFen,
    });
  }
  return result;
};

/**
 * 原子把 coupon_record 从 UNUSED 标记为 USED。
 * 返回 true 代表确实是本次标记成功；false 表示该记录不是 UNUSED（可能已被其他订单占用）。
 * 用在下单流程里，防止同一张券被多个订单重复抵扣。
 */
export const markCouponRecordUsed = async (
  couponRecordId: number,
  userId: number,
  usedOrderId: number,
): Promise<boolean> => {
  const result = await execute(
    `UPDATE coupon_records
     SET status = 'USED', used_at = NOW(), used_order_id = ?
     WHERE id = ? AND user_id = ? AND status = 'UNUSED'`,
    [usedOrderId, couponRecordId, userId],
  );
  return result.affectedRows > 0;
};

/**
 * 订单取消 / 超时 / 退款时释放已占用的优惠券。
 * 只有当记录确实处于 USED 且 used_order_id 匹配时才回退，避免误放。
 */
export const releaseCouponRecordByOrder = async (
  couponRecordId: number,
  orderId: number,
): Promise<boolean> => {
  const result = await execute(
    `UPDATE coupon_records
     SET status = 'UNUSED', used_at = NULL, used_order_id = NULL
     WHERE id = ? AND used_order_id = ? AND status = 'USED'`,
    [couponRecordId, orderId],
  );
  return result.affectedRows > 0;
};
