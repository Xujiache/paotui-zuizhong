import { RowDataPacket } from 'mysql2';
import { execute, queryOne } from '../utils/database';

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
  status: string;
  audit_status: string;
  audit_remark: string;
  audited_at: Date | null;
  online_status: string;
  accept_radius: number;
  service_area_id: number | null;
  current_lat: number | null;
  current_lng: number | null;
  last_location_at: Date | null;
  balance: number;
  frozen_balance: number;
  total_orders: number;
  rating: number;
  created_at: Date;
  updated_at: Date;
  is_deleted: number;
}

export const findRiderById = async (id: number): Promise<RiderRow | null> => {
  return queryOne<RiderRow>('SELECT * FROM riders WHERE id = ? AND is_deleted = 0', [id]);
};

export const findRiderByPhone = async (phone: string): Promise<RiderRow | null> => {
  return queryOne<RiderRow>('SELECT * FROM riders WHERE phone = ? AND is_deleted = 0', [phone]);
};

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
