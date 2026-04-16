import { AppError } from '../utils/AppError';
import { ErrorCode } from '../types/enums';
import {
  SettlementRow,
  WithdrawalRow,
  findSettlementById,
  listSettlements,
  createSettlement,
  freezeSettlementsByOrder,
  unfreezeSettlementsByOrder,
  findWithdrawalById,
  createWithdrawalAndFreeze,
  listWithdrawals,
  auditWithdrawal,
  getBalanceSnapshot,
  SettlementListParams,
  WithdrawalListParams,
} from '../models/settlement.model';
import { findOrderById } from '../models/order.model';
import { findStoreById } from '../models/store.model';
import { generateSettlementNo, generateWithdrawalNo } from '../utils/orderNo';
import { fenToYuan, readDecimal, yuanToFen } from '../utils/money';

const MIN_WITHDRAWAL_YUAN = 1;
const MAX_WITHDRAWALS_PER_DAY = 3;

const formatSettlement = (row: SettlementRow) => ({
  id: row.id,
  settlementNo: row.settlement_no,
  orderId: row.order_id,
  targetType: row.target_type,
  targetId: row.target_id,
  orderAmount: yuanToFen(readDecimal(row.order_amount)),
  commissionAmount: yuanToFen(readDecimal(row.commission_amount)),
  deliveryFee: yuanToFen(readDecimal(row.delivery_fee)),
  netAmount: yuanToFen(readDecimal(row.net_amount)),
  status: row.status,
  settledAt: row.settled_at,
  createdAt: row.created_at,
});

const formatWithdrawal = (row: WithdrawalRow) => ({
  id: row.id,
  withdrawalNo: row.withdrawal_no,
  targetType: row.target_type,
  targetId: row.target_id,
  amount: yuanToFen(readDecimal(row.amount)),
  fee: yuanToFen(readDecimal(row.fee)),
  actualAmount: yuanToFen(readDecimal(row.actual_amount)),
  accountType: row.account_type,
  accountName: row.account_name,
  accountNo: row.account_no,
  bankName: row.bank_name,
  status: row.status,
  auditRemark: row.audit_remark,
  auditedAt: row.audited_at,
  transferredAt: row.transferred_at,
  createdAt: row.created_at,
});

/**
 * 触发结算（订单完成时调用）
 * 商品订单：商家收入 = paid - commission - deliveryFee，骑手收入 = deliveryFee
 * 跑腿订单：骑手收入 = paid (+tip) - 服务费
 */
export const triggerSettlement = async (orderId: number) => {
  const order = await findOrderById(orderId);
  if (!order) throw new AppError(ErrorCode.ORDER_NOT_FOUND, '订单不存在', 404);

  const paidYuan = readDecimal(order.paid_amount);
  const deliveryFeeYuan = readDecimal(order.delivery_fee);
  const tipYuan = readDecimal(order.tip_amount);

  if (order.order_type === 'PRODUCT') {
    if (!order.store_id || !order.rider_id) return { skipped: true };
    const store = await findStoreById(order.store_id);
    if (!store) return { skipped: true };
    const commissionRate = Number(readDecimal(store.commission_rate)) / 100;
    const commission = paidYuan * commissionRate;
    const merchantNet = paidYuan - commission - deliveryFeeYuan;
    const riderNet = deliveryFeeYuan;

    const merchantSettlementNo = generateSettlementNo();
    await createSettlement({
      settlementNo: merchantSettlementNo,
      orderId,
      targetType: 'MERCHANT',
      targetId: store.merchant_id,
      orderAmount: paidYuan,
      commissionAmount: commission,
      deliveryFee: deliveryFeeYuan,
      netAmount: merchantNet,
    });

    const riderSettlementNo = generateSettlementNo();
    await createSettlement({
      settlementNo: riderSettlementNo,
      orderId,
      targetType: 'RIDER',
      targetId: order.rider_id,
      orderAmount: paidYuan,
      commissionAmount: 0,
      deliveryFee: deliveryFeeYuan,
      netAmount: riderNet,
    });

    return {
      merchantSettlementNo,
      riderSettlementNo,
      merchantNet: yuanToFen(merchantNet),
      riderNet: yuanToFen(riderNet),
    };
  }

  // 跑腿订单：全额归骑手，平台抽 10% 服务费
  if (!order.rider_id) return { skipped: true };
  const serviceFee = paidYuan * 0.1;
  const riderNet = paidYuan - serviceFee + tipYuan;
  const settlementNo = generateSettlementNo();
  await createSettlement({
    settlementNo,
    orderId,
    targetType: 'RIDER',
    targetId: order.rider_id,
    orderAmount: paidYuan,
    commissionAmount: serviceFee,
    deliveryFee: 0,
    netAmount: riderNet,
  });
  return { settlementNo, riderNet: yuanToFen(riderNet) };
};

// ============================= 账单/余额 =============================

export const listMerchantBills = async (
  merchantId: number,
  page: number,
  pageSize: number,
) => {
  const { list, total } = await listSettlements({
    targetType: 'MERCHANT',
    targetId: merchantId,
    page,
    pageSize,
  });
  return {
    list: list.map(formatSettlement),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const listRiderBills = async (
  riderId: number,
  page: number,
  pageSize: number,
) => {
  const { list, total } = await listSettlements({
    targetType: 'RIDER',
    targetId: riderId,
    page,
    pageSize,
  });
  return {
    list: list.map(formatSettlement),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const getBillDetail = async (id: number) => {
  const row = await findSettlementById(id);
  if (!row) throw AppError.notFound('结算记录不存在');
  return formatSettlement(row);
};

export const getBalance = async (
  targetType: 'MERCHANT' | 'RIDER',
  targetId: number,
) => {
  const snap = await getBalanceSnapshot(targetType, targetId);
  if (!snap) throw AppError.notFound('账户不存在');
  return {
    balance: yuanToFen(snap.balance),
    frozenBalance: yuanToFen(snap.frozenBalance),
  };
};

// ============================= 提现 =============================

export interface ApplyWithdrawInput {
  targetType: 'MERCHANT' | 'RIDER';
  targetId: number;
  amountFen: number;
  accountType: 'WECHAT' | 'BANK';
  accountName?: string;
  accountNo?: string;
  bankName?: string;
}

export const applyWithdraw = async (input: ApplyWithdrawInput) => {
  const amountYuan = fenToYuan(input.amountFen);
  if (amountYuan < MIN_WITHDRAWAL_YUAN) {
    throw new AppError(
      ErrorCode.UNDER_MIN_WITHDRAWAL,
      `低于最小提现金额（${MIN_WITHDRAWAL_YUAN} 元）`,
      400,
    );
  }
  // 检查当日提现次数
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { list } = await listWithdrawals({
    targetType: input.targetType,
    targetId: input.targetId,
    page: 1,
    pageSize: 10,
  });
  const todayCount = list.filter((w) => w.created_at >= today).length;
  if (todayCount >= MAX_WITHDRAWALS_PER_DAY) {
    throw new AppError(
      ErrorCode.WITHDRAWAL_DAILY_LIMIT,
      '今日提现次数已达上限',
      429,
    );
  }

  const withdrawalNo = generateWithdrawalNo();
  const id = await createWithdrawalAndFreeze({
    withdrawalNo,
    targetType: input.targetType,
    targetId: input.targetId,
    amount: amountYuan,
    accountType: input.accountType,
    accountName: input.accountName,
    accountNo: input.accountNo,
    bankName: input.bankName,
  });
  if (id === 0) {
    throw new AppError(ErrorCode.BALANCE_NOT_ENOUGH, '可用余额不足', 400);
  }
  const row = await findWithdrawalById(id);
  return formatWithdrawal(row!);
};

export const listMyWithdrawals = async (
  targetType: 'MERCHANT' | 'RIDER',
  targetId: number,
  page: number,
  pageSize: number,
) => {
  const { list, total } = await listWithdrawals({
    targetType,
    targetId,
    page,
    pageSize,
  });
  return {
    list: list.map(formatWithdrawal),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const adminListWithdrawals = async (
  params: WithdrawalListParams,
) => {
  const { list, total } = await listWithdrawals(params);
  return {
    list: list.map(formatWithdrawal),
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
};

export const adminAuditWithdrawal = async (
  withdrawalId: number,
  adminId: number,
  action: 'APPROVE' | 'REJECT',
  remark: string,
) => {
  try {
    await auditWithdrawal(withdrawalId, adminId, action, remark);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('不存在')) throw AppError.notFound(msg);
    if (msg.includes('不允许')) {
      throw new AppError(ErrorCode.WITHDRAWAL_STATUS_INVALID, msg, 400);
    }
    throw err;
  }
  return formatWithdrawal((await findWithdrawalById(withdrawalId))!);
};

export const adminListSettlements = async (params: SettlementListParams) => {
  const { list, total } = await listSettlements(params);
  return {
    list: list.map(formatSettlement),
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
};

export const freezeByOrder = async (orderId: number) => {
  await freezeSettlementsByOrder(orderId);
};

export const unfreezeByOrder = async (orderId: number) => {
  await unfreezeSettlementsByOrder(orderId);
};
