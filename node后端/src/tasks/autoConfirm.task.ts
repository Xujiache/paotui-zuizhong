/**
 * 自动确认收货（PRD OC-17）
 *
 * 规则：status=DELIVERED 且 delivered_at 早于阈值 → COMPLETED，并触发结算
 * 阈值来自 process.env.AUTO_CONFIRM_HOURS，默认 24 小时
 */

import { pool } from '../utils/database';
import { OrderRow, insertOrderLog, updateOrder } from '../models/order.model';
import { getOrderFSM } from '../services/orderStateMachine';
import { triggerSettlement } from '../services/settlement.service';
import { notify, OrderNotifyType } from '../services/notification.service';
import { OrderStatus, SettlementStatus } from '../types/enums';
import logger from '../utils/logger';

const BATCH_SIZE = 100;

const autoConfirmHours = (): number => {
  const raw = parseInt(process.env.AUTO_CONFIRM_HOURS || '24', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 24;
};

const listDeliveredOverdue = async (): Promise<OrderRow[]> => {
  const hrs = autoConfirmHours();
  const [rows] = await pool.execute<OrderRow[]>(
    `SELECT * FROM orders
     WHERE status = ? AND delivered_at IS NOT NULL
       AND delivered_at < NOW() - INTERVAL ${hrs} HOUR
       AND is_deleted = 0
     ORDER BY id ASC LIMIT ${BATCH_SIZE}`,
    [OrderStatus.DELIVERED],
  );
  return rows as OrderRow[];
};

const confirmOne = async (order: OrderRow): Promise<void> => {
  const fsm = getOrderFSM(order.order_type);
  try {
    fsm.assertTransition(order.status as OrderStatus, OrderStatus.COMPLETED);
  } catch {
    return;
  }

  await updateOrder(order.id, {
    status: OrderStatus.COMPLETED,
    completedAt: new Date(),
  });
  await insertOrderLog({
    orderId: order.id,
    operatorType: 'SYSTEM',
    action: 'AUTO_CONFIRM',
    fromStatus: order.status,
    toStatus: OrderStatus.COMPLETED,
    remark: `送达 ${autoConfirmHours()} 小时自动确认收货`,
  });

  // 触发结算（静默）
  try {
    await triggerSettlement(order.id);
    await updateOrder(order.id, { settlementStatus: SettlementStatus.SETTLED });
  } catch (err) {
    logger.error(
      `[tasks/autoConfirm] order=${order.id} 结算触发失败: ${(err as Error).message}`,
    );
  }

  try {
    await notify({
      targetType: 'USER',
      targetId: order.user_id,
      type: OrderNotifyType.AUTO_COMPLETED,
      title: '订单已自动完成',
      content: `您的订单 ${order.order_no} 送达超过 ${autoConfirmHours()} 小时，系统已自动确认收货。`,
      extra: { orderId: order.id, orderNo: order.order_no, status: OrderStatus.COMPLETED },
    });
  } catch (err) {
    logger.warn(
      `[tasks/autoConfirm] order=${order.id} 通知失败: ${(err as Error).message}`,
    );
  }
};

export const runAutoConfirmTask = async (): Promise<number> => {
  const overdue = await listDeliveredOverdue();
  if (overdue.length === 0) return 0;
  let processed = 0;
  for (const order of overdue) {
    try {
      await confirmOne(order);
      processed++;
    } catch (err) {
      logger.error(
        `[tasks/autoConfirm] order=${order.id} 处理失败: ${(err as Error).message}`,
      );
    }
  }
  if (processed > 0) {
    logger.info(`[tasks/autoConfirm] 已自动确认 ${processed} 笔订单`);
  }
  return processed;
};

export default runAutoConfirmTask;
