import { RowDataPacket } from 'mysql2';
import { execute, query, queryOne } from '../utils/database';

export type FavoriteTargetType = 'STORE' | 'PRODUCT';

export interface UserFavoriteRow extends RowDataPacket {
  id: number;
  user_id: number;
  target_type: FavoriteTargetType;
  target_id: number;
  created_at: Date;
  updated_at: Date;
  is_deleted: number;
}

export const findFavorite = async (
  userId: number,
  targetType: FavoriteTargetType,
  targetId: number,
): Promise<UserFavoriteRow | null> =>
  queryOne<UserFavoriteRow>(
    `SELECT * FROM user_favorites
     WHERE user_id = ? AND target_type = ? AND target_id = ? AND is_deleted = 0`,
    [userId, targetType, targetId],
  );

export const addFavorite = async (
  userId: number,
  targetType: FavoriteTargetType,
  targetId: number,
): Promise<number> => {
  const existing = await queryOne<UserFavoriteRow>(
    `SELECT id, is_deleted FROM user_favorites
     WHERE user_id = ? AND target_type = ? AND target_id = ?`,
    [userId, targetType, targetId],
  );
  if (existing) {
    if (existing.is_deleted === 1) {
      await execute(
        `UPDATE user_favorites SET is_deleted = 0 WHERE id = ?`,
        [existing.id],
      );
    }
    return existing.id;
  }
  const result = await execute(
    `INSERT INTO user_favorites (user_id, target_type, target_id) VALUES (?, ?, ?)`,
    [userId, targetType, targetId],
  );
  return result.insertId;
};

export const removeFavorite = async (
  userId: number,
  targetId: number,
  targetType?: FavoriteTargetType,
): Promise<void> => {
  if (targetType) {
    await execute(
      `UPDATE user_favorites SET is_deleted = 1
       WHERE user_id = ? AND target_type = ? AND target_id = ?`,
      [userId, targetType, targetId],
    );
  } else {
    await execute(
      `UPDATE user_favorites SET is_deleted = 1 WHERE user_id = ? AND id = ?`,
      [userId, targetId],
    );
  }
};

export const listFavorites = async (
  userId: number,
  targetType: FavoriteTargetType | undefined,
  page: number,
  pageSize: number,
): Promise<{ list: UserFavoriteRow[]; total: number }> => {
  const params: Array<string | number> = [userId];
  let where = 'user_id = ? AND is_deleted = 0';
  if (targetType) {
    where += ' AND target_type = ?';
    params.push(targetType);
  }
  const offset = (page - 1) * pageSize;
  const list = await query<UserFavoriteRow[]>(
    `SELECT * FROM user_favorites
     WHERE ${where}
     ORDER BY id DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    params,
  );
  const totalRows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM user_favorites WHERE ${where}`,
    params,
  );
  return { list, total: totalRows[0]?.total ?? 0 };
};
