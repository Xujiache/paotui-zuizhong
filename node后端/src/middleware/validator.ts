import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AppError } from '../utils/AppError';

export interface ValidationSchema {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  headers?: Joi.ObjectSchema;
}

const runValidation = (
  source: 'body' | 'query' | 'params' | 'headers',
  schema: Joi.ObjectSchema,
  target: unknown,
): { value: unknown; errors: Array<{ field: string; message: string }> } => {
  const { error, value } = schema.validate(target, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });
  if (!error) return { value, errors: [] };
  const errors = error.details.map((d) => ({
    field: `${source}.${d.path.join('.')}`,
    message: d.message,
  }));
  return { value, errors };
};

export const validate = (schema: ValidationSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const allErrors: Array<{ field: string; message: string }> = [];

    if (schema.body) {
      const { value, errors } = runValidation('body', schema.body, req.body);
      if (errors.length) allErrors.push(...errors);
      else req.body = value;
    }
    if (schema.query) {
      const { value, errors } = runValidation('query', schema.query, req.query);
      if (errors.length) allErrors.push(...errors);
      else Object.assign(req.query, value);
    }
    if (schema.params) {
      const { value, errors } = runValidation('params', schema.params, req.params);
      if (errors.length) allErrors.push(...errors);
      else req.params = value as Record<string, string>;
    }
    if (schema.headers) {
      const { errors } = runValidation('headers', schema.headers, req.headers);
      if (errors.length) allErrors.push(...errors);
    }

    if (allErrors.length > 0) {
      return next(AppError.paramInvalid('参数校验失败', allErrors));
    }
    next();
  };
};

export const phoneSchema = Joi.string()
  .pattern(/^1[3-9]\d{9}$/)
  .messages({
    'string.pattern.base': '手机号格式不正确',
    'string.empty': '手机号不能为空',
    'any.required': '手机号不能为空',
  });

export const smsCodeSchema = Joi.string()
  .pattern(/^\d{4,6}$/)
  .messages({
    'string.pattern.base': '验证码格式不正确',
    'string.empty': '验证码不能为空',
    'any.required': '验证码不能为空',
  });

export const passwordSchema = Joi.string().min(6).max(32).messages({
  'string.min': '密码至少6位',
  'string.max': '密码最长32位',
  'string.empty': '密码不能为空',
  'any.required': '密码不能为空',
});
