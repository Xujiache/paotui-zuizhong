import { RowDataPacket } from 'mysql2';
import { execute, query, queryOne } from '../utils/database';

export interface RiderRow extends RowDataPacket {
  id: number;
  phone: string;
  password_hash: string;
  name: string;
  avatar: string;
  id_card_no: string;
  id_card_front: string;
  id_card_back: string;
  health_cert: string;
  vehicle_type: string;
  vehicle_no: string;
  emergency_contact: string;
  emergency_phone: string;
  status: string;
  audit_status: string;
  audit_remark: string;
  audited_at: Date | null;
  online_status: string;
  accept_order_types: unknown;
  accept_radius: number;
  service_area_id: number | null;
  current_lat: string | number | null;
  current_lng: string | number | null;
  last_location_at: Date | null;
  balance: string | number;
  frozen_balance: string | number;
  total_orders: number;
  rating: string | number;
  created_at: Date;
  updated_at: Date;
  is_deleted: number;
}

export const findRiderById = async (id: number): Promise<RiderRow | null> =>
  queryOne<RiderRow>('SELECT * FROM riders WHERE id = ? AND is_deleted = 0', [id]);

export const findRiderByPhone = async (phone: string): Promise<RiderRow | null> =>
  queryOne<RiderRow>('SELECT * FROM riders WHERE phone = ? AND is_deleted = 0', [phone]);

export interface CreateRiderParams {
  phone: string;
  name: string;
  passwordHash: string;
}

export const createRider = async (params: CreateRiderParams): Promise<number> => {
  const result = await execute(
    `INSERT INTO riders (phone, password_hash, name, status, audit_status, online_status)
     VALUES (?, ?, ?, 'PENDING', 'PENDING', 'OFFLINE')`,
    [params.phone, params.passwordHash, params.name],
  );
  return result.insertId;
};

export const updateRiderOnlineStatus = async (
  id: number,
  onlineStatus: string,
): Promise<void> => {
  await execute('UPDATE riders SET online_status = ? WHERE id = ?', [onlineStatus, id]);
};

export interface RiderApplyParams {
  name?: string;
  avatar?: string;
  idCardNo?: string;
  idCardFront?: string;
  idCardBack?: string;
  healthCert?: string;
  vehicleType?: string;
  vehicleNo?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
}

export const updateRiderApplyInfo = async (
  id: number,
  params: RiderApplyParams,
): Promise<void> => {
  const sets: string[] = [];
  const vals: Array<string | number> = [];
  const map: Record<string, string> = {
    name: 'name',
    avatar: 'avatar',
    idCardNo: 'id_card_no',
    idCardFront: 'id_card_front',
    idCardBack: 'id_card_back',
    healthCert: 'health_cert',
    vehicleType: 'vehicle_type',
    vehicleNo: 'vehicle_no',
    emergencyContact: 'emergency_contact',
    emergencyPhone: 'emergency_phone',
  };
  for (const key of Object.keys(map) as Array<keyof RiderApplyParams>) {
    if (params[key] !== undefined) {
      sets.push(`${map[key]} = ?`);
      vals.push(params[key] as string);
    }
  }
  sets.push(`audit_status = 'PENDING'`, `status = 'PENDING'`);
  vals.push(id);
  await execute(`UPDATE riders SET ${sets.join(', ')} WHERE id = ?`, vals);
};

export interface UpdateRiderProfileParams {
  name?: string;
  avatar?: string;
  vehicleType?: string;
  vehicleNo?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
}

export const updateRiderProfile = async (
  id: number,
  params: UpdateRiderProfileParams,
): Promise<void> => {
  const sets: string[] = [];
  const vals: Array<string | number> = [];
  const map: Record<string, string> = {
    name: 'name',
    avatar: 'avatar',
    vehicleType: 'vehicle_type',
    vehicleNo: 'vehicle_no',
    emergencyContact: 'emergency_contact',
    emergencyPhone: 'emergency_phone',
  };
  for (const key of Object.keys(map) as Array<keyof UpdateRiderProfileParams>) {
    if (params[key] !== undefined) {
      sets.push(`${map[key]} = ?`);
      vals.push(params[key] as string);
    }
  }
  if (sets.length === 0) return;
  vals.push(id);
  await execute(`UPDATE riders SET ${sets.join(', ')} WHERE id = ?`, vals);
};

export const updateRiderLocation = async (
  id: number,
  lat: number,
  lng: number,
): Promise<void> => {
  await execute(
    `UPDATE riders SET current_lat = ?, current_lng = ?, last_location_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [lat, lng, id],
  );
};

export interface UpdateAcceptSettingsParams {
  acceptRadius?: number;
  acceptOrderTypes?: string[];
  serviceAreaId?: number | null;
}

export const updateRiderAcceptSettings = async (
  id: number,
  params: UpdateAcceptSettingsParams,
): Promise<void> => {
  const sets: string[] = [];
  const vals: Array<string | number | null> = [];
  if (params.acceptRadius !== undefined) {
    sets.push('accept_radius = ?');
    vals.push(params.acceptRadius);
  }
  if (params.acceptOrderTypes !== undefined) {
    sets.push('accept_order_types = ?');
    vals.push(JSON.stringify(params.acceptOrderTypes));
  }
  if (params.serviceAreaId !== undefined) {
    sets.push('service_area_id = ?');
    vals.push(params.serviceAreaId);
  }
  if (sets.length === 0) return;
  vals.push(id);
  await execute(`UPDATE riders SET ${sets.join(', ')} WHERE id = ?`, vals as (string | number)[]);
};

export const auditRider = async (
  id: number,
  action: 'APPROVE' | 'REJECT',
  remark = '',
): Promise<void> => {
  const newAudit = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  const newStatus = action === 'APPROVE' ? 'ACTIVE' : 'REJECTED';
  await execute(
    `UPDATE riders
     SET audit_status = ?, status = ?, audit_remark = ?, audited_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [newAudit, newStatus, remark, id],
  );
};

export const setRiderStatus = async (id: number, status: string): Promise<void> => {
  await execute(`UPDATE riders SET status = ? WHERE id = ?`, [status, id]);
};

export interface RiderListParams {
  keyword?: string;
  status?: string;
  auditStatus?: string;
  onlineStatus?: string;
  page: number;
  pageSize: number;
}

export const listRiders = async (
  params: RiderListParams,
): Promise<{ list: RiderRow[]; total: number }> => {
  const where: string[] = ['is_deleted = 0'];
  const vals: Array<string | number> = [];
  if (params.keyword) {
    where.push('(phone LIKE ? OR name LIKE ?)');
    vals.push(`%${params.keyword}%`, `%${params.keyword}%`);
  }
  if (params.status) {
    where.push('status = ?');
    vals.push(params.status);
  }
  if (params.auditStatus) {
    where.push('audit_status = ?');
    vals.push(params.auditStatus);
  }
  if (params.onlineStatus) {
    where.push('online_status = ?');
    vals.push(params.onlineStatus);
  }
  const whereSql = where.join(' AND ');
  const offset = (params.page - 1) * params.pageSize;
  const list = await query<RiderRow[]>(
    `SELECT * FROM riders WHERE ${whereSql} ORDER BY id DESC LIMIT ${params.pageSize} OFFSET ${offset}`,
    vals,
  );
  const total = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM riders WHERE ${whereSql}`,
    vals,
  );
  return { list, total: total[0]?.total ?? 0 };
};

export const insertRiderTrack = async (
  riderId: number,
  orderId: number | null,
  lat: number,
  lng: number,
  accuracy = 0,
  speed = 0,
  bearing = 0,
): Promise<void> => {
  await execute(
    `INSERT INTO rider_tracks (rider_id, order_id, lat, lng, accuracy, speed, bearing)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [riderId, orderId, lat, lng, accuracy, speed, bearing],
  );
};

export interface TrackRow extends RowDataPacket {
  id: number;
  rider_id: number;
  order_id: number | null;
  lat: string | number;
  lng: string | number;
  accuracy: string | number;
  speed: string | number;
  bearing: string | number;
  recorded_at: Date;
}

export const listTracksByOrder = async (orderId: number): Promise<TrackRow[]> =>
  query<TrackRow[]>(
    `SELECT * FROM rider_tracks WHERE order_id = ? ORDER BY recorded_at ASC`,
    [orderId],
  );
