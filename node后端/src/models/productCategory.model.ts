import { RowDataPacket } from 'mysql2';
import { execute, query, queryOne } from '../utils/database';

export interface ProductCategoryRow extends RowDataPacket {
  id: number;
  store_id: number;
  parent_id: number;
  name: string;
  icon: string;
  sort: number;
  status: string;
  created_at: Date;
  updated_at: Date;
  is_deleted: number;
}

export const listCategoriesByStore = async (
  storeId: number,
  onlyActive = false,
): Promise<ProductCategoryRow[]> => {
  const rows = await query<ProductCategoryRow[]>(
    `SELECT * FROM product_categories
     WHERE store_id = ? AND is_deleted = 0 ${onlyActive ? "AND status = 'ACTIVE'" : ''}
     ORDER BY sort DESC, id ASC`,
    [storeId],
  );
  return rows;
};

export const findCategoryById = async (id: number): Promise<ProductCategoryRow | null> =>
  queryOne<ProductCategoryRow>(
    'SELECT * FROM product_categories WHERE id = ? AND is_deleted = 0',
    [id],
  );

export interface CreateCategoryParams {
  storeId: number;
  name: string;
  icon?: string;
  sort?: number;
  parentId?: number;
}

export const createCategory = async (params: CreateCategoryParams): Promise<number> => {
  const result = await execute(
    `INSERT INTO product_categories (store_id, parent_id, name, icon, sort)
     VALUES (?, ?, ?, ?, ?)`,
    [params.storeId, params.parentId ?? 0, params.name, params.icon ?? '', params.sort ?? 0],
  );
  return result.insertId;
};

export interface UpdateCategoryParams {
  name?: string;
  icon?: string;
  sort?: number;
  status?: string;
}

export const updateCategory = async (
  id: number,
  params: UpdateCategoryParams,
): Promise<void> => {
  const sets: string[] = [];
  const vals: Array<string | number> = [];
  const map: Record<string, string> = {
    name: 'name',
    icon: 'icon',
    sort: 'sort',
    status: 'status',
  };
  for (const key of Object.keys(map) as Array<keyof UpdateCategoryParams>) {
    if (params[key] !== undefined) {
      sets.push(`${map[key]} = ?`);
      vals.push(params[key] as string | number);
    }
  }
  if (sets.length === 0) return;
  vals.push(id);
  await execute(`UPDATE product_categories SET ${sets.join(', ')} WHERE id = ?`, vals);
};

export const softDeleteCategory = async (id: number): Promise<void> => {
  await execute(`UPDATE product_categories SET is_deleted = 1 WHERE id = ?`, [id]);
};

export const updateCategoriesSort = async (
  items: Array<{ id: number; sort: number }>,
): Promise<void> => {
  for (const item of items) {
    await execute(`UPDATE product_categories SET sort = ? WHERE id = ?`, [
      item.sort,
      item.id,
    ]);
  }
};

/** 统计分类下未删除的商品数（用于校验是否可删除） */
export const countProductsInCategory = async (categoryId: number): Promise<number> => {
  const rows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM products WHERE category_id = ? AND is_deleted = 0`,
    [categoryId],
  );
  return rows[0]?.total ?? 0;
};
