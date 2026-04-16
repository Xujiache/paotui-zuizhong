import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, DEFAULT_SORT_ORDER } from '../config/constants';
import { PaginationParams, PaginationResult } from '../types';

export const parsePagination = (query: Record<string, unknown>): PaginationParams => {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
  const rawPageSize = parseInt(String(query.pageSize ?? DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(1, rawPageSize), MAX_PAGE_SIZE);
  const sortBy = (query.sortBy as string) || 'created_at';
  const sortOrder: 'asc' | 'desc' =
    typeof query.sortOrder === 'string' && query.sortOrder.toLowerCase() === 'asc'
      ? 'asc'
      : DEFAULT_SORT_ORDER;
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset, sortBy, sortOrder };
};

export const calcOffset = (page: number, pageSize: number): number => (page - 1) * pageSize;

export const calcTotalPages = (total: number, pageSize: number): number =>
  Math.ceil(total / pageSize);

export const wrapPagination = <T>(
  list: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginationResult<T> => ({
  list,
  pagination: {
    page,
    pageSize,
    total,
    totalPages: calcTotalPages(total, pageSize),
  },
});
