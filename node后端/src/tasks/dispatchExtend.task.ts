/**
 * 调度扩圈推送（PRD DC-07 / EX-10）
 *
 * 规则：在调度池中停留过久（PENDING_RIDER / PENDING_DISPATCH）且尚未被扩圈过的订单 → 写 EXPAND_RADIUS 日志 + 通知管理员
 * 阈值来自 process.env.DISPATCH_EXPAND_MINUTES，默认 5 分钟
 *
 * 首期仅做"标记 + 提醒平台介入"，真实扩大推送范围留到 06 骑手端阶段接入自动派单时实现。
 */

import { pool } from '../utils/database';
import { OrderRow, insertOrderLog } from '../models/order.model';
import { notify, OrderNotifyType } from '../services/notification.service';
import { OrderStatus, OrderType } from '../types/enums';
import { RowDataPacket } from 'mysql2';
import logger from '../utils/logger';

const BATCH_SIZE = 100;

const expandMinutes = (): number => {
  const raw = parseInt(process.env.DISPATCH_EXPAND_MINUTES || '5', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
};

const listOverdueInPool = async (): Promise<OrderRow[]> => {
  const mins = expandMinutes();
  const [rows] = await pool.execute<OrderRow[]>(
    `SELECT o.* FROM orders o
     WHERE o.status IN (?, ?)
       AND o.updated_at < NOW() - INTERVAL ${mins} MINUTE
       AND o.is_deleted = 0
       AND NOT EXISTS (
         SELECT 1 FROM order_logs l
         WHERE l.order_id = o.id AND l.action = 'EXPAND_RADIUS'
       )
     ORDER BY o.id ASC LIMIT ${BATCH_SIZE}`,
    [OrderStatus.PENDING_RIDER, OrderStatus.PENDING_DISPATCH],
  );
  return rows as OrderRow[];
};

const listPlatformAdmins = async (): Promise<number[]> => {
  const [rows] = await pool.execute<(RowDataPacket & { id: number })[]>(
    `SELECT id FROM admins WHERE is_deleted = 0 AND status = 'ACTIVE' LIMIT 20`,
  );
  return (rows as Array<{ id: number }>).map((r) => r.id);
};

const expandOne = async (order: OrderRow, adminIds: number[]): Promise<void> => {
  await insertOrderLog({
    orderId: order.id,
    operatorType: 'SYSTEM',
    action: 'EXPAND_RADIUS',
    remark: `调度停留超过 ${expandMinutes()} 分钟，触发扩圈推送`,
    extra: {
      orderType: order.order_type,
      status: order.status,
    },
  });

  // 通知平台客服/运营（用于介入）
  const title =
    order.order_type === OrderType.ERRAND ? '跑腿订单长时间无人接单' : '商品订单长时间无人接单';
  for (const adminId of adminIds) {
    try {
      await notify({
        targetType: 'ADMIN',
        targetId: adminId,
        type: OrderNotifyType.DISPATCH_EXPANDED,
        title,
        content: `订单 ${order.order_no} 在调度池停留已超过 ${expandMinutes()} 分钟，需要人工介入或扩大推送范围。`,
        extra: {
          orderId: order.id,
          orderNo: order.order_no,
          status: order.status,
          orderType: order.order_type,
        },
      });
    } catch (err) {
      logger.warn(
        `[tasks/dispatchExtend] order=${order.id} admin=${adminId} 通知失败: ${(err as Error).message}`,
      );
    }
  }
};

export const runDispatchExtendTask = async (): Promise<number> => {
  const overdue = await listOverdueInPool();
  if (overdue.length === 0) return 0;
  const adminIds = await listPlatformAdmins();
  let processed = 0;
  for (const order of overdue) {
    try {
      await expandOne(order, adminIds);
      processed++;
    } catch (err) {
      logger.error(
        `[tasks/dispatchExtend] order=${order.id} 处理失败: ${(err as Error).message}`,
      );
    }
  }
  if (processed > 0) {
    logger.info(`[tasks/dispatchExtend] 已标记 ${processed} 笔订单扩圈`);
  }
  return processed;
};

export default runDispatchExtendTask;
