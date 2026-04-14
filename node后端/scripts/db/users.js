/**
 * 用户表初始化
 */
const logger = require('../../utils/logger');

/**
 * 创建用户表
 * @param {mysql.Connection} connection - MySQL连接实例
 * @returns {Promise<boolean>} - 是否成功
 */
const createUsersTable = async (connection) => {
  try {
    logger.info('开始创建用户表...');
    
    // 创建用户表SQL
    // 这里只是示例，实际开发时根据需求设计表结构
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE,
        mobile VARCHAR(20) UNIQUE,
        role_id INT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    
    await connection.query(createTableSQL);
    logger.info('用户表创建成功');
    return true;
  } catch (error) {
    logger.error(`用户表创建失败: ${error.message}`);
    throw error; // 向上抛出错误，让调用者处理
  }
};

module.exports = {
  createUsersTable
}; 