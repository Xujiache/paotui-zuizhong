import { AppError } from '../utils/AppError';
import { ErrorCode } from '../types/enums';
import {
  findCartItem,
  findCartItemById,
  upsertCartItem,
  setCartItemQuantity,
  deleteCartItem,
  clearCartByUser,
  listCartItemsByUser,
  countCartItemsInStore,
} from '../models/cart.model';
import { findProductById, findSkuById } from '../models/product.model';
import { findStoreById } from '../models/store.model';
import { readDecimal, yuanToFen } from '../utils/money';

const MAX_ITEMS_PER_STORE = 50;

export interface AddCartInput {
  storeId: number;
  productId: number;
  skuId: number;
  quantity: number;
}

export const addToCart = async (userId: number, input: AddCartInput) => {
  if (input.quantity <= 0) {
    throw AppError.paramInvalid('数量必须 > 0');
  }
  const product = await findProductById(input.productId);
  if (!product) throw new AppError(ErrorCode.PRODUCT_NOT_FOUND, '商品不存在', 404);
  if (product.status !== 'ON_SHELF') {
    throw new AppError(ErrorCode.PRODUCT_OFF_SHELF, '商品已下架', 400);
  }
  if (product.store_id !== input.storeId) {
    throw AppError.paramInvalid('商品与门店不匹配');
  }
  const sku = await findSkuById(input.skuId);
  if (!sku) throw new AppError(ErrorCode.SKU_NOT_FOUND, 'SKU不存在', 404);
  if (sku.product_id !== input.productId) {
    throw AppError.paramInvalid('SKU 与商品不匹配');
  }
  if (product.max_buy > 0 && input.quantity > product.max_buy) {
    throw AppError.paramInvalid(`单次购买超过限额 ${product.max_buy}`);
  }
  const existing = await findCartItem(userId, input.skuId);
  if (!existing) {
    const count = await countCartItemsInStore(userId, input.storeId);
    if (count >= MAX_ITEMS_PER_STORE) {
      throw AppError.paramInvalid(
        `单门店购物车商品种类上限 ${MAX_ITEMS_PER_STORE}`,
      );
    }
  }
  const id = await upsertCartItem(
    userId,
    input.storeId,
    input.productId,
    input.skuId,
    input.quantity,
  );
  const row = await findCartItemById(id);
  return {
    id: row!.id,
    storeId: row!.store_id,
    productId: row!.product_id,
    skuId: row!.sku_id,
    quantity: row!.quantity,
    product: {
      name: product.name,
      image:
        Array.isArray(product.images)
          ? (product.images as string[])[0]
          : parseImage(product.images),
      price: yuanToFen(readDecimal(sku.price)),
      status: product.status,
    },
  };
};

const parseImage = (v: unknown): string => {
  if (!v) return '';
  if (typeof v === 'string') {
    try {
      const arr = JSON.parse(v);
      return Array.isArray(arr) && arr[0] ? String(arr[0]) : '';
    } catch {
      return v;
    }
  }
  return '';
};

export const updateCartQuantity = async (
  userId: number,
  itemId: number,
  quantity: number,
) => {
  if (quantity <= 0) {
    throw AppError.paramInvalid('数量必须 > 0');
  }
  const row = await findCartItemById(itemId);
  if (!row) throw AppError.notFound('购物车项不存在');
  if (row.user_id !== userId) throw AppError.forbidden('不能操作他人购物车');
  const product = await findProductById(row.product_id);
  if (product && product.max_buy > 0 && quantity > product.max_buy) {
    throw AppError.paramInvalid(`超过商品限购 ${product.max_buy}`);
  }
  await setCartItemQuantity(itemId, quantity);
  const updated = await findCartItemById(itemId);
  return {
    id: updated!.id,
    quantity: updated!.quantity,
  };
};

export const removeCartItem = async (userId: number, itemId: number) => {
  const row = await findCartItemById(itemId);
  if (!row) return;
  if (row.user_id !== userId) throw AppError.forbidden('不能操作他人购物车');
  await deleteCartItem(itemId);
};

export const clearCart = async (userId: number, storeId?: number) => {
  await clearCartByUser(userId, storeId);
};

/** 按门店分组返回购物车 */
export const getCart = async (userId: number) => {
  const items = await listCartItemsByUser(userId);
  if (items.length === 0) return { groups: [], totalGroups: 0 };

  const storeIds = Array.from(new Set(items.map((i) => i.store_id)));
  const productIds = Array.from(new Set(items.map((i) => i.product_id)));
  const skuIds = Array.from(new Set(items.map((i) => i.sku_id)));

  const stores = await Promise.all(storeIds.map((id) => findStoreById(id)));
  const products = await Promise.all(productIds.map((id) => findProductById(id)));
  const skus = await Promise.all(skuIds.map((id) => findSkuById(id)));

  const storeMap = new Map(stores.filter(Boolean).map((s) => [s!.id, s!]));
  const productMap = new Map(products.filter(Boolean).map((p) => [p!.id, p!]));
  const skuMap = new Map(skus.filter(Boolean).map((s) => [s!.id, s!]));

  const groupsMap = new Map<number, {
    storeId: number;
    storeName: string;
    storeStatus: string;
    minOrderAmount: number;
    deliveryFee: number;
    items: Array<unknown>;
    totalAmount: number;
    itemCount: number;
  }>();

  for (const item of items) {
    const store = storeMap.get(item.store_id);
    const product = productMap.get(item.product_id);
    const sku = skuMap.get(item.sku_id);
    if (!store) continue;

    if (!groupsMap.has(item.store_id)) {
      groupsMap.set(item.store_id, {
        storeId: store.id,
        storeName: store.name,
        storeStatus: store.status,
        minOrderAmount: yuanToFen(readDecimal(store.min_order_amount)),
        deliveryFee: yuanToFen(readDecimal(store.delivery_fee)),
        items: [],
        totalAmount: 0,
        itemCount: 0,
      });
    }
    const group = groupsMap.get(item.store_id)!;

    const priceFen = sku ? yuanToFen(readDecimal(sku.price)) : 0;
    const subtotal = priceFen * item.quantity;

    group.items.push({
      id: item.id,
      productId: item.product_id,
      skuId: item.sku_id,
      quantity: item.quantity,
      product: {
        name: product?.name ?? '',
        image: parseImage(product?.images),
        price: priceFen,
        packingFee: product ? yuanToFen(readDecimal(product.packing_fee)) : 0,
        status: product?.status ?? 'UNKNOWN',
        stock: sku?.stock ?? 0,
        specText: sku?.spec_text ?? '',
        available:
          !!product &&
          product.status === 'ON_SHELF' &&
          !!sku &&
          sku.stock >= item.quantity,
      },
    });
    group.totalAmount += subtotal;
    group.itemCount += item.quantity;
  }

  const groups = Array.from(groupsMap.values());
  return { groups, totalGroups: groups.length };
};

export interface CheckCartInput {
  storeId: number;
  itemIds?: number[];
}

export const checkCart = async (userId: number, input: CheckCartInput) => {
  const store = await findStoreById(input.storeId);
  if (!store) throw new AppError(ErrorCode.STORE_NOT_FOUND, '门店不存在', 404);

  const allItems = await listCartItemsByUser(userId);
  const items = allItems.filter(
    (i) =>
      i.store_id === input.storeId &&
      (!input.itemIds || input.itemIds.includes(i.id)),
  );

  let totalAmount = 0;
  const invalidItems: Array<{ itemId: number; reason: string }> = [];

  for (const item of items) {
    const product = await findProductById(item.product_id);
    const sku = await findSkuById(item.sku_id);
    if (!product || product.status !== 'ON_SHELF') {
      invalidItems.push({ itemId: item.id, reason: '商品已下架' });
      continue;
    }
    if (!sku) {
      invalidItems.push({ itemId: item.id, reason: 'SKU 不存在' });
      continue;
    }
    if (sku.stock < item.quantity) {
      invalidItems.push({
        itemId: item.id,
        reason: `库存不足（当前 ${sku.stock}，需要 ${item.quantity}）`,
      });
      continue;
    }
    totalAmount += yuanToFen(readDecimal(sku.price)) * item.quantity;
  }

  const minOrderFen = yuanToFen(readDecimal(store.min_order_amount));
  const storeOpen = store.status === 'OPEN';
  const meetsMinOrder = totalAmount >= minOrderFen;

  return {
    valid: storeOpen && meetsMinOrder && invalidItems.length === 0,
    storeOpen,
    meetsMinOrder,
    invalidItems,
    totalAmount,
    minOrderAmount: minOrderFen,
  };
};
