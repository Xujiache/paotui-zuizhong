import config from '../config';
import { signTokenPair, verifyRefreshToken } from '../utils/jwt';
import { redis } from '../utils/redis';
import { AppError } from '../utils/AppError';
import { ErrorCode, UserRole, AccountStatus } from '../types/enums';
import {
  findUserByOpenid,
  findUserByPhone,
  createUser,
  updateUserLoginInfo,
  updateUserPhone,
  updateUserProfile,
  findUserById,
  UpdateUserProfileParams,
} from '../models/user.model';
import {
  findMerchantByPhone,
  createMerchant,
  updateMerchantLoginAt,
  findMerchantById,
} from '../models/merchant.model';
import {
  findRiderByPhone,
  createRider,
  findRiderById,
} from '../models/rider.model';
import { findAdminByUsername, updateAdminLogin, findAdminById } from '../models/admin.model';
import { findRoleById, findPermissionsByRoleId } from '../models/role.model';
import { hashPassword, comparePassword } from '../utils/crypto';
import { verifySmsCode } from './sms.service';
import { code2Session } from './wx.service';
import { writeAuditLog } from '../models/auditLog.model';
import { SUPER_ADMIN_ROLE_CODE } from '../config/constants';
import {
  WxLoginResponseData,
  MerchantLoginResponseData,
  RiderLoginResponseData,
  AdminLoginResponseData,
  LoginTokenData,
  UserInfoData,
} from '../types/response';
import { maskPhone } from '../utils/helpers';

const issueTokens = async (
  role: UserRole,
  userId: number,
  clientType?: string,
): Promise<LoginTokenData> => {
  const pair = signTokenPair({ userId, role, clientType });
  await redis.setAccessToken(role, userId, pair.accessToken, config.jwt.accessExpiresSeconds);
  await redis.setRefreshToken(role, userId, pair.refreshToken, config.jwt.refreshExpiresSeconds);
  return {
    accessToken: pair.accessToken,
    refreshToken: pair.refreshToken,
    expiresIn: pair.expiresIn,
  };
};

export const wxLogin = async (
  code: string,
  clientType?: string,
): Promise<WxLoginResponseData> => {
  const session = await code2Session(code);
  if (!session.openid) {
    throw new AppError(ErrorCode.USER_WX_AUTH_FAILED, '微信授权失败', 400);
  }

  let user = await findUserByOpenid(session.openid);
  let isNewUser = false;
  if (!user) {
    const userId = await createUser({
      openid: session.openid,
      unionid: session.unionid ?? null,
      wxSessionKey: session.sessionKey,
    });
    user = await findUserById(userId);
    isNewUser = true;
  } else {
    await updateUserLoginInfo(user.id, session.sessionKey);
  }

  if (!user) {
    throw new AppError(ErrorCode.SERVER_ERROR, '用户信息获取失败', 500);
  }

  const tokens = await issueTokens(UserRole.USER, user.id, clientType);

  const userInfo: UserInfoData = {
    id: user.id,
    nickname: user.nickname,
    avatar: user.avatar,
    phone: user.phone ? maskPhone(user.phone) : null,
    gender: user.gender,
  };

  return {
    ...tokens,
    isNewUser,
    hasPhone: !!user.phone,
    userInfo,
  };
};

export const bindUserPhone = async (
  userId: number,
  phone: string,
  code: string,
): Promise<{ phone: string }> => {
  await verifySmsCode(phone, code);

  const existing = await findUserByPhone(phone);
  if (existing && existing.id !== userId) {
    throw new AppError(ErrorCode.USER_PHONE_ALREADY_BOUND, '手机号已被其他账号绑定', 409);
  }

  await updateUserPhone(userId, phone);
  return { phone: maskPhone(phone) };
};

export const updateUser = async (
  userId: number,
  params: UpdateUserProfileParams,
): Promise<UserInfoData> => {
  await updateUserProfile(userId, params);
  const user = await findUserById(userId);
  if (!user) throw AppError.notFound('用户不存在');
  return {
    id: user.id,
    nickname: user.nickname,
    avatar: user.avatar,
    phone: user.phone ? maskPhone(user.phone) : null,
    gender: user.gender,
  };
};

export interface MerchantRegisterParams {
  phone: string;
  code: string;
  password: string;
  name: string;
  contactName: string;
}

export const merchantRegister = async (
  params: MerchantRegisterParams,
  clientType?: string,
): Promise<MerchantLoginResponseData> => {
  await verifySmsCode(params.phone, params.code);

  const existing = await findMerchantByPhone(params.phone);
  if (existing) {
    throw new AppError(ErrorCode.MERCHANT_PHONE_REGISTERED, '手机号已注册', 409);
  }

  const passwordHash = await hashPassword(params.password);
  const merchantId = await createMerchant({
    name: params.name,
    contactName: params.contactName,
    contactPhone: params.phone,
    passwordHash,
  });

  const merchant = await findMerchantById(merchantId);
  if (!merchant) throw AppError.serverError('商家创建失败');

  const tokens = await issueTokens(UserRole.MERCHANT, merchant.id, clientType);

  return {
    ...tokens,
    merchantInfo: {
      id: merchant.id,
      name: merchant.name,
      contactName: merchant.contact_name,
      contactPhone: maskPhone(merchant.contact_phone),
      status: merchant.status,
      auditStatus: merchant.audit_status,
      balance: Number(merchant.balance),
    },
  };
};

export const merchantLoginByCode = async (
  phone: string,
  code: string,
  clientType?: string,
): Promise<MerchantLoginResponseData> => {
  await verifySmsCode(phone, code);

  const merchant = await findMerchantByPhone(phone);
  if (!merchant) {
    throw new AppError(ErrorCode.MERCHANT_NOT_FOUND, '商家账号不存在', 404);
  }
  if (merchant.status === AccountStatus.FROZEN) {
    throw new AppError(ErrorCode.MERCHANT_FROZEN, '商家账号已冻结', 403);
  }

  await updateMerchantLoginAt(merchant.id);
  const tokens = await issueTokens(UserRole.MERCHANT, merchant.id, clientType);

  return {
    ...tokens,
    merchantInfo: {
      id: merchant.id,
      name: merchant.name,
      contactName: merchant.contact_name,
      contactPhone: maskPhone(merchant.contact_phone),
      status: merchant.status,
      auditStatus: merchant.audit_status,
      balance: Number(merchant.balance),
    },
  };
};

export const merchantLoginByPassword = async (
  phone: string,
  password: string,
  clientType?: string,
): Promise<MerchantLoginResponseData> => {
  const merchant = await findMerchantByPhone(phone);
  if (!merchant) {
    throw new AppError(ErrorCode.MERCHANT_NOT_FOUND, '商家账号不存在', 404);
  }
  if (merchant.status === AccountStatus.FROZEN) {
    throw new AppError(ErrorCode.MERCHANT_FROZEN, '商家账号已冻结', 403);
  }

  const match = await comparePassword(password, merchant.password_hash);
  if (!match) {
    throw new AppError(ErrorCode.MERCHANT_PASSWORD_ERROR, '密码错误', 401);
  }

  await updateMerchantLoginAt(merchant.id);
  const tokens = await issueTokens(UserRole.MERCHANT, merchant.id, clientType);

  return {
    ...tokens,
    merchantInfo: {
      id: merchant.id,
      name: merchant.name,
      contactName: merchant.contact_name,
      contactPhone: maskPhone(merchant.contact_phone),
      status: merchant.status,
      auditStatus: merchant.audit_status,
      balance: Number(merchant.balance),
    },
  };
};

export interface RiderRegisterParams {
  phone: string;
  code: string;
  password: string;
  name: string;
}

export const riderRegister = async (
  params: RiderRegisterParams,
  clientType?: string,
): Promise<RiderLoginResponseData> => {
  await verifySmsCode(params.phone, params.code);

  const existing = await findRiderByPhone(params.phone);
  if (existing) {
    throw new AppError(ErrorCode.RIDER_PHONE_REGISTERED, '手机号已注册', 409);
  }

  const passwordHash = await hashPassword(params.password);
  const riderId = await createRider({
    phone: params.phone,
    name: params.name,
    passwordHash,
  });

  const rider = await findRiderById(riderId);
  if (!rider) throw AppError.serverError('骑手创建失败');

  const tokens = await issueTokens(UserRole.RIDER, rider.id, clientType);

  return {
    ...tokens,
    riderInfo: {
      id: rider.id,
      name: rider.name,
      phone: maskPhone(rider.phone),
      status: rider.status,
      auditStatus: rider.audit_status,
      onlineStatus: rider.online_status,
      balance: Number(rider.balance),
      rating: Number(rider.rating),
    },
  };
};

export const riderLoginByCode = async (
  phone: string,
  code: string,
  clientType?: string,
): Promise<RiderLoginResponseData> => {
  await verifySmsCode(phone, code);

  const rider = await findRiderByPhone(phone);
  if (!rider) {
    throw new AppError(ErrorCode.RIDER_NOT_FOUND, '骑手账号不存在', 404);
  }
  if (rider.status === AccountStatus.FROZEN) {
    throw new AppError(ErrorCode.RIDER_FROZEN, '骑手账号已冻结', 403);
  }

  const tokens = await issueTokens(UserRole.RIDER, rider.id, clientType);

  return {
    ...tokens,
    riderInfo: {
      id: rider.id,
      name: rider.name,
      phone: maskPhone(rider.phone),
      status: rider.status,
      auditStatus: rider.audit_status,
      onlineStatus: rider.online_status,
      balance: Number(rider.balance),
      rating: Number(rider.rating),
    },
  };
};

export const adminLogin = async (
  username: string,
  password: string,
  ip: string,
  userAgent: string,
  clientType?: string,
): Promise<AdminLoginResponseData> => {
  const admin = await findAdminByUsername(username);
  if (!admin) {
    throw new AppError(ErrorCode.DATA_NOT_FOUND, '账号不存在或密码错误', 401);
  }
  if (admin.status === AccountStatus.FROZEN) {
    throw new AppError(ErrorCode.ACCOUNT_FROZEN, '管理员账号已冻结', 403);
  }

  const match = await comparePassword(password, admin.password_hash);
  if (!match) {
    throw new AppError(ErrorCode.DATA_NOT_FOUND, '账号不存在或密码错误', 401);
  }

  await updateAdminLogin(admin.id, ip);
  const tokens = await issueTokens(UserRole.ADMIN, admin.id, clientType);

  const role = await findRoleById(admin.role_id);
  const roleCode = role?.code ?? '';
  const roleName = role?.name ?? '';
  const permissions =
    roleCode === SUPER_ADMIN_ROLE_CODE
      ? ['*']
      : await findPermissionsByRoleId(admin.role_id);

  await writeAuditLog({
    operatorId: admin.id,
    operatorType: 'ADMIN',
    operatorName: admin.username,
    action: 'LOGIN',
    module: 'AUTH',
    ip,
    userAgent,
    detail: { clientType, roleCode },
  });

  return {
    ...tokens,
    adminInfo: {
      id: admin.id,
      username: admin.username,
      realName: admin.real_name,
      avatar: admin.avatar,
      roleName,
      roleCode,
      permissions,
    },
  };
};

export const getAdminInfo = async (adminId: number): Promise<AdminLoginResponseData['adminInfo']> => {
  const admin = await findAdminById(adminId);
  if (!admin) throw AppError.notFound('管理员不存在');
  const role = await findRoleById(admin.role_id);
  const roleCode = role?.code ?? '';
  const roleName = role?.name ?? '';
  const permissions =
    roleCode === SUPER_ADMIN_ROLE_CODE
      ? ['*']
      : await findPermissionsByRoleId(admin.role_id);
  return {
    id: admin.id,
    username: admin.username,
    realName: admin.real_name,
    avatar: admin.avatar,
    roleName,
    roleCode,
    permissions,
  };
};

export const refreshTokens = async (refreshToken: string): Promise<LoginTokenData> => {
  const payload = verifyRefreshToken(refreshToken);
  if (!payload || !payload.userId || !payload.role) {
    throw AppError.tokenInvalid('Refresh Token无效或已过期');
  }

  if (await redis.isBlacklisted(refreshToken)) {
    throw AppError.tokenInvalid('Token已失效');
  }

  const stored = await redis.getRefreshToken(payload.role as string, payload.userId);
  if (!stored || stored !== refreshToken) {
    throw AppError.tokenInvalid('Refresh Token已失效');
  }

  const pair = signTokenPair({
    userId: payload.userId,
    role: payload.role,
    clientType: payload.clientType,
  });
  await redis.setAccessToken(
    payload.role as string,
    payload.userId,
    pair.accessToken,
    config.jwt.accessExpiresSeconds,
  );
  await redis.setRefreshToken(
    payload.role as string,
    payload.userId,
    pair.refreshToken,
    config.jwt.refreshExpiresSeconds,
  );
  await redis.addToBlacklist(refreshToken, config.jwt.refreshExpiresSeconds);

  return {
    accessToken: pair.accessToken,
    refreshToken: pair.refreshToken,
    expiresIn: pair.expiresIn,
  };
};

export const logout = async (
  token: string,
  payload: { userId: number; role: string },
): Promise<void> => {
  await redis.addToBlacklist(token, config.jwt.refreshExpiresSeconds);

  const storedAccess = await redis.getAccessToken(payload.role, payload.userId);
  if (storedAccess) {
    await redis.addToBlacklist(storedAccess, config.jwt.refreshExpiresSeconds);
  }
  const storedRefresh = await redis.getRefreshToken(payload.role, payload.userId);
  if (storedRefresh) {
    await redis.addToBlacklist(storedRefresh, config.jwt.refreshExpiresSeconds);
  }

  await redis.delUserTokens(payload.role, payload.userId);
};
