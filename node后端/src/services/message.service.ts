import { AppError } from '../utils/AppError';
import {
  insertMessage,
  listMessages,
  countUnread,
  markMessageRead,
  markAllRead,
  softDeleteMessage,
  findMessageById,
  CreateMessageParams,
  MessageRow,
} from '../models/message.model';

const parseJson = (v: unknown) => {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try {
    return typeof v === 'string' ? JSON.parse(v) : v;
  } catch {
    return v;
  }
};

const formatMessage = (row: MessageRow) => ({
  id: row.id,
  targetType: row.target_type,
  targetId: row.target_id,
  type: row.type,
  title: row.title,
  content: row.content,
  extra: parseJson(row.extra),
  isRead: row.is_read === 1,
  readAt: row.read_at,
  createdAt: row.created_at,
});

export const sendMessage = async (params: CreateMessageParams) => {
  const id = await insertMessage(params);
  return { id };
};

export const getMessages = async (
  targetType: string,
  targetId: number,
  type: string | undefined,
  page: number,
  pageSize: number,
) => {
  const { list, total } = await listMessages(targetType, targetId, type, page, pageSize);
  return {
    list: list.map(formatMessage),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const getUnreadCount = async (targetType: string, targetId: number) => {
  const total = await countUnread(targetType, targetId);
  return { unread: total };
};

export const markRead = async (
  id: number,
  targetType: string,
  targetId: number,
) => {
  const row = await findMessageById(id);
  if (!row || row.target_type !== targetType || row.target_id !== targetId) {
    throw AppError.notFound('消息不存在');
  }
  await markMessageRead(id, targetType, targetId);
};

export const markAllAsRead = async (targetType: string, targetId: number) => {
  await markAllRead(targetType, targetId);
};

export const deleteMessage = async (
  id: number,
  targetType: string,
  targetId: number,
) => {
  const row = await findMessageById(id);
  if (!row || row.target_type !== targetType || row.target_id !== targetId) {
    throw AppError.notFound('消息不存在');
  }
  await softDeleteMessage(id, targetType, targetId);
};

/** 后台群发（内部 fan-out） */
export const broadcast = async (params: {
  targetType: 'USER' | 'MERCHANT' | 'RIDER';
  targetIds: number[];
  type: string;
  title: string;
  content: string;
  extra?: Record<string, unknown>;
}) => {
  let ok = 0;
  for (const id of params.targetIds) {
    try {
      await insertMessage({
        targetType: params.targetType,
        targetId: id,
        type: params.type,
        title: params.title,
        content: params.content,
        extra: params.extra,
      });
      ok++;
    } catch {
      /* ignore */
    }
  }
  return { total: params.targetIds.length, ok };
};
