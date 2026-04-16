import { RowDataPacket } from 'mysql2';
import { execute, query, queryOne } from '../utils/database';

export interface MessageRow extends RowDataPacket {
  id: number;
  target_type: string;
  target_id: number;
  type: string;
  title: string;
  content: string;
  extra: unknown;
  is_read: number;
  read_at: Date | null;
  created_at: Date;
  is_deleted: number;
}

export interface CreateMessageParams {
  targetType: 'USER' | 'MERCHANT' | 'RIDER' | 'ADMIN';
  targetId: number;
  type: string;
  title: string;
  content: string;
  extra?: Record<string, unknown>;
}

export const insertMessage = async (params: CreateMessageParams): Promise<number> => {
  const result = await execute(
    `INSERT INTO messages (target_type, target_id, type, title, content, extra)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      params.targetType,
      params.targetId,
      params.type,
      params.title,
      params.content,
      params.extra ? JSON.stringify(params.extra) : null,
    ],
  );
  return result.insertId;
};

export const listMessages = async (
  targetType: string,
  targetId: number,
  type: string | undefined,
  page: number,
  pageSize: number,
): Promise<{ list: MessageRow[]; total: number }> => {
  const where: string[] = ['target_type = ?', 'target_id = ?', 'is_deleted = 0'];
  const vals: Array<string | number> = [targetType, targetId];
  if (type) {
    where.push('type = ?');
    vals.push(type);
  }
  const whereSql = where.join(' AND ');
  const offset = (page - 1) * pageSize;
  const list = await query<MessageRow[]>(
    `SELECT * FROM messages WHERE ${whereSql} ORDER BY id DESC LIMIT ${pageSize} OFFSET ${offset}`,
    vals,
  );
  const total = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM messages WHERE ${whereSql}`,
    vals,
  );
  return { list, total: total[0]?.total ?? 0 };
};

export const countUnread = async (
  targetType: string,
  targetId: number,
): Promise<number> => {
  const rows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM messages
     WHERE target_type = ? AND target_id = ? AND is_read = 0 AND is_deleted = 0`,
    [targetType, targetId],
  );
  return rows[0]?.total ?? 0;
};

export const markMessageRead = async (
  id: number,
  targetType: string,
  targetId: number,
): Promise<void> => {
  await execute(
    `UPDATE messages SET is_read = 1, read_at = CURRENT_TIMESTAMP
     WHERE id = ? AND target_type = ? AND target_id = ?`,
    [id, targetType, targetId],
  );
};

export const markAllRead = async (
  targetType: string,
  targetId: number,
): Promise<void> => {
  await execute(
    `UPDATE messages SET is_read = 1, read_at = CURRENT_TIMESTAMP
     WHERE target_type = ? AND target_id = ? AND is_read = 0`,
    [targetType, targetId],
  );
};

export const softDeleteMessage = async (
  id: number,
  targetType: string,
  targetId: number,
): Promise<void> => {
  await execute(
    `UPDATE messages SET is_deleted = 1
     WHERE id = ? AND target_type = ? AND target_id = ?`,
    [id, targetType, targetId],
  );
};

export const findMessageById = async (id: number): Promise<MessageRow | null> =>
  queryOne<MessageRow>(`SELECT * FROM messages WHERE id = ?`, [id]);
