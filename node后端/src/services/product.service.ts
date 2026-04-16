import { AppError } from '../utils/AppError';
import { ErrorCode } from '../types/enums';
import {
  listCategoriesByStore,
  findCategoryById,
  createCategory,
  updateCategory,
  softDeleteCategory,
  updateCategoriesSort,
  countProductsInCategory,
  CreateCategoryParams,
  UpdateCategoryParams,
  ProductCategoryRow,
} from '../models/productCategory.model';
import {
  findProductById,
  findSkuById,
  listSkusByProduct,
  listProducts,
  createProductWithSkus,
  updateProduct,
  softDeleteProduct,
  setProductStatus,
  batchSetProductStatus,
  updateSkuStock,
  saveProductSkus,
  CreateProductParams,
  UpdateProductParams,
  ProductListParams,
  ProductRow,
  SkuRow,
  StockAction,
  SaveSkuData,
  CreateProductSkuData,
} from '../models/product.model';
import { findStoreById } from '../models/store.model';
import { yuanToFen, fenToYuan, readDecimal } from '../utils/money';

const parseJson = (value: unknown): unknown => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
};

const formatCategory = (row: ProductCategoryRow) => ({
  id: row.id,
  storeId: row.store_id,
  parentId: row.parent_id,
  name: row.name,
  icon: row.icon,
  sort: row.sort,
  status: row.status,
  createdAt: row.created_at,
});

const formatSku = (row: SkuRow) => ({
  id: row.id,
  productId: row.product_id,
  specValues: parseJson(row.spec_values),
  specText: row.spec_text,
  price: yuanToFen(readDecimal(row.price)),
  originalPrice: yuanToFen(readDecimal(row.original_price)),
  stock: row.stock,
  salesCount: row.sales_count,
  skuCode: row.sku_code,
  status: row.status,
});

const formatProduct = (row: ProductRow, skus?: SkuRow[]) => ({
  id: row.id,
  storeId: row.store_id,
  categoryId: row.category_id,
  name: row.name,
  description: row.description,
  images: parseJson(row.images),
  basePrice: yuanToFen(readDecimal(row.base_price)),
  packingFee: yuanToFen(readDecimal(row.packing_fee)),
  unit: row.unit,
  minBuy: row.min_buy,
  maxBuy: row.max_buy,
  salesCount: row.sales_count,
  sort: row.sort,
  isHot: row.is_hot === 1,
  isNew: row.is_new === 1,
  isRecommend: row.is_recommend === 1,
  status: row.status,
  createdAt: row.created_at,
  skus: skus ? skus.map(formatSku) : undefined,
});

const ensureStoreOwnedByMerchant = async (
  merchantId: number,
  storeId: number,
): Promise<void> => {
  const store = await findStoreById(storeId);
  if (!store) throw new AppError(ErrorCode.STORE_NOT_FOUND, '门店不存在', 404);
  if (store.merchant_id !== merchantId) {
    throw new AppError(ErrorCode.STORE_FORBIDDEN, '不能操作他人门店', 403);
  }
};

const ensureProductOwnedByMerchant = async (
  merchantId: number,
  productId: number,
): Promise<ProductRow> => {
  const product = await findProductById(productId);
  if (!product) throw new AppError(ErrorCode.PRODUCT_NOT_FOUND, '商品不存在', 404);
  await ensureStoreOwnedByMerchant(merchantId, product.store_id);
  return product;
};

// ===================== 分类 =====================

export const getCategories = async (storeId: number, onlyActive = false) => {
  const list = await listCategoriesByStore(storeId, onlyActive);
  return list.map(formatCategory);
};

export const merchantCreateCategory = async (
  merchantId: number,
  params: CreateCategoryParams,
) => {
  await ensureStoreOwnedByMerchant(merchantId, params.storeId);
  const id = await createCategory(params);
  const row = await findCategoryById(id);
  return formatCategory(row!);
};

export const merchantUpdateCategory = async (
  merchantId: number,
  categoryId: number,
  params: UpdateCategoryParams,
) => {
  const cat = await findCategoryById(categoryId);
  if (!cat) throw new AppError(ErrorCode.CATEGORY_NOT_FOUND, '分类不存在', 404);
  await ensureStoreOwnedByMerchant(merchantId, cat.store_id);
  await updateCategory(categoryId, params);
  const row = await findCategoryById(categoryId);
  return formatCategory(row!);
};

export const merchantDeleteCategory = async (
  merchantId: number,
  categoryId: number,
) => {
  const cat = await findCategoryById(categoryId);
  if (!cat) throw new AppError(ErrorCode.CATEGORY_NOT_FOUND, '分类不存在', 404);
  await ensureStoreOwnedByMerchant(merchantId, cat.store_id);
  const count = await countProductsInCategory(categoryId);
  if (count > 0) {
    throw new AppError(
      ErrorCode.CATEGORY_HAS_PRODUCTS,
      '分类下仍有商品，不允许删除',
      400,
    );
  }
  await softDeleteCategory(categoryId);
};

export const merchantSortCategories = async (
  merchantId: number,
  items: Array<{ id: number; sort: number }>,
) => {
  for (const it of items) {
    const cat = await findCategoryById(it.id);
    if (!cat) throw new AppError(ErrorCode.CATEGORY_NOT_FOUND, '分类不存在', 404);
    await ensureStoreOwnedByMerchant(merchantId, cat.store_id);
  }
  await updateCategoriesSort(items);
};

// ===================== 商品 =====================

export const merchantListProducts = async (
  merchantId: number,
  params: ProductListParams,
) => {
  if (params.storeId) {
    await ensureStoreOwnedByMerchant(merchantId, params.storeId);
  }
  const { list, total } = await listProducts(params);
  return {
    list: list.map((r) => formatProduct(r)),
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
};

export interface UserListProductsParams {
  storeId: number;
  categoryId?: number;
  keyword?: string;
  page: number;
  pageSize: number;
}

export const userListProducts = async (params: UserListProductsParams) => {
  const { list, total } = await listProducts({
    storeId: params.storeId,
    categoryId: params.categoryId,
    keyword: params.keyword,
    status: 'ON_SHELF',
    page: params.page,
    pageSize: params.pageSize,
  });
  const withSkus = await Promise.all(
    list.map(async (p) => formatProduct(p, await listSkusByProduct(p.id))),
  );
  return {
    list: withSkus,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
};

export const getProductDetail = async (productId: number) => {
  const product = await findProductById(productId);
  if (!product) throw new AppError(ErrorCode.PRODUCT_NOT_FOUND, '商品不存在', 404);
  const skus = await listSkusByProduct(productId);
  return formatProduct(product, skus);
};

export interface CreateProductInput {
  storeId: number;
  categoryId: number;
  name: string;
  description?: string;
  images?: string[];
  basePriceFen: number;
  packingFeeFen?: number;
  unit?: string;
  minBuy?: number;
  maxBuy?: number;
  isHot?: boolean;
  isNew?: boolean;
  isRecommend?: boolean;
  skus: Array<{
    specValues?: Record<string, string>;
    specText?: string;
    priceFen: number;
    originalPriceFen?: number;
    stock: number;
    skuCode?: string;
  }>;
}

export const merchantCreateProduct = async (
  merchantId: number,
  input: CreateProductInput,
) => {
  await ensureStoreOwnedByMerchant(merchantId, input.storeId);
  const cat = await findCategoryById(input.categoryId);
  if (!cat || cat.store_id !== input.storeId) {
    throw new AppError(ErrorCode.CATEGORY_NOT_FOUND, '分类不属于该门店', 400);
  }
  if (!input.skus || input.skus.length === 0) {
    throw AppError.paramInvalid('至少需要一个 SKU', [
      { field: 'body.skus', message: '至少一个 SKU' },
    ]);
  }
  const params: CreateProductParams = {
    storeId: input.storeId,
    categoryId: input.categoryId,
    name: input.name,
    description: input.description,
    images: input.images,
    basePrice: fenToYuan(input.basePriceFen),
    packingFee: input.packingFeeFen !== undefined ? fenToYuan(input.packingFeeFen) : 0,
    unit: input.unit,
    minBuy: input.minBuy,
    maxBuy: input.maxBuy,
    isHot: input.isHot,
    isNew: input.isNew,
    isRecommend: input.isRecommend,
    skus: input.skus.map<CreateProductSkuData>((s) => ({
      specValues: s.specValues,
      specText: s.specText,
      price: fenToYuan(s.priceFen),
      originalPrice: s.originalPriceFen ? fenToYuan(s.originalPriceFen) : 0,
      stock: s.stock,
      skuCode: s.skuCode,
    })),
  };
  const id = await createProductWithSkus(params);
  return getProductDetail(id);
};

export interface UpdateProductInput {
  categoryId?: number;
  name?: string;
  description?: string;
  images?: string[];
  basePriceFen?: number;
  packingFeeFen?: number;
  unit?: string;
  minBuy?: number;
  maxBuy?: number;
  isHot?: boolean;
  isNew?: boolean;
  isRecommend?: boolean;
}

export const merchantUpdateProduct = async (
  merchantId: number,
  productId: number,
  input: UpdateProductInput,
) => {
  await ensureProductOwnedByMerchant(merchantId, productId);
  const params: UpdateProductParams = {};
  if (input.categoryId !== undefined) params.categoryId = input.categoryId;
  if (input.name !== undefined) params.name = input.name;
  if (input.description !== undefined) params.description = input.description;
  if (input.images !== undefined) params.images = input.images;
  if (input.basePriceFen !== undefined) params.basePrice = fenToYuan(input.basePriceFen);
  if (input.packingFeeFen !== undefined) params.packingFee = fenToYuan(input.packingFeeFen);
  if (input.unit !== undefined) params.unit = input.unit;
  if (input.minBuy !== undefined) params.minBuy = input.minBuy;
  if (input.maxBuy !== undefined) params.maxBuy = input.maxBuy;
  if (input.isHot !== undefined) params.isHot = input.isHot;
  if (input.isNew !== undefined) params.isNew = input.isNew;
  if (input.isRecommend !== undefined) params.isRecommend = input.isRecommend;
  await updateProduct(productId, params);
  return getProductDetail(productId);
};

export const merchantDeleteProduct = async (
  merchantId: number,
  productId: number,
) => {
  await ensureProductOwnedByMerchant(merchantId, productId);
  await softDeleteProduct(productId);
};

export const merchantToggleProductStatus = async (
  merchantId: number,
  productId: number,
  status: 'ON_SHELF' | 'OFF_SHELF',
) => {
  await ensureProductOwnedByMerchant(merchantId, productId);
  await setProductStatus(productId, status);
};

export const merchantBatchToggle = async (
  merchantId: number,
  ids: number[],
  status: 'ON_SHELF' | 'OFF_SHELF',
) => {
  // 逐个校验所有权
  for (const id of ids) {
    await ensureProductOwnedByMerchant(merchantId, id);
  }
  await batchSetProductStatus(ids, status);
};

// ===================== SKU / 库存 =====================

export const merchantListSkus = async (merchantId: number, productId: number) => {
  await ensureProductOwnedByMerchant(merchantId, productId);
  const rows = await listSkusByProduct(productId);
  return rows.map(formatSku);
};

export interface SaveSkusInput {
  skus: Array<{
    id?: number;
    specValues?: Record<string, string>;
    specText?: string;
    priceFen: number;
    originalPriceFen?: number;
    stock: number;
    skuCode?: string;
  }>;
}

export const merchantSaveSkus = async (
  merchantId: number,
  productId: number,
  input: SaveSkusInput,
) => {
  await ensureProductOwnedByMerchant(merchantId, productId);
  if (!input.skus || input.skus.length === 0) {
    throw AppError.paramInvalid('至少保留一个 SKU');
  }
  const skus: SaveSkuData[] = input.skus.map((s) => ({
    id: s.id,
    specValues: s.specValues,
    specText: s.specText,
    price: fenToYuan(s.priceFen),
    originalPrice: s.originalPriceFen ? fenToYuan(s.originalPriceFen) : 0,
    stock: s.stock,
    skuCode: s.skuCode,
  }));
  await saveProductSkus(productId, skus);
  return getProductDetail(productId);
};

export const merchantUpdateStock = async (
  merchantId: number,
  skuId: number,
  action: StockAction,
  quantity: number,
) => {
  const sku = await findSkuById(skuId);
  if (!sku) throw new AppError(ErrorCode.SKU_NOT_FOUND, 'SKU不存在', 404);
  const product = await findProductById(sku.product_id);
  if (!product) throw new AppError(ErrorCode.PRODUCT_NOT_FOUND, '商品不存在', 404);
  await ensureStoreOwnedByMerchant(merchantId, product.store_id);

  const stock = await updateSkuStock(skuId, action, quantity);
  if (stock === null) {
    throw new AppError(ErrorCode.PRODUCT_STOCK_NOT_ENOUGH, '库存不足', 400);
  }
  return { skuId, stock };
};

export const merchantBatchUpdateStock = async (
  merchantId: number,
  items: Array<{ skuId: number; action: StockAction; quantity: number }>,
) => {
  const results: Array<{ skuId: number; stock: number }> = [];
  for (const it of items) {
    const r = await merchantUpdateStock(merchantId, it.skuId, it.action, it.quantity);
    results.push(r);
  }
  return results;
};

// ===================== 搜索 =====================

export interface SearchParams {
  keyword: string;
  lat?: number;
  lng?: number;
  page: number;
  pageSize: number;
}

export const searchProducts = async (params: SearchParams) => {
  const { list, total } = await listProducts({
    keyword: params.keyword,
    status: 'ON_SHELF',
    page: params.page,
    pageSize: params.pageSize,
  });
  const withSkus = await Promise.all(
    list.map(async (p) => formatProduct(p, await listSkusByProduct(p.id))),
  );
  return {
    list: withSkus,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
};
