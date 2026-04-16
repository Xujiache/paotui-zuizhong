import { AppError } from '../utils/AppError';
import { ErrorCode, OrderStatus, AftersaleStatus, PaymentStatus } from '../types/enums';
import {
  findAftersaleById,
  existsActiveAftersale,
  createAftersale,
  updateAftersale,
  listAftersales,
  findComplaintById,
  createComplaint,
  updateComplaint,
  listComplaints,
  AftersaleRow,
  ComplaintRow,
} from '../models/aftersale.model';
import {
  findOrderById,
  findPaymentByOrderId,
  insertOrderLog,
  updateOrder,
  updatePayment,
} from '../models/order.model';
import {
  freezeSettlementsByOrder,
  unfreezeSettlementsByOrder,
} from '../models/settlement.model';
import {
  generateAftersaleNo,
  generateComplaintNo,
} from '../utils/orderNo';
import { fenToYuan, readDecimal, yuanToFen } from '../utils/money';

const parseJson = (v: unknown) => {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try {
    return typeof v === 'string' ? JSON.parse(v) : v;
  } catch {
    return v;
  }
};

const formatAftersale = (row: AftersaleRow) => ({
  id: row.id,
  aftersaleNo: row.aftersale_no,
  orderId: row.order_id,
  userId: row.user_id,
  type: row.type,
  reason: row.reason,
  description: row.description,
  images: parseJson(row.images),
  refundAmount: yuanToFen(readDecimal(row.refund_amount)),
  actualRefundAmount: yuanToFen(readDecimal(row.actual_refund_amount)),
  status: row.status,
  handlerId: row.handler_id,
  handlerType: row.handler_type,
  handleRemark: row.handle_remark,
  handledAt: row.handled_at,
  refundedAt: row.refunded_at,
  createdAt: row.created_at,
});

const formatComplaint = (row: ComplaintRow) => ({
  id: row.id,
  complaintNo: row.complaint_no,
  orderId: row.order_id,
  complainantType: row.complainant_type,
  complainantId: row.complainant_id,
  targetType: row.target_type,
  targetId: row.target_id,
  type: row.type,
  description: row.description,
  images: parseJson(row.images),
  status: row.status,
  handlerId: row.handler_id,
  handleResult: row.handle_result,
  handledAt: row.handled_at,
  createdAt: row.created_at,
});

// ============================= 退款 =============================

export interface SubmitRefundParams {
  orderId: number;
  type?: 'REFUND' | 'CANCEL';
  reason: string;
  description?: string;
  images?: string[];
  refundAmountFen: number;
}

export const userSubmitRefund = async (
  userId: number,
  params: SubmitRefundParams,
) => {
  const order = await findOrderById(params.orderId);
  if (!order) throw new AppError(ErrorCode.ORDER_NOT_FOUND, '订单不存在', 404);
  if (order.user_id !== userId) throw AppError.forbidden('不能操作他人订单');

  // 先检查是否已有进行中的售后（优先于状态校验）
  if (await existsActiveAftersale(params.orderId)) {
    throw new AppError(
      ErrorCode.AFTERSALE_DUPLICATE,
      '该订单已有进行中的售后',
      400,
    );
  }

  const allowStatuses = new Set<string>([
    OrderStatus.PENDING_MERCHANT,
    OrderStatus.PENDING_RIDER,
    OrderStatus.PENDING_PICKUP,
    OrderStatus.DELIVERING,
    OrderStatus.DELIVERED,
    OrderStatus.COMPLETED,
    OrderStatus.RIDER_ACCEPTED,
    OrderStatus.ON_THE_WAY,
    OrderStatus.IN_PROGRESS,
  ]);
  if (!allowStatuses.has(order.status)) {
    throw new AppError(
      ErrorCode.ORDER_STATUS_INVALID,
      `当前状态不允许申请退款：${order.status}`,
      400,
    );
  }

  const paidFen = yuanToFen(readDecimal(order.paid_amount));
  if (params.refundAmountFen <= 0 || params.refundAmountFen > paidFen) {
    throw new AppError(
      ErrorCode.REFUND_AMOUNT_EXCEED,
      `退款金额超过实付金额（实付 ${paidFen} 分）`,
      400,
    );
  }

  const aftersaleNo = generateAftersaleNo();
  const id = await createAftersale({
    aftersaleNo,
    orderId: params.orderId,
    userId,
    type: params.type ?? 'REFUND',
    reason: params.reason,
    description: params.description,
    images: params.images,
    refundAmount: fenToYuan(params.refundAmountFen),
  });

  // 订单状态 → AFTERSALE，并冻结结算
  await updateOrder(params.orderId, { status: OrderStatus.AFTERSALE });
  await insertOrderLog({
    orderId: params.orderId,
    operatorType: 'USER',
    operatorId: userId,
    action: 'AFTERSALE_SUBMIT',
    fromStatus: order.status,
    toStatus: OrderStatus.AFTERSALE,
    extra: { aftersaleNo },
  });
  await freezeSettlementsByOrder(params.orderId);

  const row = await findAftersaleById(id);
  return formatAftersale(row!);
};

export const getAftersaleDetail = async (id: number) => {
  const row = await findAftersaleById(id);
  if (!row) throw new AppError(ErrorCode.AFTERSALE_NOT_FOUND, '售后不存在', 404);
  return formatAftersale(row);
};

export const listUserAftersales = async (
  userId: number,
  status: string | undefined,
  page: number,
  pageSize: number,
) => {
  const { list, total } = await listAftersales({ userId, status, page, pageSize });
  return {
    list: list.map(formatAftersale),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const adminListAftersales = async (
  status: string | undefined,
  page: number,
  pageSize: number,
) => {
  const { list, total } = await listAftersales({ status, page, pageSize });
  return {
    list: list.map(formatAftersale),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const merchantHandleAftersale = async (
  merchantId: number,
  aftersaleId: number,
  action: 'AGREE' | 'REJECT',
  remark: string,
) => {
  const row = await findAftersaleById(aftersaleId);
  if (!row) throw new AppError(ErrorCode.AFTERSALE_NOT_FOUND, '售后不存在', 404);
  if (row.status !== AftersaleStatus.PENDING_ACCEPT && row.status !== AftersaleStatus.PROCESSING) {
    throw new AppError(
      ErrorCode.AFTERSALE_STATUS_INVALID,
      `当前售后状态不允许处理：${row.status}`,
      400,
    );
  }
  const newStatus =
    action === 'AGREE' ? AftersaleStatus.PENDING_REFUND : AftersaleStatus.REJECTED;
  await updateAftersale(aftersaleId, {
    status: newStatus,
    handlerId: merchantId,
    handlerType: 'MERCHANT',
    handleRemark: remark,
    handledAt: new Date(),
  });
  // 若驳回：解冻结算并将订单状态回滚到 COMPLETED
  if (action === 'REJECT') {
    await unfreezeSettlementsByOrder(row.order_id);
    await updateOrder(row.order_id, { status: OrderStatus.COMPLETED });
    await insertOrderLog({
      orderId: row.order_id,
      operatorType: 'MERCHANT',
      operatorId: merchantId,
      action: 'AFTERSALE_REJECT',
      toStatus: OrderStatus.COMPLETED,
      remark,
    });
  }
  return formatAftersale((await findAftersaleById(aftersaleId))!);
};

export const adminHandleAftersale = async (
  adminId: number,
  aftersaleId: number,
  action: 'APPROVE' | 'REJECT',
  remark: string,
) => {
  // 平台处理等同商家处理，但记录 handlerType=ADMIN
  const row = await findAftersaleById(aftersaleId);
  if (!row) throw new AppError(ErrorCode.AFTERSALE_NOT_FOUND, '售后不存在', 404);
  if (row.status !== AftersaleStatus.PENDING_ACCEPT && row.status !== AftersaleStatus.PROCESSING) {
    throw new AppError(
      ErrorCode.AFTERSALE_STATUS_INVALID,
      `当前售后状态不允许处理：${row.status}`,
      400,
    );
  }
  const newStatus =
    action === 'APPROVE' ? AftersaleStatus.PENDING_REFUND : AftersaleStatus.REJECTED;
  await updateAftersale(aftersaleId, {
    status: newStatus,
    handlerId: adminId,
    handlerType: 'ADMIN',
    handleRemark: remark,
    handledAt: new Date(),
  });
  if (action === 'REJECT') {
    await unfreezeSettlementsByOrder(row.order_id);
    await updateOrder(row.order_id, { status: OrderStatus.COMPLETED });
  }
  return formatAftersale((await findAftersaleById(aftersaleId))!);
};

/** 执行退款（首期 mock：直接回调成功） */
export const executeRefund = async (aftersaleId: number) => {
  const row = await findAftersaleById(aftersaleId);
  if (!row) throw new AppError(ErrorCode.AFTERSALE_NOT_FOUND, '售后不存在', 404);
  if (row.status !== AftersaleStatus.PENDING_REFUND) {
    throw new AppError(
      ErrorCode.AFTERSALE_STATUS_INVALID,
      '售后不在待退款状态',
      400,
    );
  }

  const order = await findOrderById(row.order_id);
  if (!order) throw new AppError(ErrorCode.ORDER_NOT_FOUND, '订单不存在', 404);
  const payment = await findPaymentByOrderId(row.order_id);
  if (!payment) throw new AppError(ErrorCode.DATA_NOT_FOUND, '支付记录不存在', 404);

  const refundYuan = readDecimal(row.refund_amount);
  const paidYuan = readDecimal(order.paid_amount);
  const newRefundYuan = readDecimal(order.refund_amount) + refundYuan;
  const newPayRefundYuan = readDecimal(payment.refund_amount) + refundYuan;

  // mock 回调：直接推进到 REFUNDED
  await updateAftersale(aftersaleId, {
    status: AftersaleStatus.REFUNDED,
    refundedAt: new Date(),
    actualRefundAmount: refundYuan,
  });
  await updatePayment(payment.id, {
    status:
      newPayRefundYuan >= paidYuan
        ? PaymentStatus.FULL_REFUNDED
        : PaymentStatus.PARTIAL_REFUNDED,
    refundAmount: newPayRefundYuan,
  });
  await updateOrder(row.order_id, {
    status: OrderStatus.REFUNDED,
    refundAmount: newRefundYuan,
    paymentStatus:
      newPayRefundYuan >= paidYuan
        ? PaymentStatus.FULL_REFUNDED
        : PaymentStatus.PARTIAL_REFUNDED,
  });
  await insertOrderLog({
    orderId: row.order_id,
    operatorType: 'SYSTEM',
    action: 'REFUND',
    fromStatus: order.status,
    toStatus: OrderStatus.REFUNDED,
    extra: { aftersaleNo: row.aftersale_no, refundYuan },
  });

  return { aftersaleId, refunded: true };
};

/** 退款回调（真实集成微信退款时使用） */
export const handleRefundCallback = async (aftersaleNo: string) => {
  const all = await listAftersales({ page: 1, pageSize: 1 });
  const row = all.list.find((a) => a.aftersale_no === aftersaleNo);
  if (!row) throw new AppError(ErrorCode.AFTERSALE_NOT_FOUND, '售后不存在', 404);
  return executeRefund(row.id);
};

// ============================= 投诉 =============================

export interface SubmitComplaintParams {
  orderId?: number | null;
  complainantType: 'USER' | 'MERCHANT' | 'RIDER';
  targetType: 'MERCHANT' | 'RIDER' | 'PLATFORM';
  targetId?: number | null;
  type: string;
  description: string;
  images?: string[];
}

export const submitComplaint = async (
  complainantId: number,
  params: SubmitComplaintParams,
) => {
  const complaintNo = generateComplaintNo();
  const id = await createComplaint({
    complaintNo,
    orderId: params.orderId ?? null,
    complainantType: params.complainantType,
    complainantId,
    targetType: params.targetType,
    targetId: params.targetId ?? null,
    type: params.type,
    description: params.description,
    images: params.images,
  });
  const row = await findComplaintById(id);
  return formatComplaint(row!);
};

export const adminListComplaints = async (
  status: string | undefined,
  page: number,
  pageSize: number,
) => {
  const { list, total } = await listComplaints({ status, page, pageSize });
  return {
    list: list.map(formatComplaint),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const adminHandleComplaint = async (
  adminId: number,
  complaintId: number,
  handleResult: string,
) => {
  const row = await findComplaintById(complaintId);
  if (!row) throw AppError.notFound('投诉不存在');
  await updateComplaint(complaintId, {
    status: 'RESOLVED',
    handlerId: adminId,
    handleResult,
    handledAt: new Date(),
  });
  return formatComplaint((await findComplaintById(complaintId))!);
};

export const merchantReportException = async (
  merchantId: number,
  params: { orderId: number; reason: string; description?: string },
) => {
  return submitComplaint(merchantId, {
    orderId: params.orderId,
    complainantType: 'MERCHANT',
    targetType: 'PLATFORM',
    type: 'ORDER_ISSUE',
    description: `${params.reason} - ${params.description ?? ''}`,
  });
};
