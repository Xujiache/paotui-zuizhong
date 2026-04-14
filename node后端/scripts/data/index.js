/**
 * 测试数据初始化索引文件
 * 集中管理所有测试数据的初始化
 */
const logger = require('../../utils/logger');
const { initRolesData } = require('./roles');
const { initUsersData } = require('./users');
// 后续可以继续导入更多表的测试数据初始化函数

/**
 * 初始化所有测试数据
 * @param {Function} query - 数据库查询函数
 * @returns {Promise<boolean>} - 是否成功
 */
const initAllTestData = async (query) => {
  try {
    logger.info('开始初始化所有测试数据...');
    
    // 按照依赖关系顺序初始化测试数据
    // 例如：角色数据需要先于用户数据插入
    await initRolesData(query);
    await initUsersData(query);
    // 后续可以继续添加更多表的测试数据初始化
    
    logger.info('所有测试数据初始化完成');
    return true;
  } catch (error) {
    logger.error(`测试数据初始化失败: ${error.message}`);
    return false;
  }
};

module.exports = {
  initAllTestData
}; 