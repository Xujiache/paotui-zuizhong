import http from 'http';
import app from './app';
import config from './config';
import logger from './utils/logger';
import { testConnection, closePool } from './utils/database';
import { connectRedis, disconnectRedis } from './utils/redis';
import { setupWebSocket, closeWebSocket } from './websocket';
import { startTasks, stopTasks } from './tasks';

let httpServer: http.Server | null = null;

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

    httpServer = http.createServer(app);
    setupWebSocket(httpServer, '/ws');

    httpServer.listen(config.server.port, () => {
      const base = `http://localhost:${config.server.port}`;
      logger.info(`服务器已启动，端口 ${config.server.port} (${config.server.env}模式)`);
      logger.info(`  健康检查: ${base}/api/v1/common/health`);
      logger.info(`  公共接口: ${base}/api/v1/common/*`);
      logger.info(`  认证接口: ${base}/api/v1/auth/*`);
      logger.info(`  WebSocket: ws://localhost:${config.server.port}/ws?token=<JWT>`);
    });

    // 定时任务必须在 DB / Redis / WS 全部就绪后启动
    startTasks();
  } catch (error) {
    const err = error as Error;
    logger.error(`服务器启动失败: ${err.message}`);
    logger.error(err.stack || '');
    process.exit(1);
  }
};

const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`收到 ${signal} 信号，开始优雅关闭...`);
  try {
    stopTasks();
    await closeWebSocket();
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer!.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info('HTTP服务已关闭');
    }
    await disconnectRedis();
    await closePool();
    logger.info('资源清理完成');
    process.exit(0);
  } catch (error) {
    const err = error as Error;
    logger.error(`优雅关闭失败: ${err.message}`);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('uncaughtException', (err: Error) => {
  logger.error(`未捕获的异常: ${err.message}`);
  logger.error(err.stack || '');
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error(`未处理的Promise拒绝: ${reason}`);
});

startServer();
