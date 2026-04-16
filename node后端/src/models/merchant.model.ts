import { RowDataPacket } from 'mysql2';
import { execute, queryOne } from '../utils/database';

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
  balance: number;
  frozen_balance: number;
  status: string;
  audit_status: string;
  audit_remark: string;
  audited_at: Date | null;
  created_at: Date;
  updated_at: Date;
  is_deleted: number;
}

export const findMerchantById = async (id: number): Promise<MerchantRow | null> => {
  return queryOne<MerchantRow>('SELECT * FROM merchants WHERE id = ? AND is_deleted = 0', [id]);
};

export const findMerchantByPhone = async (phone: string): Promise<MerchantRow | null> => {
  return queryOne<MerchantRow>(
    'SELECT * FROM merchants WHERE contact_phone = ? AND is_deleted = 0',
    [phone],
  );
};

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
