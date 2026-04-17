/**
 * 商家接单超时自动关闭并退款（PRD OC-11 / EX-02）
 *
 * 规则：
 *   - PENDING_MERCHANT 且 updated_at（即进入该状态时间）早于阈值 → MERCHANT_TIMEOUT → REFUNDED
 *   - 阈值来自 process.env.MERCHANT_ACCEPT_TIMEOUT_MINUTES，默认 5 分钟
 * 副作用：
 *   - 释放预扣库存（商品单）
 *   - 回退优惠券（若有）
 *   - payment 标记 FULL_REFUNDED（首期 mock 退款；真实接入微信退款在后续阶段）
 *   - 给用户/商家各发一条通知
 */

import { pool } from '../utils/database';
import {
  OrderRow,
  findPaymentByOrderId,
  insertOrderLog,
  listOrderItems,
  updateOrder,
  updatePayment,
} from '../models/order.model';
import { findStoreById } from '../models/store.model';
import { updateSkuStock } from '../models/product.model';
import { releaseCouponRecordByOrder } from '../models/coupon.model';
import { getOrderFSM } from '../services/orderStateMachine';
import { notify, OrderNotifyType } from '../services/notification.service';
import { OrderStatus, OrderType, PaymentStatus } from '../types/enums';
import { readDecimal, yuanToFen } from '../utils/money';
import logger from '../utils/logger';

const BATCH_SIZE = 100;

const timeoutMinutes = (): number => {
  const raw = parseInt(process.env.MERCHANT_ACCEPT_TIMEOUT_MINUTES || '5', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
};

const listPendingMerchantOverdue = async (): Promise<OrderRow[]> => {
  const mins = timeoutMinutes();
  const [rows] = await pool.execute<OrderRow[]>(
    `SELECT * FROM orders
     WHERE status = ? AND updated_at < NOW() - INTERVAL ${mins} MINUTE
       AND is_deleted = 0 AND order_type = ?
     ORDER BY id ASC LIMIT ${BATCH_SIZE}`,
    [OrderStatus.PENDING_MERCHANT, OrderType.PRODUCT],
  );
  return rows as OrderRow[];
};

const closeOne = async (order: OrderRow): Promise<void> => {
  const fsm = getOrderFSM(order.order_type);

  try {
    fsm.assertTransition(order.status as OrderStatus, OrderStatus.MERCHANT_TIMEOUT);
  } catch {
    return;
  }

  // Step 1: 进入 MERCHANT_TIMEOUT
  await updateOrder(order.id, {
    status: OrderStatus.MERCHANT_TIMEOUT,
    cancelledAt: new Date(),
    cancelReason: '商家接单超时',
  });
  await insertOrderLog({
    orderId: order.id,
    operatorType: 'SYSTEM',
    action: 'MERCHANT_TIMEOUT',
    fromStatus: order.status,
    toStatus: OrderStatus.MERCHANT_TIMEOUT,
    remark: `商家 ${timeoutMinutes()} 分钟未接单，订单自动关闭`,
  });

  // Step 2: 推进到 REFUNDED（自动全额退款）
  const paidAmountFen = yuanToFen(readDecimal(order.paid_amount));
  try {
    fsm.assertTransition(OrderStatus.MERCHANT_TIMEOUT, OrderStatus.REFUNDED);
    await updateOrder(order.id, {
      status: OrderStatus.REFUNDED,
      paymentStatus: PaymentStatus.FULL_REFUNDED,
      refundAmount: readDecimal(order.paid_amount),
    });
    await insertOrderLog({
      orderId: order.id,
      operatorType: 'SYSTEM',
      action: 'AUTO_REFUND',
      fromStatus: OrderStatus.MERCHANT_TIMEOUT,
      toStatus: OrderStatus.REFUNDED,
      remark: '商家超时自动退款',
      extra: { refundAmount: paidAmountFen },
    });
  } catch (err) {
    logger.warn(
      `[tasks/merchantTimeout] order=${order.id} 退款状态推进失败: ${(err as Error).message}`,
    );
  }

  // 副作用：库存、优惠券、payment
  if (order.order_type === OrderType.PRODUCT) {
    try {
      const items = await listOrderItems(order.id);
      for (const it of items) {
        await updateSkuStock(it.sku_id, 'INCREMENT', it.quantity);
      }
    } catch (err) {
      logger.error(
        `[tasks/merchantTimeout] order=${order.id} 库存回滚失败: ${(err as Error).message}`,
      );
    }
  }
  if (order.coupon_record_id) {
    try {
      await releaseCouponRecordByOrder(order.coupon_record_id, order.id);
    } catch (err) {
      logger.warn(
        `[tasks/merchantTimeout] order=${order.id} 优惠券回退失败: ${(err as Error).message}`,
      );
    }
  }
  try {
    const payment = await findPaymentByOrderId(order.id);
    if (payment) {
      await updatePayment(payment.id, {
        status: PaymentStatus.FULL_REFUNDED,
        refundAmount: readDecimal(order.paid_amount),
      });
    }
  } catch (err) {
    logger.warn(
      `[tasks/merchantTimeout] order=${order.id} payment 更新失败: ${(err as Error).message}`,
    );
  }

  // 通知用户
  try {
    await notify({
      targetType: 'USER',
      targetId: order.user_id,
      type: OrderNotifyType.MERCHANT_TIMEOUT,
      title: '商家超时未接单',
      content: `很抱歉，订单 ${order.order_no} 因商家超时未接单已自动取消并全额退款。`,
      extra: {
        orderId: order.id,
        orderNo: order.order_no,
        status: OrderStatus.REFUNDED,
        refundAmount: paidAmountFen,
      },
    });
  } catch (err) {
    logger.warn(
      `[tasks/merchantTimeout] order=${order.id} 用户通知失败: ${(err as Error).message}`,
    );
  }

  // 通知商家（用于后台统计 / 商家端 APP 自检）
  if (order.store_id) {
    try {
      const store = await findStoreById(order.store_id);
      if (store) {
        await notify({
          targetType: 'MERCHANT',
          targetId: store.merchant_id,
          type: OrderNotifyType.MERCHANT_TIMEOUT,
          title: '接单超时',
          content: `订单 ${order.order_no} 已因商家超时未接单被系统自动取消，请检查 APP 播报与在线状态。`,
          extra: { orderId: order.id, orderNo: order.order_no, storeId: order.store_id },
        });
      }
    } catch (err) {
      logger.warn(
        `[tasks/merchantTimeout] order=${order.id} 商家通知失败: ${(err as Error).message}`,
      );
    }
  }
};

export const runMerchantTimeoutTask = async (): Promise<number> => {
  const expired = await listPendingMerchantOverdue();
  if (expired.length === 0) return 0;
  let processed = 0;
  for (const order of expired) {
    try {
      await closeOne(order);
      processed++;
    } catch (err) {
      logger.error(
        `[tasks/merchantTimeout] order=${order.id} 处理失败: ${(err as Error).message}`,
      );
    }
  }
  if (processed > 0) {
    logger.info(`[tasks/merchantTimeout] 已处理 ${processed} 笔商家接单超时订单`);
  }
  return processed;
};

export default runMerchantTimeoutTask;
