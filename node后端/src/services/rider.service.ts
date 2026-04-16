import { AppError } from '../utils/AppError';
import { ErrorCode, AccountStatus, AuditStatus, OnlineStatus } from '../types/enums';
import {
  findRiderById,
  updateRiderApplyInfo,
  updateRiderProfile,
  updateRiderOnlineStatus,
  updateRiderLocation,
  updateRiderAcceptSettings,
  auditRider,
  setRiderStatus,
  listRiders,
  insertRiderTrack,
  listTracksByOrder,
  RiderRow,
  RiderApplyParams,
  UpdateRiderProfileParams,
  UpdateAcceptSettingsParams,
  RiderListParams,
} from '../models/rider.model';
import { writeAuditLog } from '../models/auditLog.model';
import { isValidLatLng } from '../utils/geo';
import { readDecimal, yuanToFen } from '../utils/money';
import { maskPhone } from '../utils/helpers';
import { riderGeoStore } from '../utils/redis';

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

const formatRider = (row: RiderRow) => ({
  id: row.id,
  phone: maskPhone(row.phone),
  name: row.name,
  avatar: row.avatar,
  idCardFront: row.id_card_front,
  idCardBack: row.id_card_back,
  healthCert: row.health_cert,
  vehicleType: row.vehicle_type,
  vehicleNo: row.vehicle_no,
  emergencyContact: row.emergency_contact,
  emergencyPhone: row.emergency_phone,
  status: row.status,
  auditStatus: row.audit_status,
  auditRemark: row.audit_remark,
  auditedAt: row.audited_at,
  onlineStatus: row.online_status,
  acceptOrderTypes: parseJson(row.accept_order_types),
  acceptRadius: row.accept_radius,
  serviceAreaId: row.service_area_id,
  currentLat: row.current_lat != null ? readDecimal(row.current_lat) : null,
  currentLng: row.current_lng != null ? readDecimal(row.current_lng) : null,
  lastLocationAt: row.last_location_at,
  balance: yuanToFen(readDecimal(row.balance)),
  frozenBalance: yuanToFen(readDecimal(row.frozen_balance)),
  totalOrders: row.total_orders,
  rating: readDecimal(row.rating),
  createdAt: row.created_at,
});

// ========== 入驻 & 审核状态 ==========

export const getAuditStatus = async (riderId: number) => {
  const row = await findRiderById(riderId);
  if (!row) throw AppError.notFound('骑手不存在');
  return {
    auditStatus: row.audit_status,
    status: row.status,
    auditRemark: row.audit_remark,
    auditedAt: row.audited_at,
  };
};

export const submitApply = async (riderId: number, params: RiderApplyParams) => {
  const row = await findRiderById(riderId);
  if (!row) throw AppError.notFound('骑手不存在');
  if (row.audit_status === AuditStatus.APPROVED) {
    throw new AppError(
      ErrorCode.STORE_STATUS_INVALID,
      '已通过审核，无需再次提交',
      400,
    );
  }
  await updateRiderApplyInfo(riderId, params);
  const updated = await findRiderById(riderId);
  return formatRider(updated!);
};

// ========== 个人资料 ==========

export const getProfile = async (riderId: number) => {
  const row = await findRiderById(riderId);
  if (!row) throw AppError.notFound('骑手不存在');
  return formatRider(row);
};

export const updateProfile = async (
  riderId: number,
  params: UpdateRiderProfileParams,
) => {
  await updateRiderProfile(riderId, params);
  return getProfile(riderId);
};

// ========== 在线状态 ==========

export const switchOnlineStatus = async (
  riderId: number,
  status: 'ONLINE' | 'OFFLINE' | 'BUSY',
) => {
  const row = await findRiderById(riderId);
  if (!row) throw AppError.notFound('骑手不存在');

  if (status === OnlineStatus.ONLINE) {
    if (row.audit_status !== AuditStatus.APPROVED) {
      throw new AppError(
        ErrorCode.RIDER_AUDIT_NOT_PASSED,
        '骑手审核未通过，不能上线',
        400,
      );
    }
    if (row.status === AccountStatus.FROZEN) {
      throw new AppError(ErrorCode.RIDER_FROZEN, '骑手账号已冻结', 403);
    }
  }

  await updateRiderOnlineStatus(riderId, status);

  if (status === OnlineStatus.OFFLINE) {
    await riderGeoStore.removeRider(riderId);
  } else if (
    status === OnlineStatus.ONLINE &&
    row.current_lat !== null &&
    row.current_lng !== null
  ) {
    await riderGeoStore.addRider(
      riderId,
      Number(row.current_lng),
      Number(row.current_lat),
    );
  }

  return { onlineStatus: status };
};

// ========== 位置上报 ==========

export interface ReportLocationParams {
  lat: number;
  lng: number;
  speed?: number;
  direction?: number;
  accuracy?: number;
  orderId?: number | null;
}

export const reportLocation = async (
  riderId: number,
  params: ReportLocationParams,
) => {
  if (!isValidLatLng(params.lat, params.lng)) {
    throw AppError.paramInvalid('经纬度不合法');
  }
  const row = await findRiderById(riderId);
  if (!row) throw AppError.notFound('骑手不存在');
  if (row.online_status !== OnlineStatus.ONLINE && row.online_status !== OnlineStatus.BUSY) {
    throw new AppError(ErrorCode.RIDER_NOT_ONLINE, '骑手未在线，不能上报位置', 400);
  }

  await updateRiderLocation(riderId, params.lat, params.lng);
  await riderGeoStore.addRider(riderId, params.lng, params.lat);

  if (params.orderId) {
    await insertRiderTrack(
      riderId,
      params.orderId,
      params.lat,
      params.lng,
      params.accuracy ?? 0,
      params.speed ?? 0,
      params.direction ?? 0,
    );
  }

  return { recordedAt: new Date().toISOString() };
};

// ========== 接单设置 ==========

export const getAcceptSettings = async (riderId: number) => {
  const row = await findRiderById(riderId);
  if (!row) throw AppError.notFound('骑手不存在');
  return {
    acceptRadius: row.accept_radius,
    acceptOrderTypes: parseJson(row.accept_order_types) ?? [],
    serviceAreaId: row.service_area_id,
  };
};

export const updateAcceptSettings = async (
  riderId: number,
  params: UpdateAcceptSettingsParams,
) => {
  await updateRiderAcceptSettings(riderId, params);
  return getAcceptSettings(riderId);
};

// ========== 轨迹 ==========

export const getTracksByOrder = async (orderId: number) => {
  const rows = await listTracksByOrder(orderId);
  return rows.map((r) => ({
    id: r.id,
    riderId: r.rider_id,
    orderId: r.order_id,
    lat: readDecimal(r.lat),
    lng: readDecimal(r.lng),
    accuracy: readDecimal(r.accuracy),
    speed: readDecimal(r.speed),
    bearing: readDecimal(r.bearing),
    recordedAt: r.recorded_at,
  }));
};

// ========== 收入/订单统计（占位，订单中心完成后补全） ==========

export const getRiderIncome = async (riderId: number) => {
  const row = await findRiderById(riderId);
  if (!row) throw AppError.notFound('骑手不存在');
  return {
    today: { orderCount: 0, incomeFen: 0 },
    week: { orderCount: 0, incomeFen: 0 },
    month: { orderCount: 0, incomeFen: 0 },
    balance: yuanToFen(readDecimal(row.balance)),
    frozenBalance: yuanToFen(readDecimal(row.frozen_balance)),
    totalOrders: row.total_orders,
  };
};

export const getRiderStats = async (riderId: number) => {
  const row = await findRiderById(riderId);
  if (!row) throw AppError.notFound('骑手不存在');
  return {
    totalOrders: row.total_orders,
    rating: readDecimal(row.rating),
    onTimeRate: 0,
    completionRate: 0,
  };
};

// ========== 后台审核/管理 ==========

export const adminListRiders = async (params: RiderListParams) => {
  const { list, total } = await listRiders(params);
  return {
    list: list.map(formatRider),
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
};

export const adminGetRider = async (id: number) => {
  const row = await findRiderById(id);
  if (!row) throw AppError.notFound('骑手不存在');
  return formatRider(row);
};

export const adminAuditRider = async (
  id: number,
  action: 'APPROVE' | 'REJECT',
  remark: string,
  adminId: number,
) => {
  const row = await findRiderById(id);
  if (!row) throw AppError.notFound('骑手不存在');
  if (row.audit_status !== AuditStatus.PENDING) {
    throw new AppError(
      ErrorCode.STORE_STATUS_INVALID,
      `骑手当前审核状态为 ${row.audit_status}，不允许再次审核`,
      400,
    );
  }
  await auditRider(id, action, remark);
  await writeAuditLog({
    operatorId: adminId,
    operatorType: 'ADMIN',
    action: action === 'APPROVE' ? 'APPROVE' : 'REJECT',
    module: 'RIDER',
    targetType: 'RIDER',
    targetId: id,
    detail: { remark },
  });
  const updated = await findRiderById(id);
  return formatRider(updated!);
};

export const adminSetRiderStatus = async (
  id: number,
  status: 'ACTIVE' | 'FROZEN',
  adminId: number,
) => {
  const row = await findRiderById(id);
  if (!row) throw AppError.notFound('骑手不存在');
  await setRiderStatus(id, status);
  if (status === AccountStatus.FROZEN) {
    await riderGeoStore.removeRider(id);
    await updateRiderOnlineStatus(id, OnlineStatus.OFFLINE);
  }
  await writeAuditLog({
    operatorId: adminId,
    operatorType: 'ADMIN',
    action: status === 'FROZEN' ? 'FREEZE' : 'UNFREEZE',
    module: 'RIDER',
    targetType: 'RIDER',
    targetId: id,
  });
  const updated = await findRiderById(id);
  return formatRider(updated!);
};
