import { Response } from 'express';
import { ErrorCode } from '../types/enums';

export const success = (res: Response, data: unknown = null, message: string = '操作成功', statusCode: number = 200) => {
  return res.status(statusCode).json({
    code: ErrorCode.SUCCESS,
    message,
    data,
  });
};

export const error = (res: Response, message: string = '操作失败', statusCode: number = 400, code: number = ErrorCode.OPERATION_FAILED) => {
  return res.status(statusCode).json({
    code,
    message,
    data: null,
  });
};

export const paginate = (
  res: Response,
  list: unknown[],
  total: number,
  page: number,
  pageSize: number,
  message: string = '获取成功',
) => {
  return res.status(200).json({
    code: ErrorCode.SUCCESS,
    message,
    data: {
      list,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    },
  });
};
