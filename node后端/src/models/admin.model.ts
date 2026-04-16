import { RowDataPacket } from 'mysql2';
import { execute, queryOne } from '../utils/database';

export interface AdminRow extends RowDataPacket {
  id: number;
  username: string;
  password_hash: string;
  real_name: string;
  phone: string;
  email: string;
  avatar: string;
  role_id: number;
  status: string;
  last_login_at: Date | null;
  last_login_ip: string;
  created_at: Date;
  updated_at: Date;
  is_deleted: number;
}

export const findAdminById = async (id: number): Promise<AdminRow | null> => {
  return queryOne<AdminRow>('SELECT * FROM admins WHERE id = ? AND is_deleted = 0', [id]);
};

export const findAdminByUsername = async (username: string): Promise<AdminRow | null> => {
  return queryOne<AdminRow>('SELECT * FROM admins WHERE username = ? AND is_deleted = 0', [
    username,
  ]);
};

export const updateAdminLogin = async (id: number, ip: string): Promise<void> => {
  await execute(
    'UPDATE admins SET last_login_at = CURRENT_TIMESTAMP, last_login_ip = ? WHERE id = ?',
    [ip, id],
  );
};
