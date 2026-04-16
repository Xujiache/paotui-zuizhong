import { RowDataPacket } from 'mysql2';
import { execute, query, queryOne } from '../utils/database';

export interface MerchantRow extends RowDataPacket {
  id: number;
  name: string;
  contact_name: string;
  contact_phone: string;
  password_hash: string;
  license_no: string;
  license_image: string;
  id_card_front: string;
  id_card_back: string;
  category: string;
  balance: string | number;
  frozen_balance: string | number;
  status: string;
  audit_status: string;
  audit_remark: string;
  audited_at: Date | null;
  created_at: Date;
  updated_at: Date;
  is_deleted: number;
}

export const findMerchantById = async (id: number): Promise<MerchantRow | null> =>
  queryOne<MerchantRow>('SELECT * FROM merchants WHERE id = ? AND is_deleted = 0', [id]);

export const findMerchantByPhone = async (phone: string): Promise<MerchantRow | null> =>
  queryOne<MerchantRow>(
    'SELECT * FROM merchants WHERE contact_phone = ? AND is_deleted = 0',
    [phone],
  );

export interface CreateMerchantParams {
  name: string;
  contactName: string;
  contactPhone: string;
  passwordHash: string;
}

export const createMerchant = async (params: CreateMerchantParams): Promise<number> => {
  const result = await execute(
    `INSERT INTO merchants (name, contact_name, contact_phone, password_hash, status, audit_status)
     VALUES (?, ?, ?, ?, 'PENDING', 'PENDING')`,
    [params.name, params.contactName, params.contactPhone, params.passwordHash],
  );
  return result.insertId;
};

export const updateMerchantLoginAt = async (id: number): Promise<void> => {
  await execute('UPDATE merchants SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
};

export interface MerchantApplyParams {
  name?: string;
  contactName?: string;
  licenseNo?: string;
  licenseImage?: string;
  idCardFront?: string;
  idCardBack?: string;
  category?: string;
}

export const updateMerchantApplyInfo = async (
  id: number,
  params: MerchantApplyParams,
): Promise<void> => {
  const sets: string[] = [];
  const vals: Array<string | number> = [];
  const map: Record<string, string> = {
    name: 'name',
    contactName: 'contact_name',
    licenseNo: 'license_no',
    licenseImage: 'license_image',
    idCardFront: 'id_card_front',
    idCardBack: 'id_card_back',
    category: 'category',
  };
  for (const key of Object.keys(map) as Array<keyof MerchantApplyParams>) {
    if (params[key] !== undefined) {
      sets.push(`${map[key]} = ?`);
      vals.push(params[key] as string);
    }
  }
  sets.push(`audit_status = 'PENDING'`, `status = 'PENDING'`);
  if (sets.length === 0) return;
  vals.push(id);
  await execute(`UPDATE merchants SET ${sets.join(', ')} WHERE id = ?`, vals);
};

export interface AdminMerchantAuditParams {
  action: 'APPROVE' | 'REJECT';
  remark?: string;
}

export const auditMerchant = async (
  id: number,
  params: AdminMerchantAuditParams,
): Promise<void> => {
  const newAudit = params.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  const newStatus = params.action === 'APPROVE' ? 'ACTIVE' : 'REJECTED';
  await execute(
    `UPDATE merchants
     SET audit_status = ?, status = ?, audit_remark = ?, audited_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [newAudit, newStatus, params.remark ?? '', id],
  );
};

export const setMerchantStatus = async (id: number, status: string): Promise<void> => {
  await execute(`UPDATE merchants SET status = ? WHERE id = ?`, [status, id]);
};

export interface MerchantListParams {
  keyword?: string;
  status?: string;
  auditStatus?: string;
  page: number;
  pageSize: number;
}

export const listMerchants = async (
  params: MerchantListParams,
): Promise<{ list: MerchantRow[]; total: number }> => {
  const where: string[] = ['is_deleted = 0'];
  const vals: Array<string | number> = [];
  if (params.keyword) {
    where.push('(name LIKE ? OR contact_phone LIKE ?)');
    vals.push(`%${params.keyword}%`, `%${params.keyword}%`);
  }
  if (params.status) {
    where.push('status = ?');
    vals.push(params.status);
  }
  if (params.auditStatus) {
    where.push('audit_status = ?');
    vals.push(params.auditStatus);
  }
  const whereSql = where.join(' AND ');
  const offset = (params.page - 1) * params.pageSize;

  const list = await query<MerchantRow[]>(
    `SELECT * FROM merchants WHERE ${whereSql} ORDER BY id DESC LIMIT ${params.pageSize} OFFSET ${offset}`,
    vals,
  );
  const totalRows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM merchants WHERE ${whereSql}`,
    vals,
  );
  return { list, total: totalRows[0]?.total ?? 0 };
};
