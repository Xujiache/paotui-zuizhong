-- ============================================================
-- 同城O2O配送系统 - 种子数据
-- 说明：插入系统默认角色、超级管理员账号、基础配置项
-- 默认超管账号：admin / admin123
-- 生产环境请务必通过 npm run change-admin-password 或管理后台修改
-- ============================================================

SET NAMES utf8mb4;

-- ------------------------------------------------------------
-- 角色基础数据
-- ------------------------------------------------------------
INSERT INTO `roles` (`id`, `name`, `code`, `description`, `status`)
VALUES
  (1, '超级管理员', 'SUPER_ADMIN', '拥有系统全部权限', 'ACTIVE'),
  (2, '运营人员', 'OPERATOR', '负责日常运营：活动、内容、服务类型', 'ACTIVE'),
  (3, '审核人员', 'AUDITOR', '负责商家与骑手入驻审核', 'ACTIVE'),
  (4, '客服人员', 'CUSTOMER_SERVICE', '负责用户投诉与售后协同', 'ACTIVE'),
  (5, '财务人员', 'FINANCE', '负责结算、提现、对账', 'ACTIVE')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `description` = VALUES(`description`);

-- ------------------------------------------------------------
-- 角色-权限映射（示例：非超管按功能点授权）
-- SUPER_ADMIN 不落 role_permissions，在中间件直接放行
-- ------------------------------------------------------------
DELETE FROM `role_permissions` WHERE `role_id` IN (2, 3, 4, 5);

INSERT INTO `role_permissions` (`role_id`, `permission`) VALUES
  (2, 'banner:view'), (2, 'banner:edit'),
  (2, 'coupon:view'), (2, 'coupon:edit'),
  (2, 'config:view'),
  (3, 'merchant:view'), (3, 'merchant:audit'),
  (3, 'rider:view'), (3, 'rider:audit'),
  (4, 'order:view'),
  (4, 'aftersale:view'), (4, 'aftersale:handle'),
  (4, 'complaint:view'), (4, 'complaint:handle'),
  (5, 'settlement:view'), (5, 'settlement:export'),
  (5, 'withdrawal:view'), (5, 'withdrawal:audit');

-- ------------------------------------------------------------
-- 超级管理员账号
-- 密码哈希对应明文 admin123 (bcrypt 10 rounds)
-- 如需替换，请运行:
--   node -e "require('bcrypt').hash('你的密码', 10).then(h => console.log(h))"
-- ------------------------------------------------------------
INSERT INTO `admins` (
  `id`, `username`, `password_hash`, `real_name`, `phone`, `email`, `role_id`, `status`
) VALUES (
  1,
  'admin',
  '$2b$10$g5gJmJfBp6gOlPtBNvgm2uT4R8WK7WRSMcWNFPJqq7wQ1BaalauRC',
  '超级管理员',
  '',
  '',
  1,
  'ACTIVE'
) ON DUPLICATE KEY UPDATE `role_id` = VALUES(`role_id`), `status` = VALUES(`status`);

-- ------------------------------------------------------------
-- 基础系统配置项
-- ------------------------------------------------------------
INSERT INTO `configs` (`category`, `config_key`, `config_value`, `value_type`, `description`, `status`)
VALUES
  ('SYSTEM', 'platform_name', '同城O2O配送', 'STRING', '平台名称', 'ACTIVE'),
  ('SYSTEM', 'customer_service_phone', '400-000-0000', 'STRING', '客服电话', 'ACTIVE'),
  ('SYSTEM', 'pay_timeout_seconds', '900', 'NUMBER', '支付超时时间（秒）', 'ACTIVE'),
  ('SYSTEM', 'merchant_accept_timeout_seconds', '300', 'NUMBER', '商家接单超时时间（秒）', 'ACTIVE'),
  ('SYSTEM', 'auto_confirm_delivery_hours', '24', 'NUMBER', '自动确认收货小时数', 'ACTIVE'),
  ('DISPATCH', 'default_accept_radius', '5000', 'NUMBER', '骑手默认接单半径（米）', 'ACTIVE'),
  ('DISPATCH', 'expand_radius_step', '1000', 'NUMBER', '扩圈推送步长（米）', 'ACTIVE'),
  ('DISPATCH', 'max_expand_radius', '10000', 'NUMBER', '最大扩圈半径（米）', 'ACTIVE')
ON DUPLICATE KEY UPDATE `config_value` = VALUES(`config_value`), `description` = VALUES(`description`);

-- ------------------------------------------------------------
-- 基础区域（示例：顶级"全国"）
-- ------------------------------------------------------------
INSERT INTO `areas` (`id`, `parent_id`, `name`, `level`, `code`, `status`, `sort`)
VALUES (1, 0, '全国', 1, '100000', 'ACTIVE', 100)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
