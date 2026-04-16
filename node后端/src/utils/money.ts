/**
 * 金额单位转换工具
 *
 * 规约（对齐 PRD《业务服务开发任务.md》金额单位约定）：
 * - 接口传输和前端展示单位：整数分（如 5800 表示 58.00 元）
 * - 数据库 schema 保留 DECIMAL(10,2)（阶段02既有结构不破坏），model 层读出为元
 * - Service 层统一以"元"做内部计算 → Controller 输出"分"，入参"分" → Service 转元
 */

const safeNumber = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** 元 → 分（保留两位，避免浮点误差） */
export const yuanToFen = (yuan: number | string | null | undefined): number => {
  const n = safeNumber(yuan);
  return Math.round(n * 100);
};

/** 分 → 元（保留两位小数精度） */
export const fenToYuan = (fen: number | string | null | undefined): number => {
  const n = safeNumber(fen);
  return Math.round(n) / 100;
};

/** 数据库 DECIMAL 读出后（可能是 string/number）统一成 number(元) */
export const readDecimal = (value: number | string | null | undefined): number =>
  safeNumber(value);

/** 字段批量转换：把对象里指定的"元字段"转成"分字段" */
export const mapYuanFieldsToFen = <T extends Record<string, unknown>>(
  obj: T,
  fields: Array<keyof T>,
): T => {
  const clone: Record<string, unknown> = { ...obj };
  for (const f of fields) {
    clone[f as string] = yuanToFen(obj[f] as number | string | null | undefined);
  }
  return clone as T;
};

/** 确保金额非负 */
export const clampMoney = (fen: number): number => (fen < 0 ? 0 : Math.round(fen));
