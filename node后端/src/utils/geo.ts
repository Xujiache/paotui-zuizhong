/**
 * 地理计算工具
 *
 * 使用 Haversine 公式计算两点间大圆距离，精度满足同城配送（几百米-几十公里）需求。
 * 地球半径取 6371000 米（平均值）。
 */

const EARTH_RADIUS_METERS = 6371000;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

export interface LatLng {
  lat: number;
  lng: number;
}

/** Haversine 距离（米），返回整数 */
export const haversineMeters = (a: LatLng, b: LatLng): number => {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return Math.round(EARTH_RADIUS_METERS * c);
};

/** 判断 b 是否在 a 的半径范围内（米） */
export const isWithinRadius = (a: LatLng, b: LatLng, radiusMeters: number): boolean =>
  haversineMeters(a, b) <= radiusMeters;

/** 粗略的经纬度 bounding box（用于 SQL WHERE 快速过滤，避免全表扫描）
 *  1 度纬度 ≈ 111km；1 度经度 ≈ 111km × cos(lat)
 */
export const buildBoundingBox = (
  center: LatLng,
  radiusMeters: number,
): { minLat: number; maxLat: number; minLng: number; maxLng: number } => {
  const latDelta = radiusMeters / 111000;
  const lngDelta = radiusMeters / (111000 * Math.cos(toRad(center.lat)) || 1);
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
};

/** 校验经纬度范围合法性 */
export const isValidLatLng = (lat: number, lng: number): boolean =>
  typeof lat === 'number' &&
  typeof lng === 'number' &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180;
