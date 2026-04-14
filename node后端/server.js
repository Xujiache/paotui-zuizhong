const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { testConnection } = require('./utils/db');
const { connectRedis } = require('./utils/redis');
const { checkAndReleasePort } = require('./utils/portCheck');

// 启动服务器
const startServer = async () => {
  try {
    // 检查端口
    const portAvailable = await checkAndReleasePort(config.server.port);
    if (!portAvailable) {
      logger.error(`无法释放端口 ${config.server.port}，服务器启动失败`);
      process.exit(1);
    }

    // 测试数据库连接
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.error('数据库连接失败，服务器启动失败');
      process.exit(1);
    }

    // 连接Redis
    const redisConnected = await connectRedis();
    if (!redisConnected) {
      logger.error('Redis连接失败，服务器启动失败');
      process.exit(1);
    }

    // 启动HTTP服务器
    app.listen(config.server.port, () => {
      logger.info(`服务器在端口 ${config.server.port} 上启动成功 (${config.server.env}模式)`);
      logger.info(`这个是你的API接口地址: http://localhost:${config.server.port}`);
    });
  } catch (error) {
    logger.error(`服务器启动失败: ${error.message}`);
    process.exit(1);
  }
};

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
  logger.error(`未捕获的异常: ${err.message}`);
  logger.error(err.stack);
  process.exit(1);
});

// 处理未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的Promise拒绝:', reason);
  // 应用程序继续运行
});

// 启动服务器
startServer(); 