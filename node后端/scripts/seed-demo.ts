import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { databaseConfig } from '../src/config/database';

const DEMO_FILE = path.resolve(__dirname, '../sql/demo-data.sql');

const stripComments = (sql: string): string =>
  sql
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('--');
    })
    .join('\n');

const main = async (): Promise<void> => {
  if (!fs.existsSync(DEMO_FILE)) {
    console.error('❌ 找不到 demo-data.sql');
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
    const raw = fs.readFileSync(DEMO_FILE, 'utf8');
    const sql = stripComments(raw);
    const statements = sql
      .split(/;\s*(?=\n|$)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    console.log(`📂 执行 demo-data.sql（${statements.length} 条语句）`);
    for (const stmt of statements) {
      await conn.query(stmt);
    }
    console.log('✅ 演示数据导入完成');
    console.log('   - 3 个商家 / 3 个门店（北京东城区）');
    console.log('   - 15 个商品 / 20 个 SKU');
  } finally {
    await conn.end();
  }
};

main().catch((err) => {
  console.error('❌ 导入失败:', err);
  process.exit(1);
});
