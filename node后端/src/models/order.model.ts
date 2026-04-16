import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import { execute, pool, query, queryOne, transaction } from '../utils/database';

export interface OrderRow extends RowDataPacket {
  id: number;
  order_no: string;
  user_id: number;
  store_id: number | null;
  rider_id: number | null;
  order_type: string;
  status: string;
  payment_status: string;
  settlement_status: string;
  total_amount: string | number;
  product_amount: string | number;
  delivery_fee: string | number;
  packing_fee: string | number;
  extra_fee: string | number;
  tip_amount: string | number;
  discount_amount: string | number;
  paid_amount: string | number;
  refund_amount: string | number;
  coupon_record_id: number | null;
  contact_name: string;
  contact_phone: string;
  delivery_address: string;
  delivery_lat: string | number;
  delivery_lng: string | number;
  user_remark: string;
  merchant_remark: string;
  expected_delivery_time: Date | null;
  pay_deadline: Date | null;
  merchant_accepted_at: Date | null;
  rider_accepted_at: Date | null;
  picked_up_at: Date | null;
  delivered_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  cancel_reason: string;
  rating_score: number | null;
  rating_content: string;
  rating_images: unknown;
  rated_at: Date | null;
  created_at: Date;
  updated_at: Date;
  is_deleted: number;
}

export interface OrderItemRow extends RowDataPacket {
  id: number;
  order_id: number;
  product_id: number;
  sku_id: number;
  product_name: string;
  sku_text: string;
  product_image: string;
  price: string | number;
  quantity: number;
  subtotal: string | number;
  created_at: Date;
  updated_at: Date;
}

export interface ErrandOrderRow extends RowDataPacket {
  id: number;
  order_id: number;
  service_type: string;
  pickup_address: string;
  pickup_lat: string | number | null;
  pickup_lng: string | number | null;
  pickup_contact_name: string;
  pickup_contact_phone: string;
  item_description: string | null;
  item_type: string;
  item_weight: string | number;
  pickup_code: string;
  budget_amount: string | number;
  actual_buy_amount: string | number;
  advance_amount: string | number;
  floor_info: string;
  has_elevator: number;
  images: unknown;
  requires_review: number;
  review_status: string;
  review_remark: string;
  distance: number;
  base_fee: string | number;
  distance_fee: string | number;
  weight_fee: string | number;
  floor_fee: string | number;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentRow extends RowDataPacket {
  id: number;
  order_id: number;
  payment_no: string;
  transaction_id: string;
  amount: string | number;
  channel: string;
  status: string;
  paid_at: Date | null;
  refund_amount: string | number;
  callback_raw: string | null;
  created_at: Date;
  updated_at: Date;
}

export const findOrderById = async (id: number): Promise<OrderRow | null> =>
  queryOne<OrderRow>(`SELECT * FROM orders WHERE id = ? AND is_deleted = 0`, [id]);

export const findOrderByNo = async (orderNo: string): Promise<OrderRow | null> =>
  queryOne<OrderRow>(`SELECT * FROM orders WHERE order_no = ? AND is_deleted = 0`, [
    orderNo,
  ]);

export const listOrderItems = async (orderId: number): Promise<OrderItemRow[]> =>
  query<OrderItemRow[]>(`SELECT * FROM order_items WHERE order_id = ?`, [orderId]);

export const findErrandOrderByOrderId = async (
  orderId: number,
): Promise<ErrandOrderRow | null> =>
  queryOne<ErrandOrderRow>(`SELECT * FROM errand_orders WHERE order_id = ?`, [orderId]);

export const findPaymentByOrderId = async (
  orderId: number,
): Promise<PaymentRow | null> =>
  queryOne<PaymentRow>(`SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1`, [
    orderId,
  ]);

export const findPaymentByNo = async (paymentNo: string): Promise<PaymentRow | null> =>
  queryOne<PaymentRow>(`SELECT * FROM payments WHERE payment_no = ?`, [paymentNo]);

// ====================== 写入 ======================

export interface CreateProductOrderParams {
  orderNo: string;
  userId: number;
  storeId: number;
  contactName: string;
  contactPhone: string;
  deliveryAddress: string;
  deliveryLat: number;
  deliveryLng: number;
  productAmount: number;
  deliveryFee: number;
  packingFee: number;
  extraFee: number;
  discountAmount: number;
  paidAmount: number;
  totalAmount: number;
  couponRecordId?: number | null;
  userRemark?: string;
  payDeadline: Date;
  items: Array<{
    productId: number;
    skuId: number;
    productName: string;
    skuText: string;
    productImage: string;
    price: number;
    quantity: number;
  }>;
}

export const createProductOrder = async (
  params: CreateProductOrderParams,
): Promise<number> =>
  transaction(async (conn) => {
    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO orders
        (order_no, user_id, store_id, order_type, status, payment_status,
         total_amount, product_amount, delivery_fee, packing_fee, extra_fee,
         discount_amount, paid_amount, coupon_record_id,
         contact_name, contact_phone, delivery_address, delivery_lat, delivery_lng,
         user_remark, pay_deadline)
       VALUES (?, ?, ?, 'PRODUCT', 'PENDING_PAYMENT', 'UNPAID',
               ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.orderNo,
        params.userId,
        params.storeId,
        params.totalAmount,
        params.productAmount,
        params.deliveryFee,
        params.packingFee,
        params.extraFee,
        params.discountAmount,
        params.paidAmount,
        params.couponRecordId ?? null,
        params.contactName,
        params.contactPhone,
        params.deliveryAddress,
        params.deliveryLat,
        params.deliveryLng,
        params.userRemark ?? '',
        params.payDeadline,
      ],
    );
    const orderId = result.insertId;
    for (const item of params.items) {
      await conn.execute(
        `INSERT INTO order_items
           (order_id, product_id, sku_id, product_name, sku_text, product_image,
            price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          item.productId,
          item.skuId,
          item.productName,
          item.skuText,
          item.productImage,
          item.price,
          item.quantity,
          item.price * item.quantity,
        ],
      );
    }
    return orderId;
  });

export interface CreateErrandOrderParams {
  orderNo: string;
  userId: number;
  serviceType: string;
  contactName: string;
  contactPhone: string;
  deliveryAddress: string;
  deliveryLat: number;
  deliveryLng: number;
  pickupAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  pickupContactName?: string;
  pickupContactPhone?: string;
  itemDescription?: string;
  itemWeight?: number;
  floorInfo?: string;
  hasElevator?: boolean;
  budgetAmount?: number;
  baseFee: number;
  distanceFee: number;
  weightFee: number;
  floorFee: number;
  extraFee: number;
  tipAmount: number;
  totalAmount: number;
  paidAmount: number;
  distance?: number;
  requiresReview?: boolean;
  payDeadline: Date;
  userRemark?: string;
}

export const createErrandOrder = async (
  params: CreateErrandOrderParams,
): Promise<number> =>
  transaction(async (conn) => {
    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO orders
        (order_no, user_id, order_type, status, payment_status,
         total_amount, product_amount, delivery_fee, packing_fee, extra_fee, tip_amount,
         paid_amount,
         contact_name, contact_phone, delivery_address, delivery_lat, delivery_lng,
         user_remark, pay_deadline)
       VALUES (?, ?, 'ERRAND', 'PENDING_PAYMENT', 'UNPAID',
               ?, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.orderNo,
        params.userId,
        params.totalAmount,
        params.extraFee,
        params.tipAmount,
        params.paidAmount,
        params.contactName,
        params.contactPhone,
        params.deliveryAddress,
        params.deliveryLat,
        params.deliveryLng,
        params.userRemark ?? '',
        params.payDeadline,
      ],
    );
    const orderId = result.insertId;
    await conn.execute(
      `INSERT INTO errand_orders
        (order_id, service_type, pickup_address, pickup_lat, pickup_lng,
         pickup_contact_name, pickup_contact_phone, item_description, item_weight,
         floor_info, has_elevator, budget_amount,
         distance, base_fee, distance_fee, weight_fee, floor_fee,
         requires_review)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        params.serviceType,
        params.pickupAddress ?? '',
        params.pickupLat ?? null,
        params.pickupLng ?? null,
        params.pickupContactName ?? '',
        params.pickupContactPhone ?? '',
        params.itemDescription ?? null,
        params.itemWeight ?? 0,
        params.floorInfo ?? '',
        params.hasElevator === false ? 0 : 1,
        params.budgetAmount ?? 0,
        params.distance ?? 0,
        params.baseFee,
        params.distanceFee,
        params.weightFee,
        params.floorFee,
        params.requiresReview ? 1 : 0,
      ],
    );
    return orderId;
  });

export const createPaymentRecord = async (
  orderId: number,
  paymentNo: string,
  amount: number,
  conn?: PoolConnection,
): Promise<number> => {
  const runner = conn ?? pool;
  const [result] = await runner.execute<ResultSetHeader>(
    `INSERT INTO payments (order_id, payment_no, amount, channel, status)
     VALUES (?, ?, ?, 'WECHAT', 'UNPAID')`,
    [orderId, paymentNo, amount],
  );
  return result.insertId;
};

export interface UpdateOrderStatusParams {
  status?: string;
  paymentStatus?: string;
  settlementStatus?: string;
  riderId?: number | null;
  merchantAcceptedAt?: Date;
  riderAcceptedAt?: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  paidAmount?: number;
  refundAmount?: number;
}

export const updateOrder = async (
  id: number,
  params: UpdateOrderStatusParams,
  conn?: PoolConnection,
): Promise<void> => {
  const sets: string[] = [];
  const vals: Array<string | number | Date | null> = [];
  const map: Record<string, string> = {
    status: 'status',
    paymentStatus: 'payment_status',
    settlementStatus: 'settlement_status',
    riderId: 'rider_id',
    merchantAcceptedAt: 'merchant_accepted_at',
    riderAcceptedAt: 'rider_accepted_at',
    pickedUpAt: 'picked_up_at',
    deliveredAt: 'delivered_at',
    completedAt: 'completed_at',
    cancelledAt: 'cancelled_at',
    cancelReason: 'cancel_reason',
    paidAmount: 'paid_amount',
    refundAmount: 'refund_amount',
  };
  for (const key of Object.keys(map) as Array<keyof UpdateOrderStatusParams>) {
    if (params[key] !== undefined) {
      sets.push(`${map[key]} = ?`);
      vals.push(params[key] as string | number | Date | null);
    }
  }
  if (sets.length === 0) return;
  vals.push(id);
  const sql = `UPDATE orders SET ${sets.join(', ')} WHERE id = ?`;
  if (conn) {
    await conn.execute(sql, vals);
  } else {
    await execute(sql, vals as (string | number)[]);
  }
};

export const updatePayment = async (
  id: number,
  params: {
    transactionId?: string;
    status?: string;
    paidAt?: Date;
    refundAmount?: number;
    callbackRaw?: string;
  },
  conn?: PoolConnection,
): Promise<void> => {
  const sets: string[] = [];
  const vals: Array<string | number | Date> = [];
  if (params.transactionId !== undefined) {
    sets.push('transaction_id = ?');
    vals.push(params.transactionId);
  }
  if (params.status !== undefined) {
    sets.push('status = ?');
    vals.push(params.status);
  }
  if (params.paidAt !== undefined) {
    sets.push('paid_at = ?');
    vals.push(params.paidAt);
  }
  if (params.refundAmount !== undefined) {
    sets.push('refund_amount = ?');
    vals.push(params.refundAmount);
  }
  if (params.callbackRaw !== undefined) {
    sets.push('callback_raw = ?');
    vals.push(params.callbackRaw);
  }
  if (sets.length === 0) return;
  vals.push(id);
  const sql = `UPDATE payments SET ${sets.join(', ')} WHERE id = ?`;
  if (conn) {
    await conn.execute(sql, vals);
  } else {
    await execute(sql, vals);
  }
};

export const insertOrderLog = async (params: {
  orderId: number;
  operatorType: string;
  operatorId?: number | null;
  action: string;
  fromStatus?: string;
  toStatus?: string;
  remark?: string;
  extra?: Record<string, unknown> | null;
  conn?: PoolConnection;
}): Promise<void> => {
  const sql = `INSERT INTO order_logs
      (order_id, operator_type, operator_id, action, from_status, to_status, remark, extra)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  const vals = [
    params.orderId,
    params.operatorType,
    params.operatorId ?? null,
    params.action,
    params.fromStatus ?? '',
    params.toStatus ?? '',
    params.remark ?? '',
    params.extra ? JSON.stringify(params.extra) : null,
  ];
  if (params.conn) {
    await params.conn.execute(sql, vals);
  } else {
    await execute(sql, vals as (string | number)[]);
  }
};

// ====================== 查询列表 ======================

export interface OrderListParams {
  userId?: number;
  storeId?: number;
  riderId?: number;
  status?: string;
  orderType?: string;
  page: number;
  pageSize: number;
}

export const listOrders = async (
  params: OrderListParams,
): Promise<{ list: OrderRow[]; total: number }> => {
  const where: string[] = ['is_deleted = 0'];
  const vals: Array<string | number> = [];
  if (params.userId) {
    where.push('user_id = ?');
    vals.push(params.userId);
  }
  if (params.storeId) {
    where.push('store_id = ?');
    vals.push(params.storeId);
  }
  if (params.riderId) {
    where.push('rider_id = ?');
    vals.push(params.riderId);
  }
  if (params.status) {
    where.push('status = ?');
    vals.push(params.status);
  }
  if (params.orderType) {
    where.push('order_type = ?');
    vals.push(params.orderType);
  }
  const whereSql = where.join(' AND ');
  const offset = (params.page - 1) * params.pageSize;
  const list = await query<OrderRow[]>(
    `SELECT * FROM orders WHERE ${whereSql}
     ORDER BY id DESC LIMIT ${params.pageSize} OFFSET ${offset}`,
    vals,
  );
  const total = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM orders WHERE ${whereSql}`,
    vals,
  );
  return { list, total: total[0]?.total ?? 0 };
};

export const listOrderLogs = async (orderId: number): Promise<RowDataPacket[]> =>
  query<RowDataPacket[]>(
    `SELECT * FROM order_logs WHERE order_id = ? ORDER BY id ASC`,
    [orderId],
  );
