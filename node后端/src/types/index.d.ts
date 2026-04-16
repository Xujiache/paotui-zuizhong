import { Request } from 'express';
import { UserRole, ClientType } from './enums';

export interface JwtPayload {
  userId: number;
  role: UserRole | string;
  clientType?: ClientType | string;
  iat?: number;
  exp?: number;
}

export interface AuthUser extends JwtPayload {
  userId: number;
  role: UserRole | string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  pagination?: PaginationParams;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  offset: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResult<T> {
  list: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T | null;
}

export interface ApiErrorResponse extends ApiResponse {
  errors?: Array<{
    field: string;
    message: string;
  }>;
}
