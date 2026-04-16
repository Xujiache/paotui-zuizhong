import { RowDataPacket } from 'mysql2';
import { execute, query, queryOne } from '../utils/database';
import { buildBoundingBox } from '../utils/geo';

export interface StoreRow extends RowDataPacket {
  id: number;
  merchant_id: number;
  name: string;
  logo: string;
  images: unknown;
  phone: string;
  province: string;
  city: string;
  district: string;
  address: string;
  lat: string | number;
  lng: string | number;
  business_hours: unknown;
  min_order_amount: string | number;
  delivery_fee: string | number;
  delivery_range: number;
  delivery_time: number;
  packing_fee: string | number;
  announcement: string;
  status: string;
  is_busy: number;
  sort: number;
  commission_rate: string | number;
  area_id: number | null;
  printer_config: unknown;
  created_at: Date;
  updated_at: Date;
  is_deleted: number;
}

export const findStoreById = async (id: number): Promise<StoreRow | null> =>
  queryOne<StoreRow>('SELECT * FROM stores WHERE id = ? AND is_deleted = 0', [id]);

export const listStoresByMerchant = async (merchantId: number): Promise<StoreRow[]> =>
  query<StoreRow[]>(
    'SELECT * FROM stores WHERE merchant_id = ? AND is_deleted = 0 ORDER BY sort DESC, id DESC',
    [merchantId],
  );

export interface CreateStoreParams {
  merchantId: number;
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  logo?: string;
  minOrderAmount?: number;
  deliveryFee?: number;
  deliveryRange?: number;
  deliveryTime?: number;
  packingFee?: number;
  commissionRate?: number;
  areaId?: number;
}

export const createStore = async (params: CreateStoreParams): Promise<number> => {
  const result = await execute(
    `INSERT INTO stores
      (merchant_id, name, phone, province, city, district, address, lat, lng, logo,
       min_order_amount, delivery_fee, delivery_range, delivery_time, packing_fee,
       commission_rate, area_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.merchantId,
      params.name,
      params.phone,
      params.province,
      params.city,
      params.district,
      params.address,
      params.lat,
      params.lng,
      params.logo ?? '',
      params.minOrderAmount ?? 0,
      params.deliveryFee ?? 0,
      params.deliveryRange ?? 3000,
      params.deliveryTime ?? 30,
      params.packingFee ?? 0,
      params.commissionRate ?? 0,
      params.areaId ?? null,
    ],
  );
  return result.insertId;
};

export interface UpdateStoreParams {
  name?: string;
  phone?: string;
  province?: string;
  city?: string;
  district?: string;
  address?: string;
  lat?: number;
  lng?: number;
  logo?: string;
  announcement?: string;
}

export const updateStoreInfo = async (
  id: number,
  params: UpdateStoreParams,
): Promise<void> => {
  const sets: string[] = [];
  const vals: Array<string | number> = [];
  const map: Record<string, string> = {
    name: 'name',
    phone: 'phone',
    province: 'province',
    city: 'city',
    district: 'district',
    address: 'address',
    lat: 'lat',
    lng: 'lng',
    logo: 'logo',
    announcement: 'announcement',
  };
  for (const key of Object.keys(map) as Array<keyof UpdateStoreParams>) {
    if (params[key] !== undefined) {
      sets.push(`${map[key]} = ?`);
      vals.push(params[key] as string | number);
    }
  }
  if (sets.length === 0) return;
  vals.push(id);
  await execute(`UPDATE stores SET ${sets.join(', ')} WHERE id = ?`, vals);
};

export const updateStoreBusinessHours = async (
  id: number,
  businessHours: unknown,
): Promise<void> => {
  await execute(`UPDATE stores SET business_hours = ? WHERE id = ?`, [
    JSON.stringify(businessHours),
    id,
  ]);
};

export interface DeliveryConfigParams {
  minOrderAmount?: number;
  deliveryFee?: number;
  deliveryRange?: number;
  deliveryTime?: number;
  packingFee?: number;
}

export const updateStoreDelivery = async (
  id: number,
  params: DeliveryConfigParams,
): Promise<void> => {
  const sets: string[] = [];
  const vals: number[] = [];
  const map: Record<string, string> = {
    minOrderAmount: 'min_order_amount',
    deliveryFee: 'delivery_fee',
    deliveryRange: 'delivery_range',
    deliveryTime: 'delivery_time',
    packingFee: 'packing_fee',
  };
  for (const key of Object.keys(map) as Array<keyof DeliveryConfigParams>) {
    if (params[key] !== undefined) {
      sets.push(`${map[key]} = ?`);
      vals.push(params[key] as number);
    }
  }
  if (sets.length === 0) return;
  vals.push(id);
  await execute(`UPDATE stores SET ${sets.join(', ')} WHERE id = ?`, vals);
};

export const updateStoreStatus = async (
  id: number,
  status: 'OPEN' | 'CLOSED' | 'SUSPENDED',
): Promise<void> => {
  await execute(`UPDATE stores SET status = ? WHERE id = ?`, [status, id]);
};

export const updateStorePrinter = async (
  id: number,
  printerConfig: unknown,
): Promise<void> => {
  await execute(`UPDATE stores SET printer_config = ? WHERE id = ?`, [
    JSON.stringify(printerConfig),
    id,
  ]);
};

export const updateStoreAnnouncement = async (
  id: number,
  announcement: string,
): Promise<void> => {
  await execute(`UPDATE stores SET announcement = ? WHERE id = ?`, [announcement, id]);
};

export interface NearbyQuery {
  lat: number;
  lng: number;
  radiusMeters: number;
  category?: string;
  keyword?: string;
  page: number;
  pageSize: number;
}

/**
 * 用 bounding box 预过滤 + 应用层 Haversine 精排。
 * 注：真正大规模场景应该用 MySQL 8 的地理函数或 Redis Geo。
 */
export const listNearbyStores = async (
  params: NearbyQuery,
): Promise<StoreRow[]> => {
  const box = buildBoundingBox(
    { lat: params.lat, lng: params.lng },
    params.radiusMeters,
  );
  const where: string[] = [
    `s.is_deleted = 0`,
    `s.status = 'OPEN'`,
    `s.lat BETWEEN ? AND ?`,
    `s.lng BETWEEN ? AND ?`,
  ];
  const vals: Array<string | number> = [box.minLat, box.maxLat, box.minLng, box.maxLng];
  if (params.keyword) {
    where.push(`s.name LIKE ?`);
    vals.push(`%${params.keyword}%`);
  }
  const whereSql = where.join(' AND ');

  const rows = await query<StoreRow[]>(
    `SELECT s.* FROM stores s
     INNER JOIN merchants m
       ON m.id = s.merchant_id
      AND m.audit_status = 'APPROVED'
      AND m.status = 'ACTIVE'
      AND m.is_deleted = 0
     WHERE ${whereSql}`,
    vals,
  );
  return rows;
};
