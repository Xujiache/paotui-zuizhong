/**
 * 调度中心
 *
 * 订单池：基于 orders 表的 status 字段查询（PENDING_RIDER / PENDING_DISPATCH）。
 * 抢单：Redis 分布式锁 + 二次状态检查，确保并发下只有一个骑手成功。
 */

import { AppError } from '../utils/AppError';
import {
  ErrorCode,
  OrderStatus,
  OrderType,
  AuditStatus,
  OnlineStatus,
} from '../types/enums';
import { redisClient } from '../utils/redis';
import { redisConfig } from '../config/redis';
import {
  findOrderById,
  listOrders,
  updateOrder,
  insertOrderLog,
  OrderRow,
} from '../models/order.model';
import { findRiderById } from '../models/rider.model';
import { haversineMeters } from '../utils/geo';
import { readDecimal } from '../utils/money';
import { getOrderFSM } from './orderStateMachine';

const GRAB_LOCK_TTL = 30;

const formatOrderForPool = (row: OrderRow, distance: number) => ({
  id: row.id,
  orderNo: row.order_no,
  orderType: row.order_type,
  status: row.status,
  storeId: row.store_id,
  contactName: row.contact_name,
  contactPhone: row.contact_phone,
  deliveryAddress: row.delivery_address,
  deliveryLat: readDecimal(row.delivery_lat),
  deliveryLng: readDecimal(row.delivery_lng),
  deliveryFee: readDecimal(row.delivery_fee),
  createdAt: row.created_at,
  distance,
});

export interface PoolQueryParams {
  lat: number;
  lng: number;
  radius: number;
  orderType?: OrderType | string;
  page: number;
  pageSize: number;
}

/**
 * 骑手查看订单池：获取所有候选订单 → 应用 Haversine 精筛
 * 候选集合：PRODUCT 类型 status=PENDING_RIDER；ERRAND 类型 status=PENDING_DISPATCH
 */
export const getOrderPool = async (params: PoolQueryParams) => {
  const candidates: OrderRow[] = [];

  if (!params.orderType || params.orderType === OrderType.PRODUCT) {
    const { list } = await listOrders({
      status: OrderStatus.PENDING_RIDER,
      orderType: OrderType.PRODUCT,
      page: 1,
      pageSize: 200,
    });
    candidates.push(...list);
  }
  if (!params.orderType || params.orderType === OrderType.ERRAND) {
    const { list } = await listOrders({
      status: OrderStatus.PENDING_DISPATCH,
      orderType: OrderType.ERRAND,
      page: 1,
      pageSize: 200,
    });
    candidates.push(...list);
  }

  const scored = candidates
    .map((row) => ({
      row,
      distance: haversineMeters(
        { lat: params.lat, lng: params.lng },
        {
          lat: Number(readDecimal(row.delivery_lat)),
          lng: Number(readDecimal(row.delivery_lng)),
        },
      ),
    }))
    .filter((x) => x.distance <= params.radius)
    .sort((a, b) => a.distance - b.distance);

  const total = scored.length;
  const offset = (params.page - 1) * params.pageSize;
  const sliced = scored.slice(offset, offset + params.pageSize);

  return {
    list: sliced.map((x) => formatOrderForPool(x.row, x.distance)),
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
};

/**
 * 骑手抢单：Redis SETNX 锁 + 状态二次校验
 * 成功后将订单状态推进到 PENDING_PICKUP（商品单）或 RIDER_ACCEPTED（跑腿单）
 */
export const grabOrder = async (riderId: number, orderId: number) => {
  const rider = await findRiderById(riderId);
  if (!rider) throw AppError.notFound('骑手不存在');
  if (rider.audit_status !== AuditStatus.APPROVED) {
    throw new AppError(ErrorCode.RIDER_AUDIT_NOT_PASSED, '骑手审核未通过', 400);
  }
  if (rider.online_status !== OnlineStatus.ONLINE) {
    throw new AppError(ErrorCode.RIDER_NOT_ONLINE, '骑手未在线，不能抢单', 400);
  }

  const lockKey = `${redisConfig.keyPrefix}dispatch:lock:${orderId}`;
  const lockValue = `rider:${riderId}:${Date.now()}`;
  const lockOk = await redisClient.set(lockKey, lockValue, {
    NX: true,
    EX: GRAB_LOCK_TTL,
  });
  if (lockOk !== 'OK') {
    throw new AppError(ErrorCode.ORDER_GRABBED_BY_OTHER, '订单已被其他骑手抢走', 409);
  }

  try {
    const order = await findOrderById(orderId);
    if (!order) throw new AppError(ErrorCode.ORDER_NOT_FOUND, '订单不存在', 404);

    const nextStatus =
      order.order_type === OrderType.PRODUCT
        ? OrderStatus.PENDING_PICKUP
        : OrderStatus.RIDER_ACCEPTED;

    const expectedFrom =
      order.order_type === OrderType.PRODUCT
        ? OrderStatus.PENDING_RIDER
        : OrderStatus.PENDING_DISPATCH;

    if (order.status !== expectedFrom) {
      throw new AppError(
        ErrorCode.ORDER_GRABBED_BY_OTHER,
        `订单不可抢（当前状态 ${order.status}）`,
        409,
      );
    }

    const fsm = getOrderFSM(order.order_type);
    fsm.assertTransition(order.status as OrderStatus, nextStatus);

    await updateOrder(orderId, {
      status: nextStatus,
      riderId,
      riderAcceptedAt: new Date(),
    });

    await insertOrderLog({
      orderId,
      operatorType: 'RIDER',
      operatorId: riderId,
      action: 'RIDER_GRAB',
      fromStatus: order.status,
      toStatus: nextStatus,
    });

    return { orderId, status: nextStatus };
  } finally {
    // 仅当锁 value 一致时释放（避免误删）
    const current = await redisClient.get(lockKey);
    if (current === lockValue) await redisClient.del(lockKey);
  }
};

/** 调度池统计（后台用） */
export const getPoolStats = async () => {
  const product = await listOrders({
    status: OrderStatus.PENDING_RIDER,
    orderType: OrderType.PRODUCT,
    page: 1,
    pageSize: 1,
  });
  const errand = await listOrders({
    status: OrderStatus.PENDING_DISPATCH,
    orderType: OrderType.ERRAND,
    page: 1,
    pageSize: 1,
  });
  return {
    productPending: product.total,
    errandPending: errand.total,
    total: product.total + errand.total,
  };
};

/** 平台手动指派骑手（后台） */
export const adminAssignRider = async (
  orderId: number,
  riderId: number,
  adminId: number,
) => {
  const order = await findOrderById(orderId);
  if (!order) throw new AppError(ErrorCode.ORDER_NOT_FOUND, '订单不存在', 404);
  const rider = await findRiderById(riderId);
  if (!rider) throw AppError.notFound('骑手不存在');

  const expectedFrom =
    order.order_type === OrderType.PRODUCT
      ? OrderStatus.PENDING_RIDER
      : OrderStatus.PENDING_DISPATCH;
  if (order.status !== expectedFrom) {
    throw new AppError(
      ErrorCode.ORDER_STATUS_INVALID,
      `订单不可指派（当前状态 ${order.status}）`,
      400,
    );
  }

  const nextStatus =
    order.order_type === OrderType.PRODUCT
      ? OrderStatus.PENDING_PICKUP
      : OrderStatus.RIDER_ACCEPTED;

  await updateOrder(orderId, {
    status: nextStatus,
    riderId,
    riderAcceptedAt: new Date(),
  });
  await insertOrderLog({
    orderId,
    operatorType: 'ADMIN',
    operatorId: adminId,
    action: 'ADMIN_ASSIGN',
    fromStatus: order.status,
    toStatus: nextStatus,
    extra: { riderId },
  });
  return { orderId, riderId, status: nextStatus };
};

/** 扩圈推送（占位：首期返回统计） */
export const expandRadius = async (orderId: number) => {
  const order = await findOrderById(orderId);
  if (!order) throw new AppError(ErrorCode.ORDER_NOT_FOUND, '订单不存在', 404);
  await insertOrderLog({
    orderId,
    operatorType: 'SYSTEM',
    action: 'EXPAND_RADIUS',
    remark: '扩圈推送',
  });
  return { orderId, expanded: true };
};
