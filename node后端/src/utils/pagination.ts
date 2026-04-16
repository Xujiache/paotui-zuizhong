import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, DEFAULT_SORT_ORDER } from '../config/constants';
import { PaginationParams } from '../types';

export const parsePagination = (query: Record<string, unknown>): PaginationParams => {
  const page = Math.max(1, parseInt(String(query.page || '1'), 10));
  const rawPageSize = parseInt(String(query.pageSize || DEFAULT_PAGE_SIZE), 10);
  const pageSize = Math.min(Math.max(1, rawPageSize), MAX_PAGE_SIZE);
  const sortBy = (query.sortBy as string) || 'created_at';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : DEFAULT_SORT_ORDER;

  return { page, pageSize, sortBy, sortOrder };
};

export const calcOffset = (page: number, pageSize: number): number => {
  return (page - 1) * pageSize;
};

export const calcTotalPages = (total: number, pageSize: number): number => {
  return Math.ceil(total / pageSize);
};
