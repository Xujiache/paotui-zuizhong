import { Response } from 'express';
import { ErrorCode } from '../types/enums';
import { PaginationResult } from '../types';

export const success = <T>(
  res: Response,
  data: T = null as unknown as T,
  message: string = 'success',
  statusCode: number = 200,
): Response => {
  return res.status(statusCode).json({
    code: ErrorCode.SUCCESS,
    message,
    data,
  });
};

export const paginated = <T>(
  res: Response,
  payload: PaginationResult<T>,
  message: string = 'success',
): Response => {
  return res.status(200).json({
    code: ErrorCode.SUCCESS,
    message,
    data: payload,
  });
};

export const fail = (
  res: Response,
  code: number = ErrorCode.OPERATION_FAILED,
  message: string = '操作失败',
  statusCode: number = 400,
  errors?: Array<{ field: string; message: string }>,
): Response => {
  const body: Record<string, unknown> = { code, message, data: null };
  if (errors && errors.length) body.errors = errors;
  return res.status(statusCode).json(body);
};
