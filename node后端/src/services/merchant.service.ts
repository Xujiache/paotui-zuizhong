import { AppError } from '../utils/AppError';
import { ErrorCode, AccountStatus, AuditStatus } from '../types/enums';
import {
  findMerchantById,
  updateMerchantApplyInfo,
  auditMerchant as auditMerchantModel,
  setMerchantStatus,
  listMerchants,
  AdminMerchantAuditParams,
  MerchantApplyParams,
  MerchantListParams,
  MerchantRow,
} from '../models/merchant.model';
import {
  findStoreById,
  listStoresByMerchant,
  createStore,
  updateStoreInfo,
  updateStoreBusinessHours,
  updateStoreDelivery,
  updateStoreStatus,
  updateStorePrinter,
  updateStoreAnnouncement,
  listNearbyStores,
  CreateStoreParams,
  UpdateStoreParams,
  DeliveryConfigParams,
  StoreRow,
} from '../models/store.model';
import { writeAuditLog } from '../models/auditLog.model';
import { isValidLatLng, haversineMeters } from '../utils/geo';
import { yuanToFen, readDecimal } from '../utils/money';
import { maskPhone } from '../utils/helpers';

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

const formatMerchant = (row: MerchantRow) => ({
  id: row.id,
  name: row.name,
  contactName: row.contact_name,
  contactPhone: maskPhone(row.contact_phone),
  licenseNo: row.license_no,
  licenseImage: row.license_image,
  idCardFront: row.id_card_front,
  idCardBack: row.id_card_back,
  category: row.category,
  balance: yuanToFen(readDecimal(row.balance)),
  frozenBalance: yuanToFen(readDecimal(row.frozen_balance)),
  status: row.status,
  auditStatus: row.audit_status,
  auditRemark: row.audit_remark,
  auditedAt: row.audited_at,
  createdAt: row.created_at,
});

const formatStore = (row: StoreRow, distanceMeters?: number) => ({
  id: row.id,
  merchantId: row.merchant_id,
  name: row.name,
  logo: row.logo,
  images: parseJson(row.images),
  phone: row.phone,
  province: row.province,
  city: row.city,
  district: row.district,
  address: row.address,
  lat: readDecimal(row.lat),
  lng: readDecimal(row.lng),
  businessHours: parseJson(row.business_hours),
  minOrderAmount: yuanToFen(readDecimal(row.min_order_amount)),
  deliveryFee: yuanToFen(readDecimal(row.delivery_fee)),
  deliveryRange: row.delivery_range,
  deliveryTime: row.delivery_time,
  packingFee: yuanToFen(readDecimal(row.packing_fee)),
  announcement: row.announcement,
  status: row.status,
  isBusy: row.is_busy === 1,
  sort: row.sort,
  commissionRate: readDecimal(row.commission_rate),
  areaId: row.area_id,
  printerConfig: parseJson(row.printer_config),
  distance: distanceMeters,
});

// ============== 入驻 ==============

export const getAuditStatus = async (merchantId: number) => {
  const row = await findMerchantById(merchantId);
  if (!row) throw AppError.notFound('商家不存在');
  return {
    auditStatus: row.audit_status,
    status: row.status,
    auditRemark: row.audit_remark,
    auditedAt: row.audited_at,
  };
};

export const submitApply = async (merchantId: number, params: MerchantApplyParams) => {
  const row = await findMerchantById(merchantId);
  if (!row) throw AppError.notFound('商家不存在');
  if (row.audit_status === AuditStatus.APPROVED) {
    throw new AppError(ErrorCode.STORE_STATUS_INVALID, '已通过审核，无需再次提交', 400);
  }
  await updateMerchantApplyInfo(merchantId, params);
  const updated = await findMerchantById(merchantId);
  return formatMerchant(updated!);
};

// ============== 后台审核/管理 ==============

export const adminListMerchants = async (params: MerchantListParams) => {
  const { list, total } = await listMerchants(params);
  return {
    list: list.map(formatMerchant),
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
};

export const adminGetMerchant = async (id: number) => {
  const row = await findMerchantById(id);
  if (!row) throw AppError.notFound('商家不存在');
  return formatMerchant(row);
};

export const adminAuditMerchant = async (
  merchantId: number,
  params: AdminMerchantAuditParams,
  adminId: number,
) => {
  const row = await findMerchantById(merchantId);
  if (!row) throw AppError.notFound('商家不存在');
  if (row.audit_status !== AuditStatus.PENDING) {
    throw new AppError(
      ErrorCode.STORE_STATUS_INVALID,
      `商家当前审核状态为 ${row.audit_status}，不允许再次审核`,
      400,
    );
  }
  await auditMerchantModel(merchantId, params);
  await writeAuditLog({
    operatorId: adminId,
    operatorType: 'ADMIN',
    action: params.action === 'APPROVE' ? 'APPROVE' : 'REJECT',
    module: 'MERCHANT',
    targetType: 'MERCHANT',
    targetId: merchantId,
    detail: { remark: params.remark ?? '' },
  });
  const updated = await findMerchantById(merchantId);
  return formatMerchant(updated!);
};

export const adminSetMerchantStatus = async (
  merchantId: number,
  status: 'ACTIVE' | 'FROZEN',
  adminId: number,
) => {
  const row = await findMerchantById(merchantId);
  if (!row) throw AppError.notFound('商家不存在');
  await setMerchantStatus(merchantId, status);
  await writeAuditLog({
    operatorId: adminId,
    operatorType: 'ADMIN',
    action: status === 'FROZEN' ? 'FREEZE' : 'UNFREEZE',
    module: 'MERCHANT',
    targetType: 'MERCHANT',
    targetId: merchantId,
  });
  const updated = await findMerchantById(merchantId);
  return formatMerchant(updated!);
};

// ============== 门店管理 ==============

const ensureMerchantApproved = async (merchantId: number): Promise<MerchantRow> => {
  const row = await findMerchantById(merchantId);
  if (!row) throw AppError.notFound('商家不存在');
  if (row.audit_status !== AuditStatus.APPROVED) {
    throw new AppError(
      ErrorCode.MERCHANT_AUDIT_NOT_PASSED,
      '商家审核未通过，无法操作门店',
      400,
    );
  }
  if (row.status !== AccountStatus.ACTIVE) {
    throw new AppError(ErrorCode.MERCHANT_FROZEN, '商家账号已冻结', 403);
  }
  return row;
};

const ensureOwnedStore = async (merchantId: number, storeId: number): Promise<StoreRow> => {
  const store = await findStoreById(storeId);
  if (!store) throw new AppError(ErrorCode.STORE_NOT_FOUND, '门店不存在', 404);
  if (store.merchant_id !== merchantId) {
    throw new AppError(ErrorCode.STORE_FORBIDDEN, '不能操作他人门店', 403);
  }
  return store;
};

export const getMerchantStores = async (merchantId: number) => {
  const rows = await listStoresByMerchant(merchantId);
  return rows.map((r) => formatStore(r));
};

export const getMerchantStore = async (merchantId: number, storeId: number) => {
  const store = await ensureOwnedStore(merchantId, storeId);
  return formatStore(store);
};

export const createMerchantStore = async (
  merchantId: number,
  params: Omit<CreateStoreParams, 'merchantId'>,
) => {
  await ensureMerchantApproved(merchantId);
  if (!isValidLatLng(params.lat, params.lng)) {
    throw AppError.paramInvalid('经纬度不合法');
  }
  const id = await createStore({ merchantId, ...params });
  const store = await findStoreById(id);
  return formatStore(store!);
};

export const updateMerchantStore = async (
  merchantId: number,
  storeId: number,
  params: UpdateStoreParams,
) => {
  await ensureOwnedStore(merchantId, storeId);
  if (params.lat !== undefined || params.lng !== undefined) {
    if (!isValidLatLng(params.lat ?? 0, params.lng ?? 0)) {
      throw AppError.paramInvalid('经纬度不合法');
    }
  }
  await updateStoreInfo(storeId, params);
  const store = await findStoreById(storeId);
  return formatStore(store!);
};

export const setStoreBusinessHours = async (
  merchantId: number,
  storeId: number,
  businessHours: unknown,
) => {
  await ensureOwnedStore(merchantId, storeId);
  await updateStoreBusinessHours(storeId, businessHours);
};

export const setStoreDelivery = async (
  merchantId: number,
  storeId: number,
  params: DeliveryConfigParams,
) => {
  await ensureOwnedStore(merchantId, storeId);
  await updateStoreDelivery(storeId, params);
};

export const switchStoreStatus = async (
  merchantId: number,
  storeId: number,
  status: 'OPEN' | 'CLOSED' | 'SUSPENDED',
) => {
  await ensureOwnedStore(merchantId, storeId);
  await updateStoreStatus(storeId, status);
};

export const setStorePrinter = async (
  merchantId: number,
  storeId: number,
  printerConfig: unknown,
) => {
  await ensureOwnedStore(merchantId, storeId);
  await updateStorePrinter(storeId, printerConfig);
};

export const setStoreAnnouncement = async (
  merchantId: number,
  storeId: number,
  announcement: string,
) => {
  await ensureOwnedStore(merchantId, storeId);
  await updateStoreAnnouncement(storeId, announcement);
};

// ============== 用户端：附近商家/详情 ==============

export interface NearbyParams {
  lat: number;
  lng: number;
  radius?: number;
  keyword?: string;
  sortBy?: 'distance' | 'sales' | 'rating';
  page: number;
  pageSize: number;
}

export const getNearbyStores = async (params: NearbyParams) => {
  const radius = Math.min(Math.max(params.radius ?? 3000, 500), 20000);
  const rows = await listNearbyStores({
    lat: params.lat,
    lng: params.lng,
    radiusMeters: radius,
    keyword: params.keyword,
    page: params.page,
    pageSize: params.pageSize,
  });

  const withDistance = rows
    .map((row) => ({
      store: row,
      distance: haversineMeters(
        { lat: params.lat, lng: params.lng },
        { lat: Number(readDecimal(row.lat)), lng: Number(readDecimal(row.lng)) },
      ),
    }))
    .filter((x) => x.distance <= radius);

  withDistance.sort((a, b) => a.distance - b.distance);

  const total = withDistance.length;
  const offset = (params.page - 1) * params.pageSize;
  const sliced = withDistance.slice(offset, offset + params.pageSize);

  return {
    list: sliced.map((x) => formatStore(x.store, x.distance)),
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
};

export const getPublicStoreDetail = async (storeId: number) => {
  const store = await findStoreById(storeId);
  if (!store) throw new AppError(ErrorCode.STORE_NOT_FOUND, '门店不存在', 404);
  return formatStore(store);
};

// ============== 工作台 ==============

export const getMerchantDashboard = async (merchantId: number) => {
  // 首期返回基础概览（具体业务统计在订单中心实现后补全）
  const row = await findMerchantById(merchantId);
  if (!row) throw AppError.notFound('商家不存在');
  const stores = await listStoresByMerchant(merchantId);
  return {
    merchantStatus: row.status,
    auditStatus: row.audit_status,
    balance: yuanToFen(readDecimal(row.balance)),
    frozenBalance: yuanToFen(readDecimal(row.frozen_balance)),
    storesCount: stores.length,
    openStoresCount: stores.filter((s) => s.status === 'OPEN').length,
    todayOrders: 0,
    todayRevenue: 0,
  };
};
