import app from './app';
import config from './config';
import logger from './utils/logger';
import { testConnection } from './utils/database';
import { connectRedis } from './utils/redis';

const startServer = async (): Promise<void> => {
  try {
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.error('数据库连接失败，服务器无法启动');
      process.exit(1);
    }

    const redisConnected = await connectRedis();
    if (!redisConnected) {
      logger.error('Redis连接失败，服务器无法启动');
      process.exit(1);
    }

    app.listen(config.server.port, () => {
      logger.info(`服务器在端口 ${config.server.port} 上启动成功 (${config.server.env}模式)`);
      logger.info(`API地址: http://localhost:${config.server.port}`);
      logger.info(`健康检查: http://localhost:${config.server.port}/api/v1/health`);
    });
  } catch (error) {
    const err = error as Error;
    logger.error(`服务器启动失败: ${err.message}`);
    process.exit(1);
  }
};

process.on('uncaughtException', (err: Error) => {
  logger.error(`未捕获的异常: ${err.message}`);
  logger.error(err.stack || '');
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error(`未处理的Promise拒绝: ${reason}`);
});

startServer();
