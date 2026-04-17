/**
 * 支付超时自动关闭（PRD OC-08 / EX-01）
 *
 * 规则：PENDING_PAYMENT 状态、pay_deadline 过期 → CLOSED_UNPAID
 * 副作用：
 *   - 释放预扣库存（仅商品单）
 *   - 回滚已占用的优惠券（若有）
 *   - payment 置 PAY_FAILED
 *   - 给用户发一条站内消息/WS 推送
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
import { updateSkuStock } from '../models/product.model';
import { releaseCouponRecordByOrder } from '../models/coupon.model';
import { getOrderFSM } from '../services/orderStateMachine';
import { notify, OrderNotifyType } from '../services/notification.service';
import { OrderStatus, OrderType, PaymentStatus } from '../types/enums';
import logger from '../utils/logger';

const BATCH_SIZE = 100;

const listExpiredPayments = async (): Promise<OrderRow[]> => {
  const [rows] = await pool.execute<OrderRow[]>(
    `SELECT * FROM orders
     WHERE status = ? AND pay_deadline IS NOT NULL AND pay_deadline < NOW()
       AND is_deleted = 0
     ORDER BY id ASC LIMIT ${BATCH_SIZE}`,
    [OrderStatus.PENDING_PAYMENT],
  );
  return rows as OrderRow[];
};

const closeOne = async (order: OrderRow): Promise<void> => {
  const fsm = getOrderFSM(order.order_type);
  try {
    fsm.assertTransition(order.status as OrderStatus, OrderStatus.CLOSED_UNPAID);
  } catch {
    // FSM 已不合法（并发下其它路径推进过），跳过
    return;
  }

  await updateOrder(order.id, {
    status: OrderStatus.CLOSED_UNPAID,
    paymentStatus: PaymentStatus.PAY_FAILED,
    cancelledAt: new Date(),
    cancelReason: '支付超时自动关闭',
  });

  await insertOrderLog({
    orderId: order.id,
    operatorType: 'SYSTEM',
    action: 'PAY_TIMEOUT_CLOSE',
    fromStatus: order.status,
    toStatus: OrderStatus.CLOSED_UNPAID,
    remark: '支付超时，订单自动关闭',
  });

  // 释放预扣库存（仅商品单）
  if (order.order_type === OrderType.PRODUCT) {
    try {
      const items = await listOrderItems(order.id);
      for (const it of items) {
        await updateSkuStock(it.sku_id, 'INCREMENT', it.quantity);
      }
    } catch (err) {
      logger.error(
        `[tasks/payTimeout] order=${order.id} 库存回滚失败: ${(err as Error).message}`,
      );
    }
  }

  // 释放优惠券（若下单时已标记 USED）
  if (order.coupon_record_id) {
    try {
      await releaseCouponRecordByOrder(order.coupon_record_id, order.id);
    } catch (err) {
      logger.warn(
        `[tasks/payTimeout] order=${order.id} 优惠券回退失败: ${(err as Error).message}`,
      );
    }
  }

  // 把相关 payment 标记失败（如果存在）
  try {
    const payment = await findPaymentByOrderId(order.id);
    if (payment && payment.status === PaymentStatus.UNPAID) {
      await updatePayment(payment.id, { status: PaymentStatus.PAY_FAILED });
    }
  } catch (err) {
    logger.warn(
      `[tasks/payTimeout] order=${order.id} payment 更新失败: ${(err as Error).message}`,
    );
  }

  // 通知用户
  try {
    await notify({
      targetType: 'USER',
      targetId: order.user_id,
      type: OrderNotifyType.PAY_TIMEOUT,
      title: '订单已关闭',
      content: `您的订单 ${order.order_no} 因支付超时已自动关闭，如已扣款请查看退款进度。`,
      extra: { orderId: order.id, orderNo: order.order_no, status: OrderStatus.CLOSED_UNPAID },
    });
  } catch (err) {
    logger.warn(
      `[tasks/payTimeout] order=${order.id} 通知失败: ${(err as Error).message}`,
    );
  }
};

export const runPaymentTimeoutTask = async (): Promise<number> => {
  const expired = await listExpiredPayments();
  if (expired.length === 0) return 0;
  let processed = 0;
  for (const order of expired) {
    try {
      await closeOne(order);
      processed++;
    } catch (err) {
      logger.error(
        `[tasks/payTimeout] order=${order.id} 关闭失败: ${(err as Error).message}`,
      );
    }
  }
  if (processed > 0) {
    logger.info(`[tasks/payTimeout] 已关闭 ${processed} 笔超时未支付订单`);
  }
  return processed;
};

export default runPaymentTimeoutTask;
