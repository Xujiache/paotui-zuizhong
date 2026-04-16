/**
 * 通用状态机工具（订单/售后/支付状态流转）
 *
 * 用法：
 *   const sm = new StateMachine<OrderStatus>({
 *     PENDING_PAYMENT: [OrderStatus.PENDING_MERCHANT, OrderStatus.CLOSED_UNPAID],
 *     PENDING_MERCHANT: [...],
 *   });
 *   sm.assertTransition(current, next);  // 非法跳转抛 AppError(16005)
 */

import { AppError } from './AppError';
import { ErrorCode } from '../types/enums';

export type TransitionTable<S extends string> = Record<S, S[]>;

export class StateMachine<S extends string> {
  constructor(private readonly table: TransitionTable<S>) {}

  canTransition(from: S, to: S): boolean {
    const allowed = this.table[from];
    if (!allowed) return false;
    return allowed.includes(to);
  }

  assertTransition(from: S, to: S, message?: string): void {
    if (!this.canTransition(from, to)) {
      throw new AppError(
        ErrorCode.ORDER_STATUS_INVALID,
        message || `非法状态流转：${from} → ${to}`,
        400,
      );
    }
  }

  nextStates(from: S): S[] {
    return this.table[from] ?? [];
  }

  isTerminal(state: S): boolean {
    const next = this.table[state];
    return !next || next.length === 0;
  }
}
