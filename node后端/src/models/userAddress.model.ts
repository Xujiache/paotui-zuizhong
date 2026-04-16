import { RowDataPacket } from 'mysql2';
import { execute, query, queryOne, transaction } from '../utils/database';

export interface UserAddressRow extends RowDataPacket {
  id: number;
  user_id: number;
  contact_name: string;
  contact_phone: string;
  province: string;
  city: string;
  district: string;
  address: string;
  house_number: string;
  lat: string | number;
  lng: string | number;
  tag: string;
  is_default: number;
  created_at: Date;
  updated_at: Date;
  is_deleted: number;
}

export interface CreateUserAddressParams {
  userId: number;
  contactName: string;
  contactPhone: string;
  province: string;
  city: string;
  district: string;
  address: string;
  houseNumber?: string;
  lat: number;
  lng: number;
  tag?: string;
  isDefault?: boolean;
}

export const listUserAddresses = async (userId: number): Promise<UserAddressRow[]> =>
  query<UserAddressRow[]>(
    `SELECT * FROM user_addresses
     WHERE user_id = ? AND is_deleted = 0
     ORDER BY is_default DESC, id DESC`,
    [userId],
  );

export const findUserAddressById = async (id: number): Promise<UserAddressRow | null> =>
  queryOne<UserAddressRow>(
    `SELECT * FROM user_addresses WHERE id = ? AND is_deleted = 0`,
    [id],
  );

export const countUserAddresses = async (userId: number): Promise<number> => {
  const rows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM user_addresses WHERE user_id = ? AND is_deleted = 0`,
    [userId],
  );
  return rows[0]?.total ?? 0;
};

export const createUserAddress = async (params: CreateUserAddressParams): Promise<number> =>
  transaction(async (conn) => {
    if (params.isDefault) {
      await conn.execute(
        `UPDATE user_addresses SET is_default = 0 WHERE user_id = ? AND is_deleted = 0`,
        [params.userId],
      );
    }
    const [result] = await conn.execute<import('mysql2').ResultSetHeader>(
      `INSERT INTO user_addresses
         (user_id, contact_name, contact_phone, province, city, district, address, house_number, lat, lng, tag, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.userId,
        params.contactName,
        params.contactPhone,
        params.province,
        params.city,
        params.district,
        params.address,
        params.houseNumber ?? '',
        params.lat,
        params.lng,
        params.tag ?? '',
        params.isDefault ? 1 : 0,
      ],
    );
    return result.insertId;
  });

export interface UpdateUserAddressParams {
  contactName?: string;
  contactPhone?: string;
  province?: string;
  city?: string;
  district?: string;
  address?: string;
  houseNumber?: string;
  lat?: number;
  lng?: number;
  tag?: string;
}

export const updateUserAddress = async (
  id: number,
  params: UpdateUserAddressParams,
): Promise<void> => {
  const sets: string[] = [];
  const vals: Array<string | number> = [];
  const map: Record<string, string> = {
    contactName: 'contact_name',
    contactPhone: 'contact_phone',
    province: 'province',
    city: 'city',
    district: 'district',
    address: 'address',
    houseNumber: 'house_number',
    lat: 'lat',
    lng: 'lng',
    tag: 'tag',
  };
  for (const key of Object.keys(map) as Array<keyof UpdateUserAddressParams>) {
    const v = params[key];
    if (v !== undefined) {
      sets.push(`${map[key]} = ?`);
      vals.push(v as string | number);
    }
  }
  if (sets.length === 0) return;
  vals.push(id);
  await execute(`UPDATE user_addresses SET ${sets.join(', ')} WHERE id = ?`, vals);
};

export const softDeleteUserAddress = async (id: number): Promise<void> => {
  await execute(`UPDATE user_addresses SET is_deleted = 1 WHERE id = ?`, [id]);
};

export const setDefaultAddress = async (userId: number, id: number): Promise<void> => {
  await transaction(async (conn) => {
    await conn.execute(
      `UPDATE user_addresses SET is_default = 0 WHERE user_id = ? AND is_deleted = 0`,
      [userId],
    );
    await conn.execute(
      `UPDATE user_addresses SET is_default = 1 WHERE id = ? AND user_id = ? AND is_deleted = 0`,
      [id, userId],
    );
  });
};
