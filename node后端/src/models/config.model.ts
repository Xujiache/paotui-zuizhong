import { RowDataPacket } from 'mysql2';
import { execute, query, queryOne } from '../utils/database';

// ========== configs ==========

export interface ConfigRow extends RowDataPacket {
  id: number;
  category: string;
  config_key: string;
  config_value: string;
  value_type: string;
  description: string;
  is_sensitive: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export const findConfigById = async (id: number): Promise<ConfigRow | null> =>
  queryOne<ConfigRow>(`SELECT * FROM configs WHERE id = ?`, [id]);

export const listConfigs = async (
  category?: string,
): Promise<ConfigRow[]> => {
  if (category) {
    return query<ConfigRow[]>(
      `SELECT * FROM configs WHERE category = ? AND status = 'ACTIVE' ORDER BY id ASC`,
      [category],
    );
  }
  return query<ConfigRow[]>(`SELECT * FROM configs ORDER BY category, id ASC`);
};

export const updateConfig = async (
  id: number,
  params: {
    configValue?: string;
    description?: string;
    status?: string;
  },
): Promise<void> => {
  const sets: string[] = [];
  const vals: Array<string> = [];
  if (params.configValue !== undefined) {
    sets.push('config_value = ?');
    vals.push(params.configValue);
  }
  if (params.description !== undefined) {
    sets.push('description = ?');
    vals.push(params.description);
  }
  if (params.status !== undefined) {
    sets.push('status = ?');
    vals.push(params.status);
  }
  if (sets.length === 0) return;
  vals.push(String(id));
  await execute(`UPDATE configs SET ${sets.join(', ')} WHERE id = ?`, vals);
};

// ========== areas ==========

export interface AreaRow extends RowDataPacket {
  id: number;
  parent_id: number;
  name: string;
  level: number;
  code: string;
  lat: string | number | null;
  lng: string | number | null;
  boundary: unknown;
  status: string;
  sort: number;
  created_at: Date;
  updated_at: Date;
  is_deleted: number;
}

export const listAreas = async (parentId?: number): Promise<AreaRow[]> => {
  if (parentId !== undefined) {
    return query<AreaRow[]>(
      `SELECT * FROM areas WHERE parent_id = ? AND is_deleted = 0
       AND status = 'ACTIVE' ORDER BY sort DESC, id ASC`,
      [parentId],
    );
  }
  return query<AreaRow[]>(
    `SELECT * FROM areas WHERE is_deleted = 0 AND status = 'ACTIVE'
     ORDER BY level, sort DESC, id ASC`,
  );
};

export const findAreaById = async (id: number): Promise<AreaRow | null> =>
  queryOne<AreaRow>(`SELECT * FROM areas WHERE id = ? AND is_deleted = 0`, [id]);

export const createArea = async (params: {
  parentId: number;
  name: string;
  level: number;
  code?: string;
  lat?: number;
  lng?: number;
  sort?: number;
}): Promise<number> => {
  const result = await execute(
    `INSERT INTO areas (parent_id, name, level, code, lat, lng, sort)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      params.parentId,
      params.name,
      params.level,
      params.code ?? '',
      params.lat ?? null,
      params.lng ?? null,
      params.sort ?? 0,
    ],
  );
  return result.insertId;
};

export const updateArea = async (
  id: number,
  params: { name?: string; status?: string; sort?: number },
): Promise<void> => {
  const sets: string[] = [];
  const vals: Array<string | number> = [];
  if (params.name !== undefined) {
    sets.push('name = ?');
    vals.push(params.name);
  }
  if (params.status !== undefined) {
    sets.push('status = ?');
    vals.push(params.status);
  }
  if (params.sort !== undefined) {
    sets.push('sort = ?');
    vals.push(params.sort);
  }
  if (sets.length === 0) return;
  vals.push(id);
  await execute(`UPDATE areas SET ${sets.join(', ')} WHERE id = ?`, vals);
};

export const softDeleteArea = async (id: number): Promise<void> => {
  await execute(`UPDATE areas SET is_deleted = 1 WHERE id = ?`, [id]);
};

export const countChildrenAreas = async (parentId: number): Promise<number> => {
  const rows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM areas WHERE parent_id = ? AND is_deleted = 0`,
    [parentId],
  );
  return rows[0]?.total ?? 0;
};

// ========== banners ==========

export interface BannerRow extends RowDataPacket {
  id: number;
  title: string;
  image: string;
  link_type: string;
  link_value: string;
  position: string;
  target_client: string;
  sort: number;
  status: string;
  start_time: Date | null;
  end_time: Date | null;
  created_at: Date;
  updated_at: Date;
  is_deleted: number;
}

export const listBanners = async (
  position?: string,
  onlyActive = false,
): Promise<BannerRow[]> => {
  const where: string[] = ['is_deleted = 0'];
  const vals: Array<string | number> = [];
  if (position) {
    where.push('position = ?');
    vals.push(position);
  }
  if (onlyActive) {
    where.push("status = 'ACTIVE'");
    where.push('(start_time IS NULL OR start_time <= NOW())');
    where.push('(end_time IS NULL OR end_time >= NOW())');
  }
  const whereSql = where.join(' AND ');
  return query<BannerRow[]>(
    `SELECT * FROM banners WHERE ${whereSql} ORDER BY sort DESC, id DESC`,
    vals,
  );
};

export const findBannerById = async (id: number): Promise<BannerRow | null> =>
  queryOne<BannerRow>(`SELECT * FROM banners WHERE id = ? AND is_deleted = 0`, [id]);

export const createBanner = async (params: {
  title: string;
  image: string;
  linkType?: string;
  linkValue?: string;
  position?: string;
  targetClient?: string;
  sort?: number;
  startTime?: Date | null;
  endTime?: Date | null;
}): Promise<number> => {
  const result = await execute(
    `INSERT INTO banners
      (title, image, link_type, link_value, position, target_client, sort, start_time, end_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.title,
      params.image,
      params.linkType ?? 'NONE',
      params.linkValue ?? '',
      params.position ?? 'HOME',
      params.targetClient ?? 'ALL',
      params.sort ?? 0,
      params.startTime ?? null,
      params.endTime ?? null,
    ],
  );
  return result.insertId;
};

export const updateBanner = async (
  id: number,
  params: {
    title?: string;
    image?: string;
    linkType?: string;
    linkValue?: string;
    sort?: number;
    status?: string;
    startTime?: Date | null;
    endTime?: Date | null;
  },
): Promise<void> => {
  const sets: string[] = [];
  const vals: Array<string | number | Date | null> = [];
  const map: Record<string, string> = {
    title: 'title',
    image: 'image',
    linkType: 'link_type',
    linkValue: 'link_value',
    sort: 'sort',
    status: 'status',
    startTime: 'start_time',
    endTime: 'end_time',
  };
  for (const key of Object.keys(map) as Array<keyof typeof params>) {
    if (params[key] !== undefined) {
      sets.push(`${map[key]} = ?`);
      vals.push(params[key] as string | number | Date | null);
    }
  }
  if (sets.length === 0) return;
  vals.push(id);
  await execute(`UPDATE banners SET ${sets.join(', ')} WHERE id = ?`, vals);
};

export const softDeleteBanner = async (id: number): Promise<void> => {
  await execute(`UPDATE banners SET is_deleted = 1 WHERE id = ?`, [id]);
};
