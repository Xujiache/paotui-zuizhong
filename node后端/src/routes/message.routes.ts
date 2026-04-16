import { Router } from 'express';
import Joi from 'joi';
import { tokenAuth } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { paginate } from '../middleware/pagination';
import { asyncHandler } from '../middleware/errorHandler';
import { success, paginated } from '../middleware/responseFormatter';
import * as messageService from '../services/message.service';

const router = Router();

const idParam = Joi.object({ id: Joi.number().integer().positive().required() });

const targetTypeFromRole = (role: string): string =>
  role === 'USER'
    ? 'USER'
    : role === 'MERCHANT'
      ? 'MERCHANT'
      : role === 'RIDER'
        ? 'RIDER'
        : 'ADMIN';

router.get(
  '/messages',
  tokenAuth(),
  paginate(),
  validate({
    query: Joi.object({
      type: Joi.string().optional(),
      page: Joi.number().integer().optional(),
      pageSize: Joi.number().integer().optional(),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.pagination!;
    const targetType = targetTypeFromRole(String(req.user!.role));
    const data = await messageService.getMessages(
      targetType,
      req.user!.userId,
      req.query.type as string | undefined,
      page,
      pageSize,
    );
    paginated(res, data);
  }),
);

router.get(
  '/unread-count',
  tokenAuth(),
  asyncHandler(async (req, res) => {
    const targetType = targetTypeFromRole(String(req.user!.role));
    const data = await messageService.getUnreadCount(targetType, req.user!.userId);
    success(res, data);
  }),
);

router.patch(
  '/messages/read-all',
  tokenAuth(),
  asyncHandler(async (req, res) => {
    const targetType = targetTypeFromRole(String(req.user!.role));
    await messageService.markAllAsRead(targetType, req.user!.userId);
    success(res, null, '全部已读');
  }),
);

router.patch(
  '/messages/:id/read',
  tokenAuth(),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const targetType = targetTypeFromRole(String(req.user!.role));
    await messageService.markRead(
      Number(req.params.id),
      targetType,
      req.user!.userId,
    );
    success(res, null, '已读');
  }),
);

router.delete(
  '/messages/:id',
  tokenAuth(),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const targetType = targetTypeFromRole(String(req.user!.role));
    await messageService.deleteMessage(
      Number(req.params.id),
      targetType,
      req.user!.userId,
    );
    success(res, null, '已删除');
  }),
);

// 内部发送消息（首期开放给 admin 触发用，服务间调用时走 messageService.sendMessage）
router.post(
  '/send',
  tokenAuth(),
  validate({
    body: Joi.object({
      targetType: Joi.string().valid('USER', 'MERCHANT', 'RIDER', 'ADMIN').required(),
      targetId: Joi.number().integer().positive().required(),
      type: Joi.string().required(),
      title: Joi.string().required(),
      content: Joi.string().required(),
      extra: Joi.object().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await messageService.sendMessage(req.body);
    success(res, data);
  }),
);

export default router;
