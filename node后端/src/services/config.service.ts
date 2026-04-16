import { AppError } from '../utils/AppError';
import { ErrorCode } from '../types/enums';
import {
  listAreas,
  findAreaById,
  createArea,
  updateArea,
  softDeleteArea,
  countChildrenAreas,
  listConfigs,
  findConfigById,
  updateConfig,
  listBanners,
  findBannerById,
  createBanner,
  updateBanner,
  softDeleteBanner,
  AreaRow,
  ConfigRow,
  BannerRow,
} from '../models/config.model';
import { readDecimal } from '../utils/money';

const parseJson = (v: unknown) => {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try {
    return typeof v === 'string' ? JSON.parse(v) : v;
  } catch {
    return v;
  }
};

const formatArea = (row: AreaRow) => ({
  id: row.id,
  parentId: row.parent_id,
  name: row.name,
  level: row.level,
  code: row.code,
  lat: row.lat === null ? null : readDecimal(row.lat),
  lng: row.lng === null ? null : readDecimal(row.lng),
  boundary: parseJson(row.boundary),
  status: row.status,
  sort: row.sort,
});

const formatConfig = (row: ConfigRow) => ({
  id: row.id,
  category: row.category,
  configKey: row.config_key,
  configValue: row.is_sensitive === 1 ? '******' : row.config_value,
  valueType: row.value_type,
  description: row.description,
  isSensitive: row.is_sensitive === 1,
  status: row.status,
});

const formatBanner = (row: BannerRow) => ({
  id: row.id,
  title: row.title,
  image: row.image,
  linkType: row.link_type,
  linkValue: row.link_value,
  position: row.position,
  targetClient: row.target_client,
  sort: row.sort,
  status: row.status,
  startTime: row.start_time,
  endTime: row.end_time,
  createdAt: row.created_at,
});

// ========== 区域 ==========

export const getAreas = async (parentId?: number) => {
  const rows = await listAreas(parentId);
  return rows.map(formatArea);
};

export const adminCreateArea = async (params: {
  parentId: number;
  name: string;
  level: number;
  code?: string;
  lat?: number;
  lng?: number;
  sort?: number;
}) => {
  const id = await createArea(params);
  const row = await findAreaById(id);
  return formatArea(row!);
};

export const adminUpdateArea = async (
  id: number,
  params: { name?: string; status?: string; sort?: number },
) => {
  const row = await findAreaById(id);
  if (!row) throw AppError.notFound('区域不存在');
  await updateArea(id, params);
  return formatArea((await findAreaById(id))!);
};

export const adminDeleteArea = async (id: number) => {
  const row = await findAreaById(id);
  if (!row) throw AppError.notFound('区域不存在');
  const childCount = await countChildrenAreas(id);
  if (childCount > 0) {
    throw new AppError(
      ErrorCode.AREA_HAS_CHILDREN,
      '区域下有子区域，不允许删除',
      400,
    );
  }
  await softDeleteArea(id);
};

// ========== 系统参数 ==========

export const adminListConfigs = async (category?: string) => {
  const rows = await listConfigs(category);
  return rows.map(formatConfig);
};

export const adminUpdateConfig = async (
  id: number,
  params: { configValue?: string; description?: string; status?: string },
) => {
  const row = await findConfigById(id);
  if (!row) throw new AppError(ErrorCode.CONFIG_NOT_FOUND, '配置不存在', 404);
  await updateConfig(id, params);
  return formatConfig((await findConfigById(id))!);
};

// ========== Banner ==========

export const getActiveBanners = async (position?: string) => {
  const rows = await listBanners(position, true);
  return rows.map(formatBanner);
};

export const adminListBanners = async (position?: string) => {
  const rows = await listBanners(position, false);
  return rows.map(formatBanner);
};

export const adminCreateBanner = async (params: Parameters<typeof createBanner>[0]) => {
  const id = await createBanner(params);
  const row = await findBannerById(id);
  return formatBanner(row!);
};

export const adminUpdateBanner = async (
  id: number,
  params: Parameters<typeof updateBanner>[1],
) => {
  const row = await findBannerById(id);
  if (!row) throw AppError.notFound('Banner 不存在');
  await updateBanner(id, params);
  return formatBanner((await findBannerById(id))!);
};

export const adminDeleteBanner = async (id: number) => {
  const row = await findBannerById(id);
  if (!row) throw AppError.notFound('Banner 不存在');
  await softDeleteBanner(id);
};

// ========== 服务类型（基于 configs 表的 DISPATCH 类目实现） ==========

export const getServiceTypes = async () => {
  return [
    { code: 'DELIVER', name: '帮送', enabled: true },
    { code: 'PICKUP', name: '帮取', enabled: true },
    { code: 'BUY', name: '帮买', enabled: true },
    { code: 'ERRAND', name: '代办', enabled: true, requiresReview: true },
  ];
};
