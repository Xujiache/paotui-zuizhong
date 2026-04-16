import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { execute, query, queryOne, transaction } from '../utils/database';

export interface ProductRow extends RowDataPacket {
  id: number;
  store_id: number;
  category_id: number;
  name: string;
  description: string | null;
  images: unknown;
  base_price: string | number;
  packing_fee: string | number;
  unit: string;
  min_buy: number;
  max_buy: number;
  sales_count: number;
  sort: number;
  is_hot: number;
  is_new: number;
  is_recommend: number;
  status: string;
  created_at: Date;
  updated_at: Date;
  is_deleted: number;
}

export interface SkuRow extends RowDataPacket {
  id: number;
  product_id: number;
  spec_values: unknown;
  spec_text: string;
  price: string | number;
  original_price: string | number;
  stock: number;
  sales_count: number;
  sku_code: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  is_deleted: number;
}

export const findProductById = async (id: number): Promise<ProductRow | null> =>
  queryOne<ProductRow>(
    'SELECT * FROM products WHERE id = ? AND is_deleted = 0',
    [id],
  );

export const findSkuById = async (id: number): Promise<SkuRow | null> =>
  queryOne<SkuRow>('SELECT * FROM skus WHERE id = ? AND is_deleted = 0', [id]);

export const listSkusByProduct = async (productId: number): Promise<SkuRow[]> =>
  query<SkuRow[]>(
    `SELECT * FROM skus WHERE product_id = ? AND is_deleted = 0 ORDER BY id ASC`,
    [productId],
  );

export interface ProductListParams {
  storeId?: number;
  categoryId?: number;
  status?: 'ON_SHELF' | 'OFF_SHELF';
  keyword?: string;
  isHot?: boolean;
  isNew?: boolean;
  isRecommend?: boolean;
  page: number;
  pageSize: number;
}

export const listProducts = async (
  params: ProductListParams,
): Promise<{ list: ProductRow[]; total: number }> => {
  const where: string[] = ['is_deleted = 0'];
  const vals: Array<string | number> = [];
  if (params.storeId) {
    where.push('store_id = ?');
    vals.push(params.storeId);
  }
  if (params.categoryId) {
    where.push('category_id = ?');
    vals.push(params.categoryId);
  }
  if (params.status) {
    where.push('status = ?');
    vals.push(params.status);
  }
  if (params.keyword) {
    where.push('name LIKE ?');
    vals.push(`%${params.keyword}%`);
  }
  if (params.isHot) where.push('is_hot = 1');
  if (params.isNew) where.push('is_new = 1');
  if (params.isRecommend) where.push('is_recommend = 1');
  const whereSql = where.join(' AND ');
  const offset = (params.page - 1) * params.pageSize;
  const list = await query<ProductRow[]>(
    `SELECT * FROM products WHERE ${whereSql}
     ORDER BY sort DESC, id DESC LIMIT ${params.pageSize} OFFSET ${offset}`,
    vals,
  );
  const totalRows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM products WHERE ${whereSql}`,
    vals,
  );
  return { list, total: totalRows[0]?.total ?? 0 };
};

export interface CreateProductSkuData {
  specValues?: Record<string, string>;
  specText?: string;
  price: number;
  originalPrice?: number;
  stock: number;
  skuCode?: string;
}

export interface CreateProductParams {
  storeId: number;
  categoryId: number;
  name: string;
  description?: string;
  images?: string[];
  basePrice: number;
  packingFee?: number;
  unit?: string;
  minBuy?: number;
  maxBuy?: number;
  isHot?: boolean;
  isNew?: boolean;
  isRecommend?: boolean;
  skus: CreateProductSkuData[];
}

export const createProductWithSkus = async (
  params: CreateProductParams,
): Promise<number> =>
  transaction(async (conn) => {
    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO products
         (store_id, category_id, name, description, images, base_price, packing_fee,
          unit, min_buy, max_buy, is_hot, is_new, is_recommend, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ON_SHELF')`,
      [
        params.storeId,
        params.categoryId,
        params.name,
        params.description ?? null,
        params.images ? JSON.stringify(params.images) : null,
        params.basePrice,
        params.packingFee ?? 0,
        params.unit ?? '份',
        params.minBuy ?? 1,
        params.maxBuy ?? 0,
        params.isHot ? 1 : 0,
        params.isNew ? 1 : 0,
        params.isRecommend ? 1 : 0,
      ],
    );
    const productId = result.insertId;
    for (const sku of params.skus) {
      await conn.execute(
        `INSERT INTO skus
           (product_id, spec_values, spec_text, price, original_price, stock, sku_code)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          productId,
          sku.specValues ? JSON.stringify(sku.specValues) : null,
          sku.specText ?? '',
          sku.price,
          sku.originalPrice ?? 0,
          sku.stock,
          sku.skuCode ?? '',
        ],
      );
    }
    return productId;
  });

export interface UpdateProductParams {
  categoryId?: number;
  name?: string;
  description?: string;
  images?: string[];
  basePrice?: number;
  packingFee?: number;
  unit?: string;
  minBuy?: number;
  maxBuy?: number;
  isHot?: boolean;
  isNew?: boolean;
  isRecommend?: boolean;
}

export const updateProduct = async (
  id: number,
  params: UpdateProductParams,
): Promise<void> => {
  const sets: string[] = [];
  const vals: Array<string | number | null> = [];
  const map: Record<keyof UpdateProductParams, string> = {
    categoryId: 'category_id',
    name: 'name',
    description: 'description',
    images: 'images',
    basePrice: 'base_price',
    packingFee: 'packing_fee',
    unit: 'unit',
    minBuy: 'min_buy',
    maxBuy: 'max_buy',
    isHot: 'is_hot',
    isNew: 'is_new',
    isRecommend: 'is_recommend',
  };
  for (const key of Object.keys(map) as Array<keyof UpdateProductParams>) {
    const v = params[key];
    if (v === undefined) continue;
    sets.push(`${map[key]} = ?`);
    if (key === 'images') vals.push(v ? JSON.stringify(v) : null);
    else if (key === 'isHot' || key === 'isNew' || key === 'isRecommend') vals.push(v ? 1 : 0);
    else vals.push(v as string | number);
  }
  if (sets.length === 0) return;
  vals.push(id);
  await execute(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, vals as (string | number)[]);
};

export const softDeleteProduct = async (id: number): Promise<void> => {
  await execute(`UPDATE products SET is_deleted = 1 WHERE id = ?`, [id]);
  await execute(`UPDATE skus SET is_deleted = 1 WHERE product_id = ?`, [id]);
};

export const setProductStatus = async (
  id: number,
  status: 'ON_SHELF' | 'OFF_SHELF',
): Promise<void> => {
  await execute(`UPDATE products SET status = ? WHERE id = ?`, [status, id]);
};

export const batchSetProductStatus = async (
  ids: number[],
  status: 'ON_SHELF' | 'OFF_SHELF',
): Promise<void> => {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  await execute(
    `UPDATE products SET status = ? WHERE id IN (${placeholders})`,
    [status, ...ids],
  );
};

// ============== 库存 ==============

export type StockAction = 'SET' | 'INCREMENT' | 'DECREMENT';

/**
 * 安全更新库存（带乐观并发保护）。返回变更后库存数；若 DECREMENT 不足返回 null。
 */
export const updateSkuStock = async (
  skuId: number,
  action: StockAction,
  quantity: number,
): Promise<number | null> => {
  if (quantity < 0) throw new Error('quantity 必须 >= 0');
  return transaction(async (conn) => {
    if (action === 'SET') {
      await conn.execute(`UPDATE skus SET stock = ? WHERE id = ? AND is_deleted = 0`, [
        quantity,
        skuId,
      ]);
    } else if (action === 'INCREMENT') {
      await conn.execute(
        `UPDATE skus SET stock = stock + ? WHERE id = ? AND is_deleted = 0`,
        [quantity, skuId],
      );
    } else {
      // DECREMENT：只有当库存足够时才扣减
      const [ret] = await conn.execute<ResultSetHeader>(
        `UPDATE skus SET stock = stock - ? WHERE id = ? AND stock >= ? AND is_deleted = 0`,
        [quantity, skuId, quantity],
      );
      if (ret.affectedRows === 0) {
        return null;
      }
    }
    const [rows] = await conn.query<(RowDataPacket & { stock: number })[]>(
      `SELECT stock FROM skus WHERE id = ?`,
      [skuId],
    );
    return rows[0]?.stock ?? 0;
  });
};

export interface SaveSkuData {
  id?: number;
  specValues?: Record<string, string>;
  specText?: string;
  price: number;
  originalPrice?: number;
  stock: number;
  skuCode?: string;
}

export const saveProductSkus = async (
  productId: number,
  skus: SaveSkuData[],
): Promise<void> => {
  await transaction(async (conn) => {
    const existing = await conn.query<SkuRow[]>(
      `SELECT * FROM skus WHERE product_id = ? AND is_deleted = 0`,
      [productId],
    );
    const existingIds = new Set((existing[0] as SkuRow[]).map((r) => r.id));
    const keepIds = new Set<number>();

    for (const sku of skus) {
      if (sku.id && existingIds.has(sku.id)) {
        await conn.execute(
          `UPDATE skus
           SET spec_values = ?, spec_text = ?, price = ?, original_price = ?, stock = ?, sku_code = ?
           WHERE id = ?`,
          [
            sku.specValues ? JSON.stringify(sku.specValues) : null,
            sku.specText ?? '',
            sku.price,
            sku.originalPrice ?? 0,
            sku.stock,
            sku.skuCode ?? '',
            sku.id,
          ],
        );
        keepIds.add(sku.id);
      } else {
        await conn.execute(
          `INSERT INTO skus
            (product_id, spec_values, spec_text, price, original_price, stock, sku_code)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            productId,
            sku.specValues ? JSON.stringify(sku.specValues) : null,
            sku.specText ?? '',
            sku.price,
            sku.originalPrice ?? 0,
            sku.stock,
            sku.skuCode ?? '',
          ],
        );
      }
    }
    // 软删除不在 keep 列表中的老 SKU
    for (const id of existingIds) {
      if (!keepIds.has(id)) {
        await conn.execute(`UPDATE skus SET is_deleted = 1 WHERE id = ?`, [id]);
      }
    }
  });
};
