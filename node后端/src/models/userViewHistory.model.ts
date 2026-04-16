import { RowDataPacket } from 'mysql2';
import { execute, query } from '../utils/database';

export type ViewTargetType = 'STORE' | 'PRODUCT';

export interface ViewHistoryRow extends RowDataPacket {
  id: number;
  user_id: number;
  target_type: ViewTargetType;
  target_id: number;
  viewed_at: Date;
  created_at: Date;
}

const MAX_KEEP_RECORDS_PER_USER = 200;

/** 插入浏览记录（同 target 24h 内合并：刷新 viewed_at） */
export const recordView = async (
  userId: number,
  targetType: ViewTargetType,
  targetId: number,
): Promise<void> => {
  await execute(
    `INSERT INTO user_view_history (user_id, target_type, target_id, viewed_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
    [userId, targetType, targetId],
  );
  await execute(
    `DELETE FROM user_view_history
     WHERE user_id = ?
       AND id NOT IN (
         SELECT id FROM (
           SELECT id FROM user_view_history
           WHERE user_id = ?
           ORDER BY id DESC
           LIMIT ${MAX_KEEP_RECORDS_PER_USER}
         ) t
       )`,
    [userId, userId],
  );
};

export const listViewHistory = async (
  userId: number,
  targetType: ViewTargetType | undefined,
  page: number,
  pageSize: number,
): Promise<{ list: ViewHistoryRow[]; total: number }> => {
  const params: Array<string | number> = [userId];
  let where = 'user_id = ?';
  if (targetType) {
    where += ' AND target_type = ?';
    params.push(targetType);
  }
  const offset = (page - 1) * pageSize;
  const list = await query<ViewHistoryRow[]>(
    `SELECT * FROM user_view_history
     WHERE ${where}
     ORDER BY viewed_at DESC, id DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    params,
  );
  const totalRows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM user_view_history WHERE ${where}`,
    params,
  );
  return { list, total: totalRows[0]?.total ?? 0 };
};

export const clearViewHistory = async (userId: number): Promise<void> => {
  await execute(`DELETE FROM user_view_history WHERE user_id = ?`, [userId]);
};
