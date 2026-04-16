import { RowDataPacket } from 'mysql2';
import { execute, query, queryOne } from '../utils/database';

export interface UserRow extends RowDataPacket {
  id: number;
  phone: string | null;
  nickname: string;
  avatar: string;
  gender: number;
  openid: string | null;
  unionid: string | null;
  wx_session_key: string | null;
  status: string;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  is_deleted: number;
}

export const findUserById = async (id: number): Promise<UserRow | null> => {
  return queryOne<UserRow>('SELECT * FROM users WHERE id = ? AND is_deleted = 0', [id]);
};

export const findUserByOpenid = async (openid: string): Promise<UserRow | null> => {
  return queryOne<UserRow>('SELECT * FROM users WHERE openid = ? AND is_deleted = 0', [openid]);
};

export const findUserByPhone = async (phone: string): Promise<UserRow | null> => {
  return queryOne<UserRow>('SELECT * FROM users WHERE phone = ? AND is_deleted = 0', [phone]);
};

export interface CreateUserParams {
  openid?: string | null;
  unionid?: string | null;
  wxSessionKey?: string | null;
  phone?: string | null;
  nickname?: string;
  avatar?: string;
}

export const createUser = async (params: CreateUserParams): Promise<number> => {
  const result = await execute(
    `INSERT INTO users (openid, unionid, wx_session_key, phone, nickname, avatar, status)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    [
      params.openid ?? null,
      params.unionid ?? null,
      params.wxSessionKey ?? null,
      params.phone ?? null,
      params.nickname ?? '',
      params.avatar ?? '',
    ],
  );
  return result.insertId;
};

export const updateUserLoginInfo = async (
  id: number,
  wxSessionKey: string | null,
): Promise<void> => {
  await execute(
    `UPDATE users SET last_login_at = CURRENT_TIMESTAMP, wx_session_key = COALESCE(?, wx_session_key)
     WHERE id = ?`,
    [wxSessionKey, id],
  );
};

export const updateUserPhone = async (id: number, phone: string): Promise<void> => {
  await execute('UPDATE users SET phone = ? WHERE id = ?', [phone, id]);
};

export interface UpdateUserProfileParams {
  nickname?: string;
  avatar?: string;
  gender?: number;
}

export const updateUserProfile = async (
  id: number,
  params: UpdateUserProfileParams,
): Promise<void> => {
  const sets: string[] = [];
  const vals: Array<string | number> = [];
  if (params.nickname !== undefined) {
    sets.push('nickname = ?');
    vals.push(params.nickname);
  }
  if (params.avatar !== undefined) {
    sets.push('avatar = ?');
    vals.push(params.avatar);
  }
  if (params.gender !== undefined) {
    sets.push('gender = ?');
    vals.push(params.gender);
  }
  if (sets.length === 0) return;
  vals.push(id);
  await execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
};

export const countUsers = async (): Promise<number> => {
  const rows = await query<(RowDataPacket & { total: number })[]>(
    'SELECT COUNT(*) AS total FROM users WHERE is_deleted = 0',
  );
  return rows[0]?.total ?? 0;
};
