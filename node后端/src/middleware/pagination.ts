import { Request, Response, NextFunction } from 'express';
import { parsePagination } from '../utils/pagination';

export const paginate = () => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.pagination = parsePagination(req.query as Record<string, unknown>);
    next();
  };
};
