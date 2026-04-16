import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { execute, query, queryOne, pool } from '../utils/database';

export interface CartItemRow extends RowDataPacket {
  id: number;
  user_id: number;
  store_id: number;
  product_id: number;
  sku_id: number;
  quantity: number;
  created_at: Date;
  updated_at: Date;
}

export const findCartItem = async (
  userId: number,
  skuId: number,
): Promise<CartItemRow | null> =>
  queryOne<CartItemRow>(
    `SELECT * FROM cart_items WHERE user_id = ? AND sku_id = ?`,
    [userId, skuId],
  );

export const findCartItemById = async (id: number): Promise<CartItemRow | null> =>
  queryOne<CartItemRow>(`SELECT * FROM cart_items WHERE id = ?`, [id]);

/** 累加（已存在则 quantity += delta；否则插入） */
export const upsertCartItem = async (
  userId: number,
  storeId: number,
  productId: number,
  skuId: number,
  deltaQuantity: number,
): Promise<number> => {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO cart_items (user_id, store_id, product_id, sku_id, quantity)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
    [userId, storeId, productId, skuId, deltaQuantity],
  );
  // insertId 在 ON DUPLICATE 时是旧 id
  const existing = await findCartItem(userId, skuId);
  return existing ? existing.id : result.insertId;
};

export const setCartItemQuantity = async (
  id: number,
  quantity: number,
): Promise<void> => {
  await execute(`UPDATE cart_items SET quantity = ? WHERE id = ?`, [quantity, id]);
};

export const deleteCartItem = async (id: number): Promise<void> => {
  await execute(`DELETE FROM cart_items WHERE id = ?`, [id]);
};

export const clearCartByUser = async (
  userId: number,
  storeId?: number,
): Promise<void> => {
  if (storeId) {
    await execute(`DELETE FROM cart_items WHERE user_id = ? AND store_id = ?`, [
      userId,
      storeId,
    ]);
  } else {
    await execute(`DELETE FROM cart_items WHERE user_id = ?`, [userId]);
  }
};

export const listCartItemsByUser = async (
  userId: number,
): Promise<CartItemRow[]> =>
  query<CartItemRow[]>(
    `SELECT * FROM cart_items WHERE user_id = ? ORDER BY store_id, id`,
    [userId],
  );

export const countCartItemsInStore = async (
  userId: number,
  storeId: number,
): Promise<number> => {
  const rows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM cart_items WHERE user_id = ? AND store_id = ?`,
    [userId, storeId],
  );
  return rows[0]?.total ?? 0;
};
