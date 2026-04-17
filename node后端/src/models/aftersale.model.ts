import { RowDataPacket } from 'mysql2';
import { execute, query, queryOne } from '../utils/database';

export interface AftersaleRow extends RowDataPacket {
  id: number;
  aftersale_no: string;
  order_id: number;
  user_id: number;
  type: string;
  reason: string;
  description: string | null;
  images: unknown;
  refund_amount: string | number;
  actual_refund_amount: string | number;
  status: string;
  handler_id: number | null;
  handler_type: string;
  handle_remark: string;
  handled_at: Date | null;
  refunded_at: Date | null;
  created_at: Date;
  updated_at: Date;
  is_deleted: number;
}

export interface ComplaintRow extends RowDataPacket {
  id: number;
  complaint_no: string;
  order_id: number | null;
  complainant_type: string;
  complainant_id: number;
  target_type: string;
  target_id: number | null;
  type: string;
  description: string;
  images: unknown;
  status: string;
  handler_id: number | null;
  handle_result: string | null;
  handled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const findAftersaleById = async (id: number): Promise<AftersaleRow | null> =>
  queryOne<AftersaleRow>(
    `SELECT * FROM aftersales WHERE id = ? AND is_deleted = 0`,
    [id],
  );

export const findAftersaleByNo = async (
  aftersaleNo: string,
): Promise<AftersaleRow | null> =>
  queryOne<AftersaleRow>(
    `SELECT * FROM aftersales WHERE aftersale_no = ? AND is_deleted = 0`,
    [aftersaleNo],
  );

export const existsActiveAftersale = async (orderId: number): Promise<boolean> => {
  const row = await queryOne<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total FROM aftersales
     WHERE order_id = ? AND is_deleted = 0
       AND status IN ('PENDING_ACCEPT','PROCESSING','PENDING_REFUND')`,
    [orderId],
  );
  return (row?.total ?? 0) > 0;
};

export interface CreateAftersaleParams {
  aftersaleNo: string;
  orderId: number;
  userId: number;
  type: 'REFUND' | 'CANCEL';
  reason: string;
  description?: string;
  images?: string[];
  refundAmount: number;
}

export const createAftersale = async (
  params: CreateAftersaleParams,
): Promise<number> => {
  const result = await execute(
    `INSERT INTO aftersales
      (aftersale_no, order_id, user_id, type, reason, description, images, refund_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.aftersaleNo,
      params.orderId,
      params.userId,
      params.type,
      params.reason,
      params.description ?? null,
      params.images ? JSON.stringify(params.images) : null,
      params.refundAmount,
    ],
  );
  return result.insertId;
};

export const updateAftersale = async (
  id: number,
  params: {
    status?: string;
    handlerId?: number;
    handlerType?: string;
    handleRemark?: string;
    handledAt?: Date;
    refundedAt?: Date;
    actualRefundAmount?: number;
  },
): Promise<void> => {
  const sets: string[] = [];
  const vals: Array<string | number | Date> = [];
  const map: Record<string, string> = {
    status: 'status',
    handlerId: 'handler_id',
    handlerType: 'handler_type',
    handleRemark: 'handle_remark',
    handledAt: 'handled_at',
    refundedAt: 'refunded_at',
    actualRefundAmount: 'actual_refund_amount',
  };
  for (const key of Object.keys(map) as Array<keyof typeof params>) {
    if (params[key] !== undefined) {
      sets.push(`${map[key]} = ?`);
      vals.push(params[key] as string | number | Date);
    }
  }
  if (sets.length === 0) return;
  vals.push(id);
  await execute(`UPDATE aftersales SET ${sets.join(', ')} WHERE id = ?`, vals);
};

export interface AftersaleListParams {
  userId?: number;
  status?: string;
  page: number;
  pageSize: number;
}

export const listAftersales = async (
  params: AftersaleListParams,
): Promise<{ list: AftersaleRow[]; total: number }> => {
  const where: string[] = ['is_deleted = 0'];
  const vals: Array<string | number> = [];
  if (params.userId) {
    where.push('user_id = ?');
    vals.push(params.userId);
  }
  if (params.status) {
    where.push('status = ?');
    vals.push(params.status);
  }
  const whereSql = where.join(' AND ');
  const offset = (params.page - 1) * params.pageSize;
  const list = await query<AftersaleRow[]>(
    `SELECT * FROM aftersales WHERE ${whereSql} ORDER BY id DESC LIMIT ${params.pageSize} OFFSET ${offset}`,
    vals,
  );
  const total = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM aftersales WHERE ${whereSql}`,
    vals,
  );
  return { list, total: total[0]?.total ?? 0 };
};

export interface MerchantAftersaleListParams {
  merchantId: number;
  status?: string;
  page: number;
  pageSize: number;
}

export const listMerchantAftersales = async (
  params: MerchantAftersaleListParams,
): Promise<{ list: AftersaleRow[]; total: number }> => {
  const where: string[] = ['a.is_deleted = 0', 's.merchant_id = ?'];
  const vals: Array<string | number> = [params.merchantId];
  if (params.status) {
    where.push('a.status = ?');
    vals.push(params.status);
  }
  const whereSql = where.join(' AND ');
  const offset = (params.page - 1) * params.pageSize;
  const list = await query<AftersaleRow[]>(
    `SELECT a.* FROM aftersales a
     INNER JOIN orders o ON a.order_id = o.id
     INNER JOIN stores s ON o.store_id = s.id
     WHERE ${whereSql}
     ORDER BY a.id DESC
     LIMIT ${params.pageSize} OFFSET ${offset}`,
    vals,
  );
  const total = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM aftersales a
     INNER JOIN orders o ON a.order_id = o.id
     INNER JOIN stores s ON o.store_id = s.id
     WHERE ${whereSql}`,
    vals,
  );
  return { list, total: total[0]?.total ?? 0 };
};

// ============ 投诉 ============

export const findComplaintById = async (id: number): Promise<ComplaintRow | null> =>
  queryOne<ComplaintRow>(`SELECT * FROM complaints WHERE id = ?`, [id]);

export interface CreateComplaintParams {
  complaintNo: string;
  orderId?: number | null;
  complainantType: 'USER' | 'MERCHANT' | 'RIDER';
  complainantId: number;
  targetType: 'MERCHANT' | 'RIDER' | 'PLATFORM';
  targetId?: number | null;
  type: string;
  description: string;
  images?: string[];
}

export const createComplaint = async (
  params: CreateComplaintParams,
): Promise<number> => {
  const result = await execute(
    `INSERT INTO complaints
      (complaint_no, order_id, complainant_type, complainant_id, target_type, target_id, type, description, images)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.complaintNo,
      params.orderId ?? null,
      params.complainantType,
      params.complainantId,
      params.targetType,
      params.targetId ?? null,
      params.type,
      params.description,
      params.images ? JSON.stringify(params.images) : null,
    ],
  );
  return result.insertId;
};

export const updateComplaint = async (
  id: number,
  params: {
    status?: string;
    handlerId?: number;
    handleResult?: string;
    handledAt?: Date;
  },
): Promise<void> => {
  const sets: string[] = [];
  const vals: Array<string | number | Date> = [];
  if (params.status !== undefined) {
    sets.push('status = ?');
    vals.push(params.status);
  }
  if (params.handlerId !== undefined) {
    sets.push('handler_id = ?');
    vals.push(params.handlerId);
  }
  if (params.handleResult !== undefined) {
    sets.push('handle_result = ?');
    vals.push(params.handleResult);
  }
  if (params.handledAt !== undefined) {
    sets.push('handled_at = ?');
    vals.push(params.handledAt);
  }
  if (sets.length === 0) return;
  vals.push(id);
  await execute(`UPDATE complaints SET ${sets.join(', ')} WHERE id = ?`, vals);
};

export const listComplaints = async (params: {
  complainantType?: string;
  complainantId?: number;
  status?: string;
  page: number;
  pageSize: number;
}): Promise<{ list: ComplaintRow[]; total: number }> => {
  const where: string[] = ['1=1'];
  const vals: Array<string | number> = [];
  if (params.complainantType) {
    where.push('complainant_type = ?');
    vals.push(params.complainantType);
  }
  if (params.complainantId) {
    where.push('complainant_id = ?');
    vals.push(params.complainantId);
  }
  if (params.status) {
    where.push('status = ?');
    vals.push(params.status);
  }
  const whereSql = where.join(' AND ');
  const offset = (params.page - 1) * params.pageSize;
  const list = await query<ComplaintRow[]>(
    `SELECT * FROM complaints WHERE ${whereSql} ORDER BY id DESC LIMIT ${params.pageSize} OFFSET ${offset}`,
    vals,
  );
  const total = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM complaints WHERE ${whereSql}`,
    vals,
  );
  return { list, total: total[0]?.total ?? 0 };
};
