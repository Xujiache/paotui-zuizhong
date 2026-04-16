import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { execute, pool, query, queryOne, transaction } from '../utils/database';

export interface SettlementRow extends RowDataPacket {
  id: number;
  settlement_no: string;
  order_id: number;
  target_type: string;
  target_id: number;
  order_amount: string | number;
  commission_amount: string | number;
  delivery_fee: string | number;
  net_amount: string | number;
  status: string;
  settled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface WithdrawalRow extends RowDataPacket {
  id: number;
  withdrawal_no: string;
  target_type: string;
  target_id: number;
  amount: string | number;
  fee: string | number;
  actual_amount: string | number;
  account_type: string;
  account_name: string;
  account_no: string;
  bank_name: string;
  status: string;
  audit_admin_id: number | null;
  audit_remark: string;
  audited_at: Date | null;
  transferred_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const findSettlementById = async (id: number): Promise<SettlementRow | null> =>
  queryOne<SettlementRow>(`SELECT * FROM settlements WHERE id = ?`, [id]);

export interface SettlementListParams {
  targetType?: 'MERCHANT' | 'RIDER';
  targetId?: number;
  status?: string;
  page: number;
  pageSize: number;
}

export const listSettlements = async (
  params: SettlementListParams,
): Promise<{ list: SettlementRow[]; total: number }> => {
  const where: string[] = ['1=1'];
  const vals: Array<string | number> = [];
  if (params.targetType) {
    where.push('target_type = ?');
    vals.push(params.targetType);
  }
  if (params.targetId) {
    where.push('target_id = ?');
    vals.push(params.targetId);
  }
  if (params.status) {
    where.push('status = ?');
    vals.push(params.status);
  }
  const whereSql = where.join(' AND ');
  const offset = (params.page - 1) * params.pageSize;
  const list = await query<SettlementRow[]>(
    `SELECT * FROM settlements WHERE ${whereSql} ORDER BY id DESC LIMIT ${params.pageSize} OFFSET ${offset}`,
    vals,
  );
  const total = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM settlements WHERE ${whereSql}`,
    vals,
  );
  return { list, total: total[0]?.total ?? 0 };
};

export interface CreateSettlementParams {
  settlementNo: string;
  orderId: number;
  targetType: 'MERCHANT' | 'RIDER';
  targetId: number;
  orderAmount: number;
  commissionAmount: number;
  deliveryFee: number;
  netAmount: number;
}

export const createSettlement = async (
  params: CreateSettlementParams,
): Promise<number> =>
  transaction(async (conn) => {
    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO settlements
         (settlement_no, order_id, target_type, target_id,
          order_amount, commission_amount, delivery_fee, net_amount, status, settled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SETTLED', CURRENT_TIMESTAMP)`,
      [
        params.settlementNo,
        params.orderId,
        params.targetType,
        params.targetId,
        params.orderAmount,
        params.commissionAmount,
        params.deliveryFee,
        params.netAmount,
      ],
    );
    // 更新余额
    const balanceTable = params.targetType === 'MERCHANT' ? 'merchants' : 'riders';
    await conn.execute(
      `UPDATE ${balanceTable} SET balance = balance + ? WHERE id = ?`,
      [params.netAmount, params.targetId],
    );
    return result.insertId;
  });

export const freezeSettlementsByOrder = async (
  orderId: number,
): Promise<void> => {
  await execute(
    `UPDATE settlements SET status = 'FROZEN' WHERE order_id = ? AND status = 'SETTLED'`,
    [orderId],
  );
};

export const unfreezeSettlementsByOrder = async (
  orderId: number,
): Promise<void> => {
  await execute(
    `UPDATE settlements SET status = 'SETTLED' WHERE order_id = ? AND status = 'FROZEN'`,
    [orderId],
  );
};

// ============ 提现 ============

export const findWithdrawalById = async (
  id: number,
): Promise<WithdrawalRow | null> =>
  queryOne<WithdrawalRow>(`SELECT * FROM withdrawals WHERE id = ?`, [id]);

export interface CreateWithdrawalParams {
  withdrawalNo: string;
  targetType: 'MERCHANT' | 'RIDER';
  targetId: number;
  amount: number;
  fee?: number;
  accountType: 'WECHAT' | 'BANK';
  accountName?: string;
  accountNo?: string;
  bankName?: string;
}

export const createWithdrawalAndFreeze = async (
  params: CreateWithdrawalParams,
): Promise<number> =>
  transaction(async (conn) => {
    const balanceTable = params.targetType === 'MERCHANT' ? 'merchants' : 'riders';
    const [ret] = await conn.execute<ResultSetHeader>(
      `UPDATE ${balanceTable}
       SET balance = balance - ?, frozen_balance = frozen_balance + ?
       WHERE id = ? AND balance >= ?`,
      [params.amount, params.amount, params.targetId, params.amount],
    );
    if (ret.affectedRows === 0) return 0;

    const fee = params.fee ?? 0;
    const actual = params.amount - fee;
    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO withdrawals
         (withdrawal_no, target_type, target_id, amount, fee, actual_amount,
          account_type, account_name, account_no, bank_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        params.withdrawalNo,
        params.targetType,
        params.targetId,
        params.amount,
        fee,
        actual,
        params.accountType,
        params.accountName ?? '',
        params.accountNo ?? '',
        params.bankName ?? '',
      ],
    );
    return result.insertId;
  });

export interface WithdrawalListParams {
  targetType?: 'MERCHANT' | 'RIDER';
  targetId?: number;
  status?: string;
  page: number;
  pageSize: number;
}

export const listWithdrawals = async (
  params: WithdrawalListParams,
): Promise<{ list: WithdrawalRow[]; total: number }> => {
  const where: string[] = ['1=1'];
  const vals: Array<string | number> = [];
  if (params.targetType) {
    where.push('target_type = ?');
    vals.push(params.targetType);
  }
  if (params.targetId) {
    where.push('target_id = ?');
    vals.push(params.targetId);
  }
  if (params.status) {
    where.push('status = ?');
    vals.push(params.status);
  }
  const whereSql = where.join(' AND ');
  const offset = (params.page - 1) * params.pageSize;
  const list = await query<WithdrawalRow[]>(
    `SELECT * FROM withdrawals WHERE ${whereSql} ORDER BY id DESC LIMIT ${params.pageSize} OFFSET ${offset}`,
    vals,
  );
  const total = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM withdrawals WHERE ${whereSql}`,
    vals,
  );
  return { list, total: total[0]?.total ?? 0 };
};

export const auditWithdrawal = async (
  withdrawalId: number,
  adminId: number,
  action: 'APPROVE' | 'REJECT',
  remark: string,
): Promise<void> => {
  await transaction(async (conn) => {
    const [rows] = await conn.execute<WithdrawalRow[]>(
      `SELECT * FROM withdrawals WHERE id = ? FOR UPDATE`,
      [withdrawalId],
    );
    const w = (rows as WithdrawalRow[])[0];
    if (!w) throw new Error('提现记录不存在');
    if (w.status !== 'PENDING') throw new Error('当前状态不允许审核');

    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    await conn.execute(
      `UPDATE withdrawals
         SET status = ?, audit_admin_id = ?, audit_remark = ?, audited_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStatus, adminId, remark, withdrawalId],
    );

    // 驳回：冻结金额回归可用余额
    if (action === 'REJECT') {
      const balanceTable = w.target_type === 'MERCHANT' ? 'merchants' : 'riders';
      await conn.execute(
        `UPDATE ${balanceTable}
           SET balance = balance + ?, frozen_balance = frozen_balance - ?
         WHERE id = ?`,
        [w.amount, w.amount, w.target_id],
      );
    }
  });
};

export const getBalanceSnapshot = async (
  targetType: 'MERCHANT' | 'RIDER',
  targetId: number,
): Promise<{ balance: number; frozenBalance: number } | null> => {
  const table = targetType === 'MERCHANT' ? 'merchants' : 'riders';
  const [rows] = await pool.execute<
    (RowDataPacket & { balance: string | number; frozen_balance: string | number })[]
  >(`SELECT balance, frozen_balance FROM ${table} WHERE id = ? AND is_deleted = 0`, [
    targetId,
  ]);
  const row = (rows as Array<{ balance: number; frozen_balance: number }>)[0];
  if (!row) return null;
  return {
    balance: Number(row.balance),
    frozenBalance: Number(row.frozen_balance),
  };
};
