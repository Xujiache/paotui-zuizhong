/**
 * 数据库表初始化索引文件
 * 集中管理所有表的初始化
 */
const logger = require('../../utils/logger');
const { createUsersTable } = require('./users');
const { createRolesTable } = require('./roles');
// 后续可以继续导入更多表的初始化函数

/**
 * 初始化所有数据库表
 * @param {mysql.Connection} connection - MySQL连接实例
 * @returns {Promise<boolean>} - 是否成功
 */
const initAllTables = async (connection) => {
  try {
    logger.info('开始初始化所有数据库表...');
    
    // 按照依赖关系顺序初始化表
    // 例如：角色表需要先于用户表创建，因为用户表可能引用角色表的外键
    await createRolesTable(connection);
    await createUsersTable(connection);
    // 后续可以继续添加更多表的初始化
    
    logger.info('所有数据库表初始化完成');
    return true;
  } catch (error) {
    logger.error(`数据库表初始化失败: ${error.message}`);
    return false;
  }
};

module.exports = {
  initAllTables
}; 