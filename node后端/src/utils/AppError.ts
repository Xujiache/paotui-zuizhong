import { ErrorCode, ErrorCodeHttpStatus } from '../types/enums';

export interface FieldError {
  field: string;
  message: string;
}

export class AppError extends Error {
  public readonly code: number;
  public readonly statusCode: number;
  public readonly errors?: FieldError[];
  public readonly expose: boolean;

  constructor(
    code: number,
    message?: string,
    statusCode?: number,
    errors?: FieldError[],
  ) {
    super(message || `业务异常 ${code}`);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode ?? ErrorCodeHttpStatus[code] ?? 400;
    this.errors = errors;
    this.expose = true;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static paramInvalid(message = '参数校验失败', errors?: FieldError[]): AppError {
    return new AppError(ErrorCode.PARAM_INVALID, message, 400, errors);
  }

  static notFound(message = '数据不存在'): AppError {
    return new AppError(ErrorCode.DATA_NOT_FOUND, message, 404);
  }

  static duplicate(message = '数据已存在'): AppError {
    return new AppError(ErrorCode.DATA_ALREADY_EXISTS, message, 409);
  }

  static unauthorized(message = '未登录或Token过期'): AppError {
    return new AppError(ErrorCode.NOT_LOGGED_IN, message, 401);
  }

  static tokenInvalid(message = 'Token无效'): AppError {
    return new AppError(ErrorCode.TOKEN_INVALID, message, 401);
  }

  static forbidden(message = '权限不足'): AppError {
    return new AppError(ErrorCode.PERMISSION_DENIED, message, 403);
  }

  static serverError(message = '服务器内部错误'): AppError {
    return new AppError(ErrorCode.SERVER_ERROR, message, 500);
  }
}
