import { execute } from '../utils/database';

export interface WriteAuditLogParams {
  operatorId: number;
  operatorType: string;
  operatorName?: string;
  action: string;
  module: string;
  targetType?: string;
  targetId?: number | null;
  detail?: Record<string, unknown> | null;
  ip?: string;
  userAgent?: string;
}

export const writeAuditLog = async (params: WriteAuditLogParams): Promise<void> => {
  await execute(
    `INSERT INTO audit_logs
      (operator_id, operator_type, operator_name, action, module, target_type, target_id, detail, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.operatorId,
      params.operatorType,
      params.operatorName ?? '',
      params.action,
      params.module,
      params.targetType ?? '',
      params.targetId ?? null,
      params.detail ? JSON.stringify(params.detail) : null,
      params.ip ?? '',
      params.userAgent ?? '',
    ],
  );
};
