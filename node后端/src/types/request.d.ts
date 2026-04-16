import { SmsScene, ClientType } from './enums';

export interface WxLoginRequest {
  code: string;
  encryptedData?: string;
  iv?: string;
}

export interface BindPhoneRequest {
  phone: string;
  code: string;
}

export interface UpdateUserProfileRequest {
  nickname?: string;
  avatar?: string;
  gender?: number;
}

export interface SendSmsCodeRequest {
  phone: string;
  scene: SmsScene | string;
}

export interface MerchantRegisterRequest {
  phone: string;
  code: string;
  password: string;
  name: string;
  contactName: string;
}

export interface MerchantCodeLoginRequest {
  phone: string;
  code: string;
}

export interface MerchantPwdLoginRequest {
  phone: string;
  password: string;
}

export interface RiderRegisterRequest {
  phone: string;
  code: string;
  password: string;
  name: string;
}

export interface RiderCodeLoginRequest {
  phone: string;
  code: string;
}

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ClientMeta {
  clientType?: ClientType | string;
  clientVersion?: string;
  requestId?: string;
}
