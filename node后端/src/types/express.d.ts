import { AuthUser, PaginationParams } from './index';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      pagination?: PaginationParams;
      requestId?: string;
      startTime?: number;
    }
  }
}

export {};
