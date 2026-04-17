/**
 * 订单中心
 *
 * 商品订单主流程：
 *   USER 创建（预扣库存）→ 支付回调 → 商家接单 → 骑手抢单
 *   → 骑手取货 → 骑手送达 → 用户确认 → 结算触发
 *
 * 跑腿订单主流程：
 *   USER 发单 → 支付回调 → (审核类) → 骑手抢单
 *   → 骑手出发 → 到达执行 → 送达 → 用户确认 → 结算
 */

import { PoolConnection } from 'mysql2/promise';
import { AppError } from '../utils/AppError';
import {
  ErrorCode,
  OrderStatus,
  OrderType,
  ErrandServiceType,
  PaymentStatus,
  UserRole,
} from '../types/enums';
import {
  OrderRow,
  createProductOrder,
  createErrandOrder,
  createPaymentRecord,
  findOrderById,
  findOrderByNo,
  findErrandOrderByOrderId,
  findPaymentByNo,
  insertOrderLog,
  listOrderItems,
  listOrders,
  listOrderLogs,
  updateOrder,
  updatePayment,
} from '../models/order.model';
import { findStoreById } from '../models/store.model';
import { findRiderById } from '../models/rider.model';
import { findUserAddressById } from '../models/userAddress.model';
import {
  generateErrandOrderNo,
  generatePaymentNo,
  generateProductOrderNo,
} from '../utils/orderNo';
import {
  calculateProductOrder,
  calculateErrandOrder,
} from './pricing.service';
import { updateSkuStock } from '../models/product.model';
import { markCouponRecordUsed, releaseCouponRecordByOrder } from '../models/coupon.model';
import { getOrderFSM } from './orderStateMachine';
import { clearCartByUser } from '../models/cart.model';
import { notify, OrderNotifyType } from './notification.service';
import { readDecimal, yuanToFen, fenToYuan } from '../utils/money';
import { pool, transaction } from '../utils/database';
import { acquireIdempotency } from '../utils/idempotency';
import crypto from 'crypto';
import logger from '../utils/logger';

const PAY_TIMEOUT_MINUTES = 15;

// ============================= 创建商品订单 =============================

export interface CreateProductOrderInput {
  storeId: number;
  addressId: number;
  items: Array<{ skuId: number; quantity: number }>;
  remark?: string;
  couponRecordId?: number | null;
  clearCartAfterCreate?: boolean;
}

export const userCreateProductOrder = async (
  userId: number,
  input: CreateProductOrderInput,
) => {
  // 幂等：userId + storeId + items + 3 秒时间窗
  const hash = crypto
    .createHash('md5')
    .update(
      JSON.stringify({
        userId,
        storeId: input.storeId,
        items: input.items,
        t: Math.floor(Date.now() / 3000),
      }),
    )
    .digest('hex')
    .slice(0, 16);
  const token = await acquireIdempotency(`order:product:${userId}:${hash}`, 10);
  if (!token) {
    throw new AppError(ErrorCode.DUPLICATE_OPERATION, '重复提交，请稍后重试', 409);
  }

  const address = await findUserAddressById(input.addressId);
  if (!address || address.user_id !== userId) {
    throw new AppError(ErrorCode.USER_ADDRESS_NOT_FOUND, '地址不存在或不属于当前用户', 404);
  }

  const pricing = await calculateProductOrder({
    storeId: input.storeId,
    items: input.items,
    deliveryLat: Number(readDecimal(address.lat)),
    deliveryLng: Number(readDecimal(address.lng)),
    couponRecordId: input.couponRecordId ?? null,
    userId,
  });

  // 预扣库存（DECREMENT 原子）
  const decremented: Array<{ skuId: number; quantity: number }> = [];
  try {
    for (const item of input.items) {
      const stock = await updateSkuStock(item.skuId, 'DECREMENT', item.quantity);
      if (stock === null) {
        throw new AppError(
          ErrorCode.ORDER_STOCK_NOT_ENOUGH,
          `SKU ${item.skuId} 库存不足`,
          400,
        );
      }
      decremented.push({ skuId: item.skuId, quantity: item.quantity });
    }

    const orderNo = generateProductOrderNo();
    const payDeadline = new Date(Date.now() + PAY_TIMEOUT_MINUTES * 60 * 1000);

    const orderId = await createProductOrder({
      orderNo,
      userId,
      storeId: input.storeId,
      contactName: address.contact_name,
      contactPhone: address.contact_phone,
      deliveryAddress:
        `${address.province}${address.city}${address.district}${address.address}${address.house_number}`,
      deliveryLat: Number(readDecimal(address.lat)),
      deliveryLng: Number(readDecimal(address.lng)),
      productAmount: fenToYuan(pricing.productAmount),
      deliveryFee: fenToYuan(pricing.deliveryFee),
      packingFee: fenToYuan(pricing.packingFee),
      extraFee: fenToYuan(pricing.extraFee),
      discountAmount: fenToYuan(pricing.discountAmount),
      paidAmount: fenToYuan(pricing.paidAmount),
      totalAmount: fenToYuan(pricing.totalAmount),
      couponRecordId: input.couponRecordId ?? null,
      userRemark: input.remark,
      payDeadline,
      items: pricing.lineItems.map((i) => ({
        productId: i.productId,
        skuId: i.skuId,
        productName: i.productName,
        skuText: i.skuText,
        productImage: i.productImage,
        price: fenToYuan(i.price),
        quantity: i.quantity,
      })),
    });

    const paymentNo = generatePaymentNo();
    await createPaymentRecord(orderId, paymentNo, fenToYuan(pricing.paidAmount));

    // 锁住优惠券，防止同一张券被多个未支付订单同时抵扣。
    // 标记失败（可能并发情况下已被其他订单占用）则把订单的 discount 清零并回滚 couponRecordId，保持金额一致性。
    if (input.couponRecordId && pricing.discountAmount > 0) {
      const ok = await markCouponRecordUsed(input.couponRecordId, userId, orderId);
      if (!ok) {
        throw new AppError(
          ErrorCode.COUPON_UNAVAILABLE,
          '优惠券已被占用，请重新选择',
          400,
        );
      }
    }

    await insertOrderLog({
      orderId,
      operatorType: 'USER',
      operatorId: userId,
      action: 'CREATE',
      toStatus: OrderStatus.PENDING_PAYMENT,
    });

    if (input.clearCartAfterCreate) {
      await clearCartByUser(userId, input.storeId);
    }

    return {
      orderId,
      orderNo,
      paymentNo,
      totalAmount: pricing.totalAmount,
      productAmount: pricing.productAmount,
      deliveryFee: pricing.deliveryFee,
      packingFee: pricing.packingFee,
      extraFee: pricing.extraFee,
      discountAmount: pricing.discountAmount,
      paidAmount: pricing.paidAmount,
      payDeadline: payDeadline.toISOString(),
      // 首期微信支付参数用占位，真实对接在阶段之后
      paymentParams: {
        mock: true,
        paymentNo,
        amount: pricing.paidAmount,
      },
    };
  } catch (err) {
    // 失败：回滚已扣减的库存
    for (const d of decremented) {
      try {
        await updateSkuStock(d.skuId, 'INCREMENT', d.quantity);
      } catch (_rollbackErr) {
        logger.error(
          `库存回滚失败 skuId=${d.skuId} qty=${d.quantity}: ${(_rollbackErr as Error).message}`,
        );
      }
    }
    throw err;
  }
};

// ============================= 创建跑腿订单 =============================

export interface CreateErrandOrderInput {
  serviceType: ErrandServiceType | string;
  pickupAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  pickupContactName?: string;
  pickupContactPhone?: string;
  deliveryAddressId: number;
  itemDescription?: string;
  itemWeight?: number;
  floorInfo?: string;
  hasElevator?: boolean;
  budgetAmount?: number;
  tipAmount?: number;
  remark?: string;
}

export const userCreateErrandOrder = async (
  userId: number,
  input: CreateErrandOrderInput,
) => {
  const address = await findUserAddressById(input.deliveryAddressId);
  if (!address || address.user_id !== userId) {
    throw new AppError(ErrorCode.USER_ADDRESS_NOT_FOUND, '地址不存在或不属于当前用户', 404);
  }

  const pricing = calculateErrandOrder({
    serviceType: input.serviceType,
    pickupLat: input.pickupLat,
    pickupLng: input.pickupLng,
    deliveryLat: Number(readDecimal(address.lat)),
    deliveryLng: Number(readDecimal(address.lng)),
    itemWeight: input.itemWeight,
    floorInfo: input.floorInfo,
    tipAmount: input.tipAmount,
  });

  const orderNo = generateErrandOrderNo();
  const payDeadline = new Date(Date.now() + PAY_TIMEOUT_MINUTES * 60 * 1000);
  const requiresReview = input.serviceType === ErrandServiceType.ERRAND; // 代办需审核

  const orderId = await createErrandOrder({
    orderNo,
    userId,
    serviceType: input.serviceType,
    contactName: address.contact_name,
    contactPhone: address.contact_phone,
    deliveryAddress:
      `${address.province}${address.city}${address.district}${address.address}${address.house_number}`,
    deliveryLat: Number(readDecimal(address.lat)),
    deliveryLng: Number(readDecimal(address.lng)),
    pickupAddress: input.pickupAddress,
    pickupLat: input.pickupLat,
    pickupLng: input.pickupLng,
    pickupContactName: input.pickupContactName,
    pickupContactPhone: input.pickupContactPhone,
    itemDescription: input.itemDescription,
    itemWeight: input.itemWeight,
    floorInfo: input.floorInfo,
    hasElevator: input.hasElevator,
    budgetAmount: input.budgetAmount ? fenToYuan(input.budgetAmount) : 0,
    baseFee: fenToYuan(pricing.baseFee),
    distanceFee: fenToYuan(pricing.distanceFee),
    weightFee: fenToYuan(pricing.weightFee),
    floorFee: fenToYuan(pricing.floorFee),
    extraFee: fenToYuan(pricing.extraFee),
    tipAmount: fenToYuan(pricing.tipAmount),
    totalAmount: fenToYuan(pricing.totalAmount),
    paidAmount: fenToYuan(pricing.paidAmount),
    distance: pricing.distance,
    requiresReview,
    payDeadline,
    userRemark: input.remark,
  });

  const paymentNo = generatePaymentNo();
  await createPaymentRecord(orderId, paymentNo, fenToYuan(pricing.paidAmount));

  await insertOrderLog({
    orderId,
    operatorType: 'USER',
    operatorId: userId,
    action: 'CREATE',
    toStatus: OrderStatus.PENDING_PAYMENT,
    extra: { serviceType: input.serviceType },
  });

  return {
    orderId,
    orderNo,
    paymentNo,
    ...pricing,
    payDeadline: payDeadline.toISOString(),
    paymentParams: { mock: true, paymentNo, amount: pricing.paidAmount },
  };
};

// ============================= 支付回调 =============================

export interface PaymentCallbackInput {
  paymentNo: string;
  transactionId: string;
  amountFen: number;
  raw?: string;
}

/**
 * 幂等 + 金额校验 + 状态推进
 *
 * 关键顺序：先做前置校验（存在性、已支付幂等、金额一致性），再获取幂等锁推进状态。
 * 否则错误金额回调会占用幂等锁，导致真正的正确回调被错误地视为重复请求。
 */
export const handlePaymentCallback = async (input: PaymentCallbackInput) => {
  const payment = await findPaymentByNo(input.paymentNo);
  if (!payment) {
    throw new AppError(ErrorCode.DATA_NOT_FOUND, '支付记录不存在', 404);
  }

  if (payment.status === PaymentStatus.PAID) {
    return { idempotent: true };
  }

  const expectedFen = yuanToFen(readDecimal(payment.amount));
  if (expectedFen !== input.amountFen) {
    throw new AppError(
      ErrorCode.PAY_AMOUNT_MISMATCH,
      `支付金额不一致（预期 ${expectedFen}，回调 ${input.amountFen}）`,
      400,
    );
  }

  const token = await acquireIdempotency(
    `payment:cb:${input.paymentNo}`,
    300,
  );
  if (!token) {
    return { idempotent: true };
  }

  const order = await findOrderById(payment.order_id);
  if (!order) throw new AppError(ErrorCode.ORDER_NOT_FOUND, '订单不存在', 404);

  if (order.status !== OrderStatus.PENDING_PAYMENT) {
    // 已推进过（可能是回调后 DB 崩了但业务已经走），直接返回幂等成功
    return { idempotent: true, currentStatus: order.status };
  }

  let nextStatus: OrderStatus;
  if (order.order_type === OrderType.PRODUCT) {
    nextStatus = OrderStatus.PENDING_MERCHANT;
  } else {
    const errand = await findErrandOrderByOrderId(order.id);
    nextStatus =
      errand && errand.requires_review === 1
        ? OrderStatus.PENDING_REVIEW
        : OrderStatus.PENDING_DISPATCH;
  }

  const fsm = getOrderFSM(order.order_type);
  fsm.assertTransition(order.status as OrderStatus, nextStatus);

  await transaction(async (conn: PoolConnection) => {
    await updatePayment(
      payment.id,
      {
        transactionId: input.transactionId,
        status: PaymentStatus.PAID,
        paidAt: new Date(),
        callbackRaw: input.raw,
      },
      conn,
    );
    await updateOrder(
      order.id,
      {
        status: nextStatus,
        paymentStatus: PaymentStatus.PAID,
      },
      conn,
    );
    await insertOrderLog({
      orderId: order.id,
      operatorType: 'SYSTEM',
      action: 'PAY',
      fromStatus: order.status,
      toStatus: nextStatus,
      extra: { paymentNo: payment.payment_no, transactionId: input.transactionId },
      conn,
    });
  });

  // 支付成功通知：用户 + 商家（商品单）/ 运营（跑腿单）
  try {
    await notify({
      targetType: 'USER',
      targetId: order.user_id,
      type: OrderNotifyType.PAID,
      title: '支付成功',
      content: `订单 ${order.order_no} 支付成功，${
        order.order_type === OrderType.PRODUCT ? '商家正在准备' : '等待骑手接单'
      }。`,
      extra: { orderId: order.id, orderNo: order.order_no, status: nextStatus },
    });

    if (order.order_type === OrderType.PRODUCT && order.store_id) {
      const store = await findStoreById(order.store_id);
      if (store) {
        await notify({
          targetType: 'MERCHANT',
          targetId: store.merchant_id,
          type: OrderNotifyType.MERCHANT_NEW_ORDER,
          title: '您有新订单',
          content: `订单 ${order.order_no} 等待接单，请尽快处理。`,
          extra: {
            orderId: order.id,
            orderNo: order.order_no,
            storeId: order.store_id,
            status: nextStatus,
          },
        });
      }
    }
  } catch (err) {
    logger.warn(`[order.pay] 通知发送失败 order=${order.id}: ${(err as Error).message}`);
  }

  return { success: true, orderId: order.id, status: nextStatus };
};

// ============================= 状态转换 =============================

interface TransitionParams {
  order: OrderRow;
  to: OrderStatus;
  operatorType: 'USER' | 'MERCHANT' | 'RIDER' | 'ADMIN' | 'SYSTEM';
  operatorId?: number;
  action: string;
  updates?: Parameters<typeof updateOrder>[1];
  remark?: string;
}

const transitionStatus = async (params: TransitionParams) => {
  const fsm = getOrderFSM(params.order.order_type);
  fsm.assertTransition(params.order.status as OrderStatus, params.to);

  const updates = { ...(params.updates ?? {}), status: params.to };
  await updateOrder(params.order.id, updates);

  await insertOrderLog({
    orderId: params.order.id,
    operatorType: params.operatorType,
    operatorId: params.operatorId,
    action: params.action,
    fromStatus: params.order.status,
    toStatus: params.to,
    remark: params.remark,
  });
};

const ensureMerchantOwnsOrder = async (
  merchantId: number,
  order: OrderRow,
): Promise<void> => {
  if (!order.store_id) {
    throw new AppError(ErrorCode.ORDER_STATUS_INVALID, '订单不属于任何门店', 400);
  }
  const store = await findStoreById(order.store_id);
  if (!store || store.merchant_id !== merchantId) {
    throw new AppError(ErrorCode.STORE_FORBIDDEN, '不能操作他人订单', 403);
  }
};

export const merchantAccept = async (merchantId: number, orderId: number) => {
  const order = await findOrderById(orderId);
  if (!order) throw new AppError(ErrorCode.ORDER_NOT_FOUND, '订单不存在', 404);
  await ensureMerchantOwnsOrder(merchantId, order);
  await transitionStatus({
    order,
    to: OrderStatus.PENDING_RIDER,
    operatorType: 'MERCHANT',
    operatorId: merchantId,
    action: 'MERCHANT_ACCEPT',
    updates: { merchantAcceptedAt: new Date() },
  });

  try {
    await notify({
      targetType: 'USER',
      targetId: order.user_id,
      type: OrderNotifyType.MERCHANT_ACCEPTED,
      title: '商家已接单',
      content: `商家已接单，正在等待骑手抢单（订单 ${order.order_no}）。`,
      extra: {
        orderId: order.id,
        orderNo: order.order_no,
        status: OrderStatus.PENDING_RIDER,
      },
    });
  } catch (err) {
    logger.warn(`[order.accept] 通知失败 order=${order.id}: ${(err as Error).message}`);
  }

  return { orderId, status: OrderStatus.PENDING_RIDER };
};

/**
 * 商家拒单：MERCHANT_REJECTED → REFUNDED 级联 + 回滚库存/优惠券 + 全额退款 + 双端通知
 */
export const merchantReject = async (
  merchantId: number,
  orderId: number,
  reason: string,
) => {
  const order = await findOrderById(orderId);
  if (!order) throw new AppError(ErrorCode.ORDER_NOT_FOUND, '订单不存在', 404);
  await ensureMerchantOwnsOrder(merchantId, order);

  await transitionStatus({
    order,
    to: OrderStatus.MERCHANT_REJECTED,
    operatorType: 'MERCHANT',
    operatorId: merchantId,
    action: 'MERCHANT_REJECT',
    updates: { cancelReason: reason, cancelledAt: new Date() },
  });

  // 级联自动退款
  try {
    const fsm = getOrderFSM(order.order_type);
    fsm.assertTransition(OrderStatus.MERCHANT_REJECTED, OrderStatus.REFUNDED);
    const paidYuan = readDecimal(order.paid_amount);
    await updateOrder(orderId, {
      status: OrderStatus.REFUNDED,
      paymentStatus: PaymentStatus.FULL_REFUNDED,
      refundAmount: paidYuan,
    });
    await insertOrderLog({
      orderId,
      operatorType: 'SYSTEM',
      action: 'AUTO_REFUND',
      fromStatus: OrderStatus.MERCHANT_REJECTED,
      toStatus: OrderStatus.REFUNDED,
      remark: '商家拒单自动退款',
      extra: { refundAmount: yuanToFen(paidYuan) },
    });

    // payment 记录同步更新
    try {
      const { findPaymentByOrderId } = await import('../models/order.model');
      const payment = await findPaymentByOrderId(orderId);
      if (payment) {
        await updatePayment(payment.id, {
          status: PaymentStatus.FULL_REFUNDED,
          refundAmount: paidYuan,
        });
      }
    } catch (err) {
      logger.warn(
        `[order.reject] payment 更新失败 order=${orderId}: ${(err as Error).message}`,
      );
    }

    // 释放预扣库存（商品单）
    if (order.order_type === OrderType.PRODUCT) {
      try {
        const items = await listOrderItems(orderId);
        for (const it of items) {
          await updateSkuStock(it.sku_id, 'INCREMENT', it.quantity);
        }
      } catch (err) {
        logger.error(
          `[order.reject] 库存回滚失败 order=${orderId}: ${(err as Error).message}`,
        );
      }
    }
    // 回退优惠券
    if (order.coupon_record_id) {
      try {
        await releaseCouponRecordByOrder(order.coupon_record_id, orderId);
      } catch (err) {
        logger.warn(
          `[order.reject] 优惠券回退失败 order=${orderId}: ${(err as Error).message}`,
        );
      }
    }
  } catch (err) {
    logger.warn(
      `[order.reject] 自动退款推进失败 order=${orderId}: ${(err as Error).message}`,
    );
  }

  // 通知用户
  try {
    await notify({
      targetType: 'USER',
      targetId: order.user_id,
      type: OrderNotifyType.MERCHANT_REJECTED,
      title: '商家已拒单',
      content: `商家拒绝了订单 ${order.order_no}（${reason}），系统已发起全额退款。`,
      extra: {
        orderId: order.id,
        orderNo: order.order_no,
        reason,
        status: OrderStatus.REFUNDED,
      },
    });
  } catch (err) {
    logger.warn(`[order.reject] 通知失败 order=${order.id}: ${(err as Error).message}`);
  }

  return { orderId, status: OrderStatus.REFUNDED };
};

const notifyUserOfStatus = async (
  order: OrderRow,
  type: string,
  title: string,
  content: string,
  status: OrderStatus,
): Promise<void> => {
  try {
    await notify({
      targetType: 'USER',
      targetId: order.user_id,
      type,
      title,
      content,
      extra: { orderId: order.id, orderNo: order.order_no, status },
    });
  } catch (err) {
    logger.warn(
      `[order.${type}] 通知失败 order=${order.id}: ${(err as Error).message}`,
    );
  }
};

export const riderPickup = async (riderId: number, orderId: number) => {
  const order = await findOrderById(orderId);
  if (!order) throw new AppError(ErrorCode.ORDER_NOT_FOUND, '订单不存在', 404);
  if (order.rider_id !== riderId) {
    throw AppError.forbidden('不能操作他人订单');
  }
  await transitionStatus({
    order,
    to: OrderStatus.DELIVERING,
    operatorType: 'RIDER',
    operatorId: riderId,
    action: 'PICKUP',
    updates: { pickedUpAt: new Date() },
  });

  await notifyUserOfStatus(
    order,
    OrderNotifyType.RIDER_PICKUP,
    '骑手已取货',
    `骑手已取货并开始配送，订单 ${order.order_no}。`,
    OrderStatus.DELIVERING,
  );

  return { orderId, status: OrderStatus.DELIVERING };
};

export const riderDeliver = async (riderId: number, orderId: number) => {
  const order = await findOrderById(orderId);
  if (!order) throw new AppError(ErrorCode.ORDER_NOT_FOUND, '订单不存在', 404);
  if (order.rider_id !== riderId) throw AppError.forbidden('不能操作他人订单');
  await transitionStatus({
    order,
    to: OrderStatus.DELIVERED,
    operatorType: 'RIDER',
    operatorId: riderId,
    action: 'DELIVER',
    updates: { deliveredAt: new Date() },
  });

  await notifyUserOfStatus(
    order,
    OrderNotifyType.DELIVERED,
    '订单已送达',
    `您的订单 ${order.order_no} 已送达，如果没问题请尽快确认收货。`,
    OrderStatus.DELIVERED,
  );

  return { orderId, status: OrderStatus.DELIVERED };
};

export const riderDepart = async (riderId: number, orderId: number) => {
  const order = await findOrderById(orderId);
  if (!order) throw new AppError(ErrorCode.ORDER_NOT_FOUND, '订单不存在', 404);
  if (order.rider_id !== riderId) throw AppError.forbidden('不能操作他人订单');
  await transitionStatus({
    order,
    to: OrderStatus.ON_THE_WAY,
    operatorType: 'RIDER',
    operatorId: riderId,
    action: 'DEPART',
  });

  await notifyUserOfStatus(
    order,
    OrderNotifyType.RIDER_DEPART,
    '骑手已出发',
    `骑手正在前往取件（订单 ${order.order_no}）。`,
    OrderStatus.ON_THE_WAY,
  );

  return { orderId, status: OrderStatus.ON_THE_WAY };
};

export const riderStartService = async (riderId: number, orderId: number) => {
  const order = await findOrderById(orderId);
  if (!order) throw new AppError(ErrorCode.ORDER_NOT_FOUND, '订单不存在', 404);
  if (order.rider_id !== riderId) throw AppError.forbidden('不能操作他人订单');
  await transitionStatus({
    order,
    to: OrderStatus.IN_PROGRESS,
    operatorType: 'RIDER',
    operatorId: riderId,
    action: 'START_SERVICE',
  });

  await notifyUserOfStatus(
    order,
    OrderNotifyType.RIDER_IN_PROGRESS,
    '任务进行中',
    `骑手已到达取件点，任务进行中（订单 ${order.order_no}）。`,
    OrderStatus.IN_PROGRESS,
  );

  return { orderId, status: OrderStatus.IN_PROGRESS };
};

export const userComplete = async (userId: number, orderId: number) => {
  const order = await findOrderById(orderId);
  if (!order) throw new AppError(ErrorCode.ORDER_NOT_FOUND, '订单不存在', 404);
  if (order.user_id !== userId) throw AppError.forbidden('不能操作他人订单');
  await transitionStatus({
    order,
    to: OrderStatus.COMPLETED,
    operatorType: 'USER',
    operatorId: userId,
    action: 'COMPLETE',
    updates: { completedAt: new Date() },
  });
  // 触发结算（动态导入避免循环依赖）
  try {
    const { triggerSettlement } = await import('./settlement.service');
    await triggerSettlement(orderId);
    await updateOrder(orderId, { settlementStatus: 'SETTLED' });
  } catch (err) {
    logger.error(`订单 ${orderId} 结算失败: ${(err as Error).message}`);
  }
  return { orderId, status: OrderStatus.COMPLETED };
};

export const userCancel = async (userId: number, orderId: number, reason?: string) => {
  const order = await findOrderById(orderId);
  if (!order) throw new AppError(ErrorCode.ORDER_NOT_FOUND, '订单不存在', 404);
  if (order.user_id !== userId) throw AppError.forbidden('不能操作他人订单');

  // 使用"不可取消状态"清单做语义性校验（提供更好的用户体验错误码）
  const nonCancellable: OrderStatus[] = [
    OrderStatus.PENDING_PICKUP,
    OrderStatus.DELIVERING,
    OrderStatus.ON_THE_WAY,
    OrderStatus.IN_PROGRESS,
    OrderStatus.DELIVERED,
    OrderStatus.COMPLETED,
    OrderStatus.REFUNDED,
    OrderStatus.CANCELLED,
    OrderStatus.CLOSED_UNPAID,
    OrderStatus.MERCHANT_REJECTED,
    OrderStatus.MERCHANT_TIMEOUT,
    OrderStatus.AFTERSALE,
  ];
  if (nonCancellable.includes(order.status as OrderStatus)) {
    throw new AppError(
      ErrorCode.CANNOT_CANCEL_ORDER,
      `当前状态不能取消：${order.status}`,
      400,
    );
  }

  // FSM 合法性先校验，再做副作用（避免副作用后状态推进失败导致数据漂移）
  const fsm = getOrderFSM(order.order_type);
  fsm.assertTransition(order.status as OrderStatus, OrderStatus.CANCELLED);

  // 释放预扣库存（商品订单）
  if (order.order_type === OrderType.PRODUCT) {
    const items = await listOrderItems(orderId);
    for (const it of items) {
      await updateSkuStock(it.sku_id, 'INCREMENT', it.quantity);
    }
  }

  await transitionStatus({
    order,
    to: OrderStatus.CANCELLED,
    operatorType: 'USER',
    operatorId: userId,
    action: 'USER_CANCEL',
    updates: { cancelledAt: new Date(), cancelReason: reason ?? '' },
  });
  return { orderId, status: OrderStatus.CANCELLED };
};

// ============================= 查询 =============================

const parseJson = (v: unknown) => {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try {
    return typeof v === 'string' ? JSON.parse(v) : v;
  } catch {
    return v;
  }
};

/**
 * 校验当前登录者是否有权访问目标订单。
 * - USER：必须是下单人
 * - MERCHANT：订单对应门店必须归属该商家
 * - RIDER：必须是被指派/抢单的骑手
 * - ADMIN：放行
 *
 * 只要不匹配就抛 403，避免任何已登录账号随意查询他人订单详情、日志、支付号。
 */
export interface OrderRequester {
  userId: number;
  role: string;
}

const ensureOrderVisibleBy = async (
  order: OrderRow,
  requester: OrderRequester,
): Promise<void> => {
  if (requester.role === UserRole.ADMIN) return;
  if (requester.role === UserRole.USER) {
    if (order.user_id !== requester.userId) {
      throw AppError.forbidden('无权查看该订单');
    }
    return;
  }
  if (requester.role === UserRole.MERCHANT) {
    if (!order.store_id) {
      throw AppError.forbidden('无权查看该订单');
    }
    const store = await findStoreById(order.store_id);
    if (!store || store.merchant_id !== requester.userId) {
      throw AppError.forbidden('无权查看该订单');
    }
    return;
  }
  if (requester.role === UserRole.RIDER) {
    if (order.rider_id !== requester.userId) {
      throw AppError.forbidden('无权查看该订单');
    }
    return;
  }
  throw AppError.forbidden('无权查看该订单');
};

const formatOrder = (row: OrderRow) => ({
  id: row.id,
  orderNo: row.order_no,
  userId: row.user_id,
  storeId: row.store_id,
  riderId: row.rider_id,
  orderType: row.order_type,
  status: row.status,
  paymentStatus: row.payment_status,
  settlementStatus: row.settlement_status,
  totalAmount: yuanToFen(readDecimal(row.total_amount)),
  productAmount: yuanToFen(readDecimal(row.product_amount)),
  deliveryFee: yuanToFen(readDecimal(row.delivery_fee)),
  packingFee: yuanToFen(readDecimal(row.packing_fee)),
  extraFee: yuanToFen(readDecimal(row.extra_fee)),
  tipAmount: yuanToFen(readDecimal(row.tip_amount)),
  discountAmount: yuanToFen(readDecimal(row.discount_amount)),
  paidAmount: yuanToFen(readDecimal(row.paid_amount)),
  refundAmount: yuanToFen(readDecimal(row.refund_amount)),
  couponRecordId: row.coupon_record_id,
  contactName: row.contact_name,
  contactPhone: row.contact_phone,
  deliveryAddress: row.delivery_address,
  deliveryLat: readDecimal(row.delivery_lat),
  deliveryLng: readDecimal(row.delivery_lng),
  userRemark: row.user_remark,
  merchantRemark: row.merchant_remark,
  expectedDeliveryTime: row.expected_delivery_time,
  payDeadline: row.pay_deadline,
  merchantAcceptedAt: row.merchant_accepted_at,
  riderAcceptedAt: row.rider_accepted_at,
  pickedUpAt: row.picked_up_at,
  deliveredAt: row.delivered_at,
  completedAt: row.completed_at,
  cancelledAt: row.cancelled_at,
  cancelReason: row.cancel_reason,
  ratingScore: row.rating_score,
  ratingContent: row.rating_content,
  ratingImages: parseJson(row.rating_images),
  createdAt: row.created_at,
});

/**
 * 订单列表/详情的字段补齐：批量拉门店名、跑腿服务类型、首个商品预览，避免前端空标题、空摘要。
 * 没有命中的字段留空，由前端做兜底展示。
 */
const enrichOrders = async (
  baseList: ReturnType<typeof formatOrder>[],
  rawRows: OrderRow[],
): Promise<Array<ReturnType<typeof formatOrder> & {
  storeName: string;
  serviceType: string | null;
  errand: { serviceType: string; itemDescription: string } | null;
  items: Array<{
    productName: string;
    productImage: string;
    quantity: number;
  }>;
}>> => {
  if (baseList.length === 0) return [];

  const storeIds = Array.from(
    new Set(rawRows.map((r) => r.store_id).filter((x): x is number => !!x)),
  );
  const storeNameMap = new Map<number, string>();
  if (storeIds.length > 0) {
    const placeholders = storeIds.map(() => '?').join(',');
    const [rows] = await pool.execute<(OrderRow & { id: number; name: string })[]>(
      `SELECT id, name FROM stores WHERE id IN (${placeholders}) AND is_deleted = 0`,
      storeIds,
    );
    for (const r of rows as Array<{ id: number; name: string }>) {
      storeNameMap.set(r.id, r.name);
    }
  }

  const productOrderIds = rawRows
    .filter((r) => r.order_type === OrderType.PRODUCT)
    .map((r) => r.id);
  const itemsMap = new Map<number, Array<{
    productName: string;
    productImage: string;
    quantity: number;
  }>>();
  if (productOrderIds.length > 0) {
    const placeholders = productOrderIds.map(() => '?').join(',');
    const [rows] = await pool.execute<(OrderRow & {
      order_id: number;
      product_name: string;
      product_image: string;
      quantity: number;
    })[]>(
      `SELECT order_id, product_name, product_image, quantity FROM order_items
       WHERE order_id IN (${placeholders}) ORDER BY id ASC`,
      productOrderIds,
    );
    for (const r of rows as Array<{
      order_id: number;
      product_name: string;
      product_image: string;
      quantity: number;
    }>) {
      const arr = itemsMap.get(r.order_id) ?? [];
      arr.push({
        productName: r.product_name,
        productImage: r.product_image,
        quantity: r.quantity,
      });
      itemsMap.set(r.order_id, arr);
    }
  }

  const errandOrderIds = rawRows
    .filter((r) => r.order_type === OrderType.ERRAND)
    .map((r) => r.id);
  const errandInfoMap = new Map<number, { serviceType: string; itemDescription: string }>();
  if (errandOrderIds.length > 0) {
    const placeholders = errandOrderIds.map(() => '?').join(',');
    const [rows] = await pool.execute<(OrderRow & {
      order_id: number;
      service_type: string;
      item_description: string | null;
    })[]>(
      `SELECT order_id, service_type, item_description FROM errand_orders
       WHERE order_id IN (${placeholders})`,
      errandOrderIds,
    );
    for (const r of rows as Array<{
      order_id: number;
      service_type: string;
      item_description: string | null;
    }>) {
      errandInfoMap.set(r.order_id, {
        serviceType: r.service_type,
        itemDescription: r.item_description ?? '',
      });
    }
  }

  return baseList.map((base) => {
    const errandInfo = errandInfoMap.get(base.id);
    return {
      ...base,
      storeName: base.storeId ? (storeNameMap.get(base.storeId) ?? '') : '',
      serviceType: errandInfo?.serviceType ?? null,
      // 供前端列表页展示跑腿单摘要使用（item_description 优先于 userRemark）
      errand: errandInfo
        ? {
            serviceType: errandInfo.serviceType,
            itemDescription: errandInfo.itemDescription,
          }
        : null,
      items: itemsMap.get(base.id) ?? [],
    };
  });
};

export const getOrderDetail = async (
  orderId: number,
  requester: OrderRequester,
) => {
  const order = await findOrderById(orderId);
  if (!order) throw new AppError(ErrorCode.ORDER_NOT_FOUND, '订单不存在', 404);
  await ensureOrderVisibleBy(order, requester);
  const base = formatOrder(order);
  const items = await listOrderItems(orderId);
  const itemList = items.map((it) => ({
    id: it.id,
    productId: it.product_id,
    skuId: it.sku_id,
    productName: it.product_name,
    skuText: it.sku_text,
    productImage: it.product_image,
    price: yuanToFen(readDecimal(it.price)),
    quantity: it.quantity,
    subtotal: yuanToFen(readDecimal(it.subtotal)),
  }));
  const errand = await findErrandOrderByOrderId(orderId);
  const storeName = order.store_id
    ? (await findStoreById(order.store_id))?.name ?? ''
    : '';
  const rider = order.rider_id ? await findRiderById(order.rider_id) : null;
  return {
    ...base,
    storeName,
    serviceType: errand ? errand.service_type : null,
    items: itemList,
    rider: rider
      ? {
          id: rider.id,
          name: rider.name,
          phone: rider.phone,
          avatar: rider.avatar,
          rating: Number(readDecimal(rider.rating)),
          completedCount: rider.total_orders,
          lat: rider.current_lat === null ? 0 : Number(readDecimal(rider.current_lat)),
          lng: rider.current_lng === null ? 0 : Number(readDecimal(rider.current_lng)),
        }
      : null,
    errand: errand
      ? {
          serviceType: errand.service_type,
          pickupAddress: errand.pickup_address,
          pickupLat:
            errand.pickup_lat === null ? null : readDecimal(errand.pickup_lat),
          pickupLng:
            errand.pickup_lng === null ? null : readDecimal(errand.pickup_lng),
          pickupContactName: errand.pickup_contact_name,
          pickupContactPhone: errand.pickup_contact_phone,
          itemDescription: errand.item_description,
          itemWeight: readDecimal(errand.item_weight),
          floorInfo: errand.floor_info,
          hasElevator: errand.has_elevator === 1,
          budgetAmount: yuanToFen(readDecimal(errand.budget_amount)),
          distance: errand.distance,
          baseFee: yuanToFen(readDecimal(errand.base_fee)),
          distanceFee: yuanToFen(readDecimal(errand.distance_fee)),
          weightFee: yuanToFen(readDecimal(errand.weight_fee)),
          floorFee: yuanToFen(readDecimal(errand.floor_fee)),
          requiresReview: errand.requires_review === 1,
        }
      : null,
  };
};

export const listUserOrders = async (
  userId: number,
  status: string | undefined,
  orderType: string | undefined,
  page: number,
  pageSize: number,
) => {
  const { list, total } = await listOrders({
    userId,
    status,
    orderType,
    page,
    pageSize,
  });
  const base = list.map(formatOrder);
  const enriched = await enrichOrders(base, list);
  return {
    list: enriched,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const listMerchantOrders = async (
  merchantId: number,
  storeId: number | undefined,
  status: string | undefined,
  page: number,
  pageSize: number,
) => {
  // 若不传 storeId 则返回该商家全部门店；先查门店列表
  let storeIds: number[] = [];
  if (storeId) {
    const store = await findStoreById(storeId);
    if (!store || store.merchant_id !== merchantId) {
      throw new AppError(ErrorCode.STORE_FORBIDDEN, '不能访问他人门店订单', 403);
    }
    storeIds = [storeId];
  } else {
    const rows = await pool.execute<(OrderRow & { id: number })[]>(
      `SELECT id FROM stores WHERE merchant_id = ? AND is_deleted = 0`,
      [merchantId],
    );
    storeIds = (rows[0] as Array<{ id: number }>).map((x) => x.id);
    if (storeIds.length === 0) {
      return {
        list: [],
        pagination: { page, pageSize, total: 0, totalPages: 0 },
      };
    }
  }

  // 借用 listOrders 的过滤能力 —— 若多 store，用 in 子句手写
  const params: Array<string | number> = [...storeIds];
  let whereExtra = '';
  if (status) {
    whereExtra += ' AND status = ?';
    params.push(status);
  }
  const placeholders = storeIds.map(() => '?').join(',');
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.execute<OrderRow[]>(
    `SELECT * FROM orders
     WHERE is_deleted = 0 AND store_id IN (${placeholders})${whereExtra}
     ORDER BY id DESC LIMIT ${pageSize} OFFSET ${offset}`,
    params,
  );
  const [totalRows] = await pool.execute<(OrderRow & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM orders
     WHERE is_deleted = 0 AND store_id IN (${placeholders})${whereExtra}`,
    params,
  );
  const total = (totalRows as Array<{ total: number }>)[0]?.total ?? 0;
  const base = (rows as OrderRow[]).map(formatOrder);
  const enriched = await enrichOrders(base, rows as OrderRow[]);
  return {
    list: enriched,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const listRiderOrders = async (
  riderId: number,
  status: string | undefined,
  page: number,
  pageSize: number,
) => {
  const { list, total } = await listOrders({
    riderId,
    status,
    page,
    pageSize,
  });
  const base = list.map(formatOrder);
  const enriched = await enrichOrders(base, list);
  return {
    list: enriched,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const getOrderLogs = async (
  orderId: number,
  requester: OrderRequester,
) => {
  const order = await findOrderById(orderId);
  if (!order) throw new AppError(ErrorCode.ORDER_NOT_FOUND, '订单不存在', 404);
  await ensureOrderVisibleBy(order, requester);
  const logs = await listOrderLogs(orderId);
  return logs.map((l) => ({
    id: (l as { id: number }).id,
    action: (l as { action: string }).action,
    operatorType: (l as { operator_type: string }).operator_type,
    operatorId: (l as { operator_id: number | null }).operator_id,
    fromStatus: (l as { from_status: string }).from_status,
    toStatus: (l as { to_status: string }).to_status,
    remark: (l as { remark: string }).remark,
    extra: parseJson((l as { extra: unknown }).extra),
    createdAt: (l as { created_at: Date }).created_at,
  }));
};

/** 根据订单号或 id 查支付记录用于"模拟回调"（测试场景）。需校验归属，否则任意登录者都能拿到别人订单的 paymentNo。 */
export const getPaymentByOrderNo = async (
  orderNo: string,
  requester: OrderRequester,
) => {
  const order = await findOrderByNo(orderNo);
  if (!order) throw new AppError(ErrorCode.ORDER_NOT_FOUND, '订单不存在', 404);
  await ensureOrderVisibleBy(order, requester);
  const { findPaymentByOrderId } = await import('../models/order.model');
  const payment = await findPaymentByOrderId(order.id);
  if (!payment) throw new AppError(ErrorCode.DATA_NOT_FOUND, '支付记录不存在', 404);
  return {
    paymentNo: payment.payment_no,
    amountFen: yuanToFen(readDecimal(payment.amount)),
    status: payment.status,
  };
};
