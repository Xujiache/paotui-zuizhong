import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { databaseConfig } from '../src/config/database';

const SCHEMA_FILE = path.resolve(__dirname, '../sql/schema.sql');
const SEED_FILE = path.resolve(__dirname, '../sql/seed.sql');

const stripComments = (sql: string): string => {
  const lines = sql.split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--') || trimmed.length === 0) continue;
    kept.push(line);
  }
  return kept.join('\n');
};

const runSqlFile = async (
  conn: mysql.Connection,
  filePath: string,
  label: string,
): Promise<void> => {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  ${label} 文件不存在: ${filePath}`);
    return;
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const sql = stripComments(raw);
  const statements = sql
    .split(/;\s*(?=\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`📂 执行 ${label}，共 ${statements.length} 条语句...`);
  let executed = 0;
  for (const stmt of statements) {
    await conn.query(stmt);
    executed++;
  }
  console.log(`✅ ${label} 执行完成（${executed}条）`);
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const schemaOnly = args.includes('--schema-only');
  const seedOnly = args.includes('--seed-only');
  const skipCreate = args.includes('--skip-create');

  const rootConfig = {
    host: databaseConfig.host,
    port: databaseConfig.port,
    user: databaseConfig.user,
    password: databaseConfig.password,
    multipleStatements: true,
  };

  if (!skipCreate) {
    console.log(`🔌 连接 MySQL ${rootConfig.host}:${rootConfig.port} ...`);
    const bootstrap = await mysql.createConnection(rootConfig);
    try {
      await bootstrap.query(
        `CREATE DATABASE IF NOT EXISTS \`${databaseConfig.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`,
      );
      console.log(`✅ 数据库 \`${databaseConfig.database}\` 已就绪`);
    } finally {
      await bootstrap.end();
    }
  }

  const conn = await mysql.createConnection({
    ...rootConfig,
    database: databaseConfig.database,
    multipleStatements: true,
  });

  try {
    if (!seedOnly) {
      await runSqlFile(conn, SCHEMA_FILE, 'schema.sql（建表）');
    }
    if (!schemaOnly) {
      await runSqlFile(conn, SEED_FILE, 'seed.sql（种子数据）');
    }
    console.log('🎉 数据库初始化完成');
  } finally {
    await conn.end();
  }
};

main().catch((err) => {
  console.error('❌ 数据库初始化失败:', err);
  process.exit(1);
});
