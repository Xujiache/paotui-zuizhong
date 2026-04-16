import { Request } from 'express';

export interface JwtPayload {
  id: number;
  type: 'mobile' | 'admin';
  role?: string;
  permissions?: Record<string, string[]>;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
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
  timestamp?: string;
}

export interface ApiErrorResponse extends ApiResponse {
  errors?: Array<{
    field: string;
    message: string;
  }>;
}
