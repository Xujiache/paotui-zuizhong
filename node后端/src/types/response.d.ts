export interface LoginTokenData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserInfoData {
  id: number;
  nickname: string;
  avatar: string;
  phone: string | null;
  gender?: number;
}

export interface WxLoginResponseData extends LoginTokenData {
  isNewUser: boolean;
  hasPhone: boolean;
  userInfo: UserInfoData;
}

export interface MerchantInfoData {
  id: number;
  name: string;
  contactName: string;
  contactPhone: string;
  status: string;
  auditStatus: string;
  balance?: number;
}

export interface MerchantLoginResponseData extends LoginTokenData {
  merchantInfo: MerchantInfoData;
}

export interface RiderInfoData {
  id: number;
  name: string;
  phone: string;
  status: string;
  auditStatus: string;
  onlineStatus: string;
  balance?: number;
  rating?: number;
}

export interface RiderLoginResponseData extends LoginTokenData {
  riderInfo: RiderInfoData;
}

export interface AdminInfoData {
  id: number;
  username: string;
  realName: string;
  avatar: string;
  roleName: string;
  roleCode: string;
  permissions: string[];
}

export interface AdminLoginResponseData extends LoginTokenData {
  adminInfo: AdminInfoData;
}

export interface UploadResponseData {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}
