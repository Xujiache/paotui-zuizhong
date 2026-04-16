export const maskPhone = (phone: string): string => {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
};

export const maskIdCard = (idCard: string): string => {
  if (!idCard || idCard.length < 8) return idCard;
  return idCard.slice(0, 4) + '**********' + idCard.slice(-4);
};

export const maskName = (name: string): string => {
  if (!name) return name;
  if (name.length === 1) return name;
  if (name.length === 2) return name[0] + '*';
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
};

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const pickDefined = <T extends Record<string, unknown>>(obj: T): Partial<T> => {
  const result: Partial<T> = {};
  for (const key of Object.keys(obj) as Array<keyof T>) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
};

export const camelToSnake = (str: string): string =>
  str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

export const snakeToCamel = (str: string): string =>
  str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

export const toCamelCaseRow = <T extends Record<string, unknown>>(
  row: Record<string, unknown>,
): T => {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    result[snakeToCamel(key)] = row[key];
  }
  return result as T;
};

export const toCamelCaseRows = <T extends Record<string, unknown>>(
  rows: Record<string, unknown>[],
): T[] => rows.map((row) => toCamelCaseRow<T>(row));
