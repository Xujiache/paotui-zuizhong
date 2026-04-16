import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { databaseConfig } from '../src/config/database';

const MIGRATIONS_DIR = path.resolve(__dirname, '../sql/migrations');

const stripComments = (sql: string): string =>
  sql
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('--');
    })
    .join('\n');

const main = async (): Promise<void> => {
  const target = process.argv[2];
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.warn(`无迁移目录: ${MIGRATIONS_DIR}`);
    return;
  }
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const toRun = target
    ? files.filter((f) => f === target || f.startsWith(target))
    : files;

  if (toRun.length === 0) {
    console.warn(`找不到迁移文件: ${target || '(空)'}`);
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host: databaseConfig.host,
    port: databaseConfig.port,
    user: databaseConfig.user,
    password: databaseConfig.password,
    database: databaseConfig.database,
    multipleStatements: true,
  });

  try {
    for (const f of toRun) {
      const raw = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
      const sql = stripComments(raw);
      const statements = sql
        .split(/;\s*(?=\n|$)/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      console.log(`📂 ${f}（${statements.length} 条）`);
      for (const stmt of statements) {
        await conn.query(stmt);
      }
      console.log(`✅ ${f} 完成`);
    }
  } finally {
    await conn.end();
  }
};

main().catch((err) => {
  console.error('❌ 迁移失败:', err);
  process.exit(1);
});
