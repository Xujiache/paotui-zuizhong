import bcrypt from 'bcrypt';
import { PASSWORD_SALT_ROUNDS } from '../src/config/constants';

const main = async (): Promise<void> => {
  const plain = process.argv[2];
  if (!plain) {
    console.error('用法: npm run gen:password -- <明文密码>');
    process.exit(1);
  }
  const hash = await bcrypt.hash(plain, PASSWORD_SALT_ROUNDS);
  console.log('明文密码:', plain);
  console.log('bcrypt哈希:', hash);
};

main().catch((err) => {
  console.error('❌ 生成密码哈希失败:', err);
  process.exit(1);
});
