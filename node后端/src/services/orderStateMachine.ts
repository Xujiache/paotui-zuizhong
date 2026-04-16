/**
 * 订单状态机（商品订单 + 跑腿订单）
 *
 * 对齐 PRD《接口规范与状态机.md》§三 / §四：
 * - 商品订单：PENDING_PAYMENT → PENDING_MERCHANT → PENDING_RIDER → PENDING_PICKUP → DELIVERING → DELIVERED → COMPLETED
 * - 跑腿订单：PENDING_PAYMENT → PENDING_DISPATCH/PENDING_REVIEW → RIDER_ACCEPTED → ON_THE_WAY → IN_PROGRESS → DELIVERED → COMPLETED
 */

import { OrderStatus, OrderType } from '../types/enums';
import { StateMachine } from '../utils/stateMachine';

export const productOrderFSM = new StateMachine<OrderStatus>({
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PENDING_MERCHANT, OrderStatus.CLOSED_UNPAID],
  [OrderStatus.PENDING_MERCHANT]: [
    OrderStatus.PENDING_RIDER,
    OrderStatus.MERCHANT_REJECTED,
    OrderStatus.MERCHANT_TIMEOUT,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PENDING_RIDER]: [OrderStatus.PENDING_PICKUP, OrderStatus.CANCELLED],
  [OrderStatus.PENDING_PICKUP]: [OrderStatus.DELIVERING, OrderStatus.AFTERSALE],
  [OrderStatus.DELIVERING]: [OrderStatus.DELIVERED, OrderStatus.AFTERSALE],
  [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED, OrderStatus.AFTERSALE],
  [OrderStatus.AFTERSALE]: [OrderStatus.REFUNDED, OrderStatus.COMPLETED],
  [OrderStatus.CANCELLED]: [OrderStatus.REFUNDED],
  // 终态
  [OrderStatus.CLOSED_UNPAID]: [],
  [OrderStatus.MERCHANT_REJECTED]: [OrderStatus.REFUNDED],
  [OrderStatus.MERCHANT_TIMEOUT]: [OrderStatus.REFUNDED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.REFUNDED]: [],
  // 跑腿专属状态在商品订单里不应出现
  [OrderStatus.PENDING_REVIEW]: [],
  [OrderStatus.PENDING_DISPATCH]: [],
  [OrderStatus.RIDER_ACCEPTED]: [],
  [OrderStatus.ON_THE_WAY]: [],
  [OrderStatus.IN_PROGRESS]: [],
});

export const errandOrderFSM = new StateMachine<OrderStatus>({
  [OrderStatus.PENDING_PAYMENT]: [
    OrderStatus.PENDING_REVIEW,
    OrderStatus.PENDING_DISPATCH,
    OrderStatus.CLOSED_UNPAID,
  ],
  [OrderStatus.PENDING_REVIEW]: [OrderStatus.PENDING_DISPATCH, OrderStatus.REFUNDED],
  [OrderStatus.PENDING_DISPATCH]: [OrderStatus.RIDER_ACCEPTED, OrderStatus.CANCELLED],
  [OrderStatus.RIDER_ACCEPTED]: [OrderStatus.ON_THE_WAY, OrderStatus.AFTERSALE],
  [OrderStatus.ON_THE_WAY]: [OrderStatus.IN_PROGRESS, OrderStatus.AFTERSALE],
  [OrderStatus.IN_PROGRESS]: [OrderStatus.DELIVERED, OrderStatus.AFTERSALE],
  [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED, OrderStatus.AFTERSALE],
  [OrderStatus.AFTERSALE]: [OrderStatus.REFUNDED, OrderStatus.COMPLETED],
  [OrderStatus.CANCELLED]: [OrderStatus.REFUNDED],
  // 终态
  [OrderStatus.CLOSED_UNPAID]: [],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.REFUNDED]: [],
  // 商品订单专属状态在跑腿订单里不应出现
  [OrderStatus.PENDING_MERCHANT]: [],
  [OrderStatus.MERCHANT_REJECTED]: [],
  [OrderStatus.MERCHANT_TIMEOUT]: [],
  [OrderStatus.PENDING_RIDER]: [],
  [OrderStatus.PENDING_PICKUP]: [],
  [OrderStatus.DELIVERING]: [],
});

export const getOrderFSM = (orderType: OrderType | string): StateMachine<OrderStatus> =>
  orderType === OrderType.ERRAND ? errandOrderFSM : productOrderFSM;
