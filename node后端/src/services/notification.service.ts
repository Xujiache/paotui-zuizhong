/**
 * 通知中心（PRD §9.6 通知触点统一入口）
 *
 * 一个通知事件 = 一条持久化站内消息 + 一次 WebSocket 实时推送（尽力而为）。
 * - DB 写失败会抛错；WS 推送失败仅降级记日志，不阻塞主流程。
 * - 订单相关的 extra 建议至少携带 { orderId, status }，方便前端路由跳转。
 */

import { insertMessage } from '../models/message.model';
import { pushTo, WsRole } from '../websocket';
import logger from '../utils/logger';

export type NotifyTargetType = 'USER' | 'MERCHANT' | 'RIDER' | 'ADMIN';

export interface NotifyParams {
  targetType: NotifyTargetType;
  targetId: number;
  type: string;
  title: string;
  content: string;
  extra?: Record<string, unknown>;
  /**
   * 仅推送到 WS，不写站内消息。适用于高频事件（例如骑手实时位置）。
   */
  wsOnly?: boolean;
}

export const notify = async (params: NotifyParams): Promise<void> => {
  const { targetType, targetId, type, title, content, extra, wsOnly } = params;

  if (!wsOnly) {
    try {
      await insertMessage({ targetType, targetId, type, title, content, extra });
    } catch (err) {
      logger.error(
        `[Notify] 站内消息写入失败 target=${targetType}:${targetId} type=${type}: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  try {
    pushTo(targetType as WsRole, targetId, type, {
      title,
      content,
      ...(extra ?? {}),
    });
  } catch (err) {
    logger.warn(`[Notify] WS 推送失败（降级静默）: ${(err as Error).message}`);
  }
};

/**
 * 批量通知（用于群发场景，逐个失败自动跳过）。
 */
export const notifyMany = async (
  targets: Array<{ targetType: NotifyTargetType; targetId: number }>,
  payload: Omit<NotifyParams, 'targetType' | 'targetId'>,
): Promise<{ total: number; ok: number }> => {
  let ok = 0;
  for (const t of targets) {
    try {
      await notify({ ...payload, targetType: t.targetType, targetId: t.targetId });
      ok++;
    } catch {
      /* 单个失败不影响其他目标 */
    }
  }
  return { total: targets.length, ok };
};

/**
 * 订单通知类型常量（供前端和测试参照）。
 */
export const OrderNotifyType = {
  PAID: 'order.paid',
  MERCHANT_ACCEPTED: 'order.merchant_accepted',
  MERCHANT_REJECTED: 'order.merchant_rejected',
  MERCHANT_TIMEOUT: 'order.merchant_timeout',
  PAY_TIMEOUT: 'order.pay_timeout',
  RIDER_GRABBED: 'order.rider_grabbed',
  RIDER_PICKUP: 'order.rider_pickup',
  RIDER_DEPART: 'order.rider_depart',
  RIDER_IN_PROGRESS: 'order.rider_in_progress',
  DELIVERED: 'order.delivered',
  COMPLETED: 'order.completed',
  AUTO_COMPLETED: 'order.auto_completed',
  CANCELLED: 'order.cancelled',
  REFUNDED: 'order.refunded',
  MERCHANT_NEW_ORDER: 'order.merchant_new_order',
  DISPATCH_NEW_ORDER: 'order.dispatch_new_order',
  DISPATCH_EXPANDED: 'order.dispatch_expanded',
} as const;

export default { notify, notifyMany, OrderNotifyType };
