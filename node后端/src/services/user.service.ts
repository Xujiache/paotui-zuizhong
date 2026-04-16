import { AppError } from '../utils/AppError';
import { ErrorCode } from '../types/enums';
import {
  listUserAddresses,
  findUserAddressById,
  countUserAddresses,
  createUserAddress,
  updateUserAddress,
  softDeleteUserAddress,
  setDefaultAddress,
  UserAddressRow,
  CreateUserAddressParams,
  UpdateUserAddressParams,
} from '../models/userAddress.model';
import {
  addFavorite,
  removeFavorite,
  listFavorites,
  FavoriteTargetType,
  UserFavoriteRow,
} from '../models/userFavorite.model';
import {
  recordView,
  listViewHistory,
  clearViewHistory,
  ViewTargetType,
  ViewHistoryRow,
} from '../models/userViewHistory.model';
import { findUserById, updateUserProfile, UpdateUserProfileParams } from '../models/user.model';
import { isValidLatLng } from '../utils/geo';
import { readDecimal } from '../utils/money';
import { maskPhone } from '../utils/helpers';

const MAX_ADDRESSES = 50;

const formatAddress = (row: UserAddressRow) => ({
  id: row.id,
  contactName: row.contact_name,
  contactPhone: row.contact_phone,
  province: row.province,
  city: row.city,
  district: row.district,
  address: row.address,
  houseNumber: row.house_number,
  lat: readDecimal(row.lat),
  lng: readDecimal(row.lng),
  tag: row.tag,
  isDefault: row.is_default === 1,
});

// ===================== 地址 =====================

export const getUserAddresses = async (userId: number) => {
  const rows = await listUserAddresses(userId);
  return rows.map(formatAddress);
};

export const addUserAddress = async (
  userId: number,
  params: Omit<CreateUserAddressParams, 'userId'>,
) => {
  if (!isValidLatLng(params.lat, params.lng)) {
    throw AppError.paramInvalid('经纬度不合法', [
      { field: 'body.lat/lng', message: '经纬度超出有效范围' },
    ]);
  }
  const count = await countUserAddresses(userId);
  if (count >= MAX_ADDRESSES) {
    throw new AppError(ErrorCode.USER_ADDRESS_LIMIT, `地址数量已达上限（${MAX_ADDRESSES}）`, 400);
  }
  const id = await createUserAddress({ userId, ...params });
  const row = await findUserAddressById(id);
  return formatAddress(row!);
};

const ensureOwnedAddress = async (
  userId: number,
  id: number,
): Promise<UserAddressRow> => {
  const row = await findUserAddressById(id);
  if (!row) throw new AppError(ErrorCode.USER_ADDRESS_NOT_FOUND, '地址不存在', 404);
  if (row.user_id !== userId) {
    throw new AppError(ErrorCode.USER_ADDRESS_FORBIDDEN, '不能操作他人地址', 403);
  }
  return row;
};

export const modifyUserAddress = async (
  userId: number,
  id: number,
  params: UpdateUserAddressParams,
) => {
  await ensureOwnedAddress(userId, id);
  if (params.lat !== undefined || params.lng !== undefined) {
    const lat = params.lat ?? 0;
    const lng = params.lng ?? 0;
    if (!isValidLatLng(lat, lng)) {
      throw AppError.paramInvalid('经纬度不合法');
    }
  }
  await updateUserAddress(id, params);
  const row = await findUserAddressById(id);
  return formatAddress(row!);
};

export const removeUserAddress = async (userId: number, id: number): Promise<void> => {
  await ensureOwnedAddress(userId, id);
  await softDeleteUserAddress(id);
};

export const setUserDefaultAddress = async (userId: number, id: number): Promise<void> => {
  await ensureOwnedAddress(userId, id);
  await setDefaultAddress(userId, id);
};

// ===================== 收藏 =====================

const formatFavorite = (row: UserFavoriteRow) => ({
  id: row.id,
  targetType: row.target_type,
  targetId: row.target_id,
  createdAt: row.created_at,
});

export const getUserFavorites = async (
  userId: number,
  targetType: FavoriteTargetType | undefined,
  page: number,
  pageSize: number,
) => {
  const { list, total } = await listFavorites(userId, targetType, page, pageSize);
  return {
    list: list.map(formatFavorite),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const addUserFavorite = async (
  userId: number,
  targetType: FavoriteTargetType,
  targetId: number,
) => {
  const id = await addFavorite(userId, targetType, targetId);
  return { id, targetType, targetId };
};

export const removeUserFavorite = async (userId: number, id: number): Promise<void> => {
  await removeFavorite(userId, id);
};

// ===================== 浏览历史 =====================

const formatViewHistory = (row: ViewHistoryRow) => ({
  id: row.id,
  targetType: row.target_type,
  targetId: row.target_id,
  viewedAt: row.viewed_at,
});

export const getUserViewHistory = async (
  userId: number,
  targetType: ViewTargetType | undefined,
  page: number,
  pageSize: number,
) => {
  const { list, total } = await listViewHistory(userId, targetType, page, pageSize);
  return {
    list: list.map(formatViewHistory),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const logUserView = async (
  userId: number,
  targetType: ViewTargetType,
  targetId: number,
): Promise<void> => {
  await recordView(userId, targetType, targetId);
};

export const clearUserViewHistory = async (userId: number): Promise<void> => {
  await clearViewHistory(userId);
};

// ===================== 资料 =====================

export const getUserProfile = async (userId: number) => {
  const row = await findUserById(userId);
  if (!row) throw AppError.notFound('用户不存在');
  return {
    id: row.id,
    nickname: row.nickname,
    avatar: row.avatar,
    phone: row.phone ? maskPhone(row.phone) : null,
    gender: row.gender,
  };
};

export const updateUserProfileData = async (
  userId: number,
  params: UpdateUserProfileParams,
) => {
  await updateUserProfile(userId, params);
  return getUserProfile(userId);
};
