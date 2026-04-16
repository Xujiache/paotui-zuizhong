import { RowDataPacket } from 'mysql2';
import { query, queryOne } from '../utils/database';

export interface RoleRow extends RowDataPacket {
  id: number;
  name: string;
  code: string;
  description: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  is_deleted: number;
}

interface PermissionRow extends RowDataPacket {
  permission: string;
}

export const findRoleById = async (id: number): Promise<RoleRow | null> => {
  return queryOne<RoleRow>('SELECT * FROM roles WHERE id = ? AND is_deleted = 0', [id]);
};

export const findRoleByCode = async (code: string): Promise<RoleRow | null> => {
  return queryOne<RoleRow>('SELECT * FROM roles WHERE code = ? AND is_deleted = 0', [code]);
};

export const findPermissionsByRoleId = async (roleId: number): Promise<string[]> => {
  const rows = await query<PermissionRow[]>(
    'SELECT permission FROM role_permissions WHERE role_id = ?',
    [roleId],
  );
  return rows.map((row) => row.permission);
};
