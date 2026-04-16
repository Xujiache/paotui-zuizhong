/**
 * 计价中心
 *
 * 所有金额对外单位：分（整数）。首期不接入复杂的 pricing_rules 表驱动，
 * 采用"门店配置 + 距离分段"的朴素算法满足验收。
 */

import { AppError } from '../utils/AppError';
import { ErrorCode } from '../types/enums';
import { findStoreById } from '../models/store.model';
import { findSkuById, findProductById } from '../models/product.model';
import { listApplicableCouponsForOrder } from '../models/coupon.model';
import { yuanToFen, readDecimal, clampMoney } from '../utils/money';
import { haversineMeters } from '../utils/geo';

export interface PricingItemInput {
  skuId: number;
  quantity: number;
}

export interface PricingBreakdownItem {
  name: string;
  amount: number;
}

export interface ProductPricingResult {
  productAmount: number;
  packingFee: number;
  deliveryFee: number;
  extraFee: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  feeDetails: PricingBreakdownItem[];
  lineItems: Array<{
    skuId: number;
    productId: number;
    productName: string;
    skuText: string;
    productImage: string;
    price: number;
    quantity: number;
    subtotal: number;
  }>;
}

export interface ProductPricingInput {
  storeId: number;
  items: PricingItemInput[];
  deliveryLat: number;
  deliveryLng: number;
  couponRecordId?: number | null;
  userId?: number | null;
}

/** 距离配送费：0-3km 用门店固定 deliveryFee；超出每公里 +200 分（2 元） */
const distanceDeliveryFee = (baseFeeFen: number, distanceMeters: number): number => {
  if (distanceMeters <= 3000) return baseFeeFen;
  const extraKm = Math.ceil((distanceMeters - 3000) / 1000);
  return baseFeeFen + extraKm * 200;
};

/** 高峰时段加价（11:00-13:00 / 17:00-19:00 加 100 分） */
const peakExtraFee = (now = new Date()): number => {
  const hour = now.getHours();
  if ((hour >= 11 && hour < 13) || (hour >= 17 && hour < 19)) return 100;
  return 0;
};

export const calculateProductOrder = async (
  input: ProductPricingInput,
): Promise<ProductPricingResult> => {
  const store = await findStoreById(input.storeId);
  if (!store) throw new AppError(ErrorCode.STORE_NOT_FOUND, '门店不存在', 404);
  if (store.status !== 'OPEN') {
    throw new AppError(ErrorCode.STORE_CLOSED, '门店未营业', 400);
  }

  const distance = haversineMeters(
    { lat: Number(readDecimal(store.lat)), lng: Number(readDecimal(store.lng)) },
    { lat: input.deliveryLat, lng: input.deliveryLng },
  );
  if (distance > store.delivery_range) {
    throw new AppError(
      ErrorCode.ADDRESS_OUT_OF_RANGE,
      `地址不在配送范围内（距离 ${distance} 米，门店可配 ${store.delivery_range} 米）`,
      400,
    );
  }

  let productAmount = 0;
  let packingFee = 0;
  const lineItems: ProductPricingResult['lineItems'] = [];

  for (const item of input.items) {
    const sku = await findSkuById(item.skuId);
    if (!sku) throw new AppError(ErrorCode.SKU_NOT_FOUND, `SKU ${item.skuId} 不存在`, 404);
    const product = await findProductById(sku.product_id);
    if (!product) {
      throw new AppError(ErrorCode.PRODUCT_NOT_FOUND, '商品不存在', 404);
    }
    if (product.status !== 'ON_SHELF') {
      throw new AppError(
        ErrorCode.PRODUCT_OFF_SHELF,
        `商品 ${product.name} 已下架`,
        400,
      );
    }
    if (product.store_id !== input.storeId) {
      throw AppError.paramInvalid('商品与门店不匹配');
    }
    if (sku.stock < item.quantity) {
      throw new AppError(
        ErrorCode.PRODUCT_STOCK_NOT_ENOUGH,
        `商品 ${product.name} 库存不足`,
        400,
      );
    }

    const priceFen = yuanToFen(readDecimal(sku.price));
    const lineSubtotal = priceFen * item.quantity;
    const linePackingFen = yuanToFen(readDecimal(product.packing_fee)) * item.quantity;

    productAmount += lineSubtotal;
    packingFee += linePackingFen;

    const images = Array.isArray(product.images)
      ? product.images
      : (() => {
          try {
            return typeof product.images === 'string' ? JSON.parse(product.images) : [];
          } catch {
            return [];
          }
        })();

    lineItems.push({
      skuId: sku.id,
      productId: product.id,
      productName: product.name,
      skuText: sku.spec_text,
      productImage: Array.isArray(images) && images[0] ? String(images[0]) : '',
      price: priceFen,
      quantity: item.quantity,
      subtotal: lineSubtotal,
    });
  }

  const baseDelivery = yuanToFen(readDecimal(store.delivery_fee));
  const deliveryFee = distanceDeliveryFee(baseDelivery, distance);
  const extraFee = peakExtraFee();

  const minOrderAmount = yuanToFen(readDecimal(store.min_order_amount));
  if (productAmount < minOrderAmount) {
    throw new AppError(
      ErrorCode.UNDER_MIN_ORDER_AMOUNT,
      `未达起送价（当前商品金额 ${productAmount} 分，起送 ${minOrderAmount} 分）`,
      400,
    );
  }

  // 优惠券折扣：仅在传入 couponRecordId 且 userId 可用时计算。
  // 用 listApplicableCouponsForOrder 把满减/百分比/封顶等规则交给 model 统一处理，
  // 若对应 record 不适用（过期、已用、金额不够）则直接抛错而不是静默当作 0。
  let discountAmount = 0;
  if (input.couponRecordId && input.userId) {
    const applicable = await listApplicableCouponsForOrder(
      input.userId,
      input.storeId,
      productAmount,
    );
    const match = applicable.find((i) => i.record.id === input.couponRecordId);
    if (!match) {
      throw new AppError(ErrorCode.COUPON_UNAVAILABLE, '优惠券不可用', 400);
    }
    if (!match.applicable) {
      throw new AppError(
        ErrorCode.COUPON_UNAVAILABLE,
        match.reason ?? '优惠券不可用',
        400,
      );
    }
    if (match.record.status !== 'UNUSED') {
      throw new AppError(ErrorCode.COUPON_UNAVAILABLE, '优惠券已使用或已失效', 400);
    }
    discountAmount = match.discountAmountFen;
  }

  const totalAmount =
    productAmount + packingFee + deliveryFee + extraFee - discountAmount;
  const paidAmount = clampMoney(totalAmount);

  return {
    productAmount,
    packingFee,
    deliveryFee,
    extraFee,
    discountAmount,
    totalAmount,
    paidAmount,
    feeDetails: [
      { name: '商品金额', amount: productAmount },
      { name: '打包费', amount: packingFee },
      { name: '配送费', amount: deliveryFee },
      { name: '时段加价', amount: extraFee },
      { name: '优惠券', amount: -discountAmount },
    ],
    lineItems,
  };
};

// ========== 跑腿订单计价 ==========

export interface ErrandPricingInput {
  serviceType: string;
  pickupLat?: number;
  pickupLng?: number;
  deliveryLat: number;
  deliveryLng: number;
  itemWeight?: number;
  floorInfo?: string;
  tipAmount?: number;
}

export interface ErrandPricingResult {
  baseFee: number;
  distanceFee: number;
  weightFee: number;
  floorFee: number;
  extraFee: number;
  tipAmount: number;
  totalAmount: number;
  paidAmount: number;
  distance: number;
  feeDetails: PricingBreakdownItem[];
}

export const calculateErrandOrder = (
  input: ErrandPricingInput,
): ErrandPricingResult => {
  const baseByType: Record<string, number> = {
    DELIVER: 500, // 帮送 5 元起
    PICKUP: 500, // 帮取 5 元起
    BUY: 800, // 帮买 8 元起
    ERRAND: 1000, // 代办 10 元起
  };
  const baseFee = baseByType[input.serviceType] ?? 500;

  let distance = 0;
  if (
    input.pickupLat !== undefined &&
    input.pickupLng !== undefined
  ) {
    distance = haversineMeters(
      { lat: input.pickupLat, lng: input.pickupLng },
      { lat: input.deliveryLat, lng: input.deliveryLng },
    );
  }

  // 距离费：3km 内免，超出每公里 +150 分
  const distanceFee =
    distance <= 3000 ? 0 : Math.ceil((distance - 3000) / 1000) * 150;

  const weight = input.itemWeight ?? 0;
  const weightFee = weight > 5 ? Math.ceil((weight - 5) * 100) : 0;

  const floorMatch = /^(\d+)/.exec(input.floorInfo ?? '');
  const floorNumber = floorMatch ? Number(floorMatch[1]) : 0;
  const floorFee = floorNumber > 5 ? (floorNumber - 5) * 50 : 0;

  const extraFee = peakExtraFee();
  const tipAmount = Math.max(0, Math.round(input.tipAmount ?? 0));

  const totalAmount = baseFee + distanceFee + weightFee + floorFee + extraFee + tipAmount;
  const paidAmount = clampMoney(totalAmount);

  return {
    baseFee,
    distanceFee,
    weightFee,
    floorFee,
    extraFee,
    tipAmount,
    totalAmount,
    paidAmount,
    distance,
    feeDetails: [
      { name: '基础服务费', amount: baseFee },
      { name: '距离费', amount: distanceFee },
      { name: '重量费', amount: weightFee },
      { name: '楼层费', amount: floorFee },
      { name: '时段加价', amount: extraFee },
      { name: '小费', amount: tipAmount },
    ],
  };
};

// ========== 配送费单独计算接口 ==========

export const calculateDeliveryFee = async (
  storeId: number,
  deliveryLat: number,
  deliveryLng: number,
): Promise<{ deliveryFee: number; distance: number; deliveryRange: number }> => {
  const store = await findStoreById(storeId);
  if (!store) throw new AppError(ErrorCode.STORE_NOT_FOUND, '门店不存在', 404);
  const distance = haversineMeters(
    { lat: Number(readDecimal(store.lat)), lng: Number(readDecimal(store.lng)) },
    { lat: deliveryLat, lng: deliveryLng },
  );
  const baseDelivery = yuanToFen(readDecimal(store.delivery_fee));
  return {
    deliveryFee: distanceDeliveryFee(baseDelivery, distance),
    distance,
    deliveryRange: store.delivery_range,
  };
};
