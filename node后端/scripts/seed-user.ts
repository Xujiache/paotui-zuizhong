import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { databaseConfig } from '../src/config/database';

const FILE = path.resolve(__dirname, '../sql/demo-user.sql');

const stripComments = (sql: string): string =>
  sql
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('--');
    })
    .join('\n');

const main = async (): Promise<void> => {
  if (!fs.existsSync(FILE)) {
    console.error('❌ 找不到 demo-user.sql');
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
    const raw = fs.readFileSync(FILE, 'utf8');
    const sql = stripComments(raw);
    const statements = sql
      .split(/;\s*(?=\n|$)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    console.log(`📂 执行 demo-user.sql（${statements.length} 条语句）`);
    for (const stmt of statements) {
      await conn.query(stmt);
    }
    console.log('✅ 演示用户导入完成');
    console.log('   - 用户：张三（测试） id=7777, 手机 13800138888');
    console.log('   - 3 条地址（家/公司/朋友家）');
    console.log('   - 4 条购物车商品');
    console.log('   - 3 条订单（1 已完成 + 1 待支付 + 1 配送中跑腿）');
    console.log('');
    console.log('👉 在登录页点「微信一键登录」即可自动登入该账号');
  } finally {
    await conn.end();
  }
};

main().catch((err) => {
  console.error('❌ 导入失败:', err);
  process.exit(1);
});
