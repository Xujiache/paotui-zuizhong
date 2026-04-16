-- ============================================================
-- 同城O2O配送系统 - 数据库建表脚本
-- 字符集: utf8mb4 / utf8mb4_general_ci
-- 引擎:   InnoDB
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 1. users 用户表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `phone` VARCHAR(20) DEFAULT NULL COMMENT '手机号',
  `nickname` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '昵称',
  `avatar` VARCHAR(512) NOT NULL DEFAULT '' COMMENT '头像URL',
  `gender` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0未知 1男 2女',
  `openid` VARCHAR(128) DEFAULT NULL COMMENT '微信openid',
  `unionid` VARCHAR(128) DEFAULT NULL COMMENT '微信unionid',
  `wx_session_key` VARCHAR(256) DEFAULT NULL COMMENT '微信session_key',
  `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE/FROZEN/CANCELLED',
  `last_login_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_openid` (`openid`),
  UNIQUE KEY `uk_users_phone` (`phone`),
  KEY `idx_users_unionid` (`unionid`),
  KEY `idx_users_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户表';

-- ------------------------------------------------------------
-- 2. user_addresses 用户地址表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `user_addresses`;
CREATE TABLE `user_addresses` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `contact_name` VARCHAR(32) NOT NULL,
  `contact_phone` VARCHAR(20) NOT NULL,
  `province` VARCHAR(32) NOT NULL,
  `city` VARCHAR(32) NOT NULL,
  `district` VARCHAR(32) NOT NULL,
  `address` VARCHAR(256) NOT NULL,
  `house_number` VARCHAR(64) NOT NULL DEFAULT '',
  `lat` DECIMAL(10,7) NOT NULL,
  `lng` DECIMAL(10,7) NOT NULL,
  `tag` VARCHAR(16) NOT NULL DEFAULT '',
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_user_addresses_user_id` (`user_id`),
  KEY `idx_user_addresses_user_default` (`user_id`, `is_default`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户地址表';

-- ------------------------------------------------------------
-- 3. merchants 商家表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `merchants`;
CREATE TABLE `merchants` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(128) NOT NULL,
  `contact_name` VARCHAR(32) NOT NULL,
  `contact_phone` VARCHAR(20) NOT NULL,
  `password_hash` VARCHAR(256) NOT NULL,
  `license_no` VARCHAR(64) NOT NULL DEFAULT '',
  `license_image` VARCHAR(512) NOT NULL DEFAULT '',
  `id_card_front` VARCHAR(512) NOT NULL DEFAULT '',
  `id_card_back` VARCHAR(512) NOT NULL DEFAULT '',
  `category` VARCHAR(64) NOT NULL DEFAULT '',
  `balance` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `frozen_balance` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  `audit_status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  `audit_remark` VARCHAR(512) NOT NULL DEFAULT '',
  `audited_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_merchants_contact_phone` (`contact_phone`),
  KEY `idx_merchants_status` (`status`),
  KEY `idx_merchants_audit_status` (`audit_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='商家表';

-- ------------------------------------------------------------
-- 4. stores 门店表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `stores`;
CREATE TABLE `stores` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `merchant_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `logo` VARCHAR(512) NOT NULL DEFAULT '',
  `images` JSON DEFAULT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `province` VARCHAR(32) NOT NULL,
  `city` VARCHAR(32) NOT NULL,
  `district` VARCHAR(32) NOT NULL,
  `address` VARCHAR(256) NOT NULL,
  `lat` DECIMAL(10,7) NOT NULL,
  `lng` DECIMAL(10,7) NOT NULL,
  `business_hours` JSON DEFAULT NULL,
  `min_order_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `delivery_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `delivery_range` INT NOT NULL DEFAULT 3000,
  `delivery_time` INT NOT NULL DEFAULT 30,
  `packing_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `announcement` VARCHAR(512) NOT NULL DEFAULT '',
  `status` VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  `is_busy` TINYINT(1) NOT NULL DEFAULT 0,
  `sort` INT NOT NULL DEFAULT 0,
  `commission_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `area_id` BIGINT UNSIGNED DEFAULT NULL,
  `printer_config` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_stores_merchant_id` (`merchant_id`),
  KEY `idx_stores_status` (`status`),
  KEY `idx_stores_area_id` (`area_id`),
  KEY `idx_stores_lat_lng` (`lat`, `lng`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='门店表';

-- ------------------------------------------------------------
-- 5. riders 骑手表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `riders`;
CREATE TABLE `riders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `phone` VARCHAR(20) NOT NULL,
  `password_hash` VARCHAR(256) NOT NULL,
  `name` VARCHAR(32) NOT NULL,
  `avatar` VARCHAR(512) NOT NULL DEFAULT '',
  `id_card_no` VARCHAR(64) NOT NULL DEFAULT '',
  `id_card_front` VARCHAR(512) NOT NULL DEFAULT '',
  `id_card_back` VARCHAR(512) NOT NULL DEFAULT '',
  `health_cert` VARCHAR(512) NOT NULL DEFAULT '',
  `vehicle_type` VARCHAR(32) NOT NULL DEFAULT '',
  `vehicle_no` VARCHAR(32) NOT NULL DEFAULT '',
  `emergency_contact` VARCHAR(32) NOT NULL DEFAULT '',
  `emergency_phone` VARCHAR(20) NOT NULL DEFAULT '',
  `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  `audit_status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  `audit_remark` VARCHAR(512) NOT NULL DEFAULT '',
  `audited_at` DATETIME DEFAULT NULL,
  `online_status` VARCHAR(32) NOT NULL DEFAULT 'OFFLINE',
  `accept_order_types` JSON DEFAULT NULL,
  `accept_radius` INT NOT NULL DEFAULT 5000,
  `service_area_id` BIGINT UNSIGNED DEFAULT NULL,
  `current_lat` DECIMAL(10,7) DEFAULT NULL,
  `current_lng` DECIMAL(10,7) DEFAULT NULL,
  `last_location_at` DATETIME DEFAULT NULL,
  `balance` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `frozen_balance` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `total_orders` INT NOT NULL DEFAULT 0,
  `rating` DECIMAL(3,2) NOT NULL DEFAULT 5.00,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_riders_phone` (`phone`),
  KEY `idx_riders_status` (`status`),
  KEY `idx_riders_online_status` (`online_status`),
  KEY `idx_riders_service_area_id` (`service_area_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='骑手表';

-- ------------------------------------------------------------
-- 6. product_categories 商品分类表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `product_categories`;
CREATE TABLE `product_categories` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id` BIGINT UNSIGNED NOT NULL,
  `parent_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `name` VARCHAR(64) NOT NULL,
  `icon` VARCHAR(512) NOT NULL DEFAULT '',
  `sort` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_product_categories_store_id` (`store_id`),
  KEY `idx_product_categories_parent_id` (`parent_id`),
  KEY `idx_product_categories_store_sort` (`store_id`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='商品分类表';

-- ------------------------------------------------------------
-- 7. products 商品表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id` BIGINT UNSIGNED NOT NULL,
  `category_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `description` TEXT,
  `images` JSON DEFAULT NULL,
  `base_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `packing_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `unit` VARCHAR(16) NOT NULL DEFAULT '份',
  `min_buy` INT NOT NULL DEFAULT 1,
  `max_buy` INT NOT NULL DEFAULT 0,
  `sales_count` INT NOT NULL DEFAULT 0,
  `sort` INT NOT NULL DEFAULT 0,
  `is_hot` TINYINT(1) NOT NULL DEFAULT 0,
  `is_new` TINYINT(1) NOT NULL DEFAULT 0,
  `is_recommend` TINYINT(1) NOT NULL DEFAULT 0,
  `status` VARCHAR(32) NOT NULL DEFAULT 'ON_SHELF',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_products_store_id` (`store_id`),
  KEY `idx_products_category_id` (`category_id`),
  KEY `idx_products_store_status` (`store_id`, `status`),
  KEY `idx_products_store_sort` (`store_id`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='商品表';

-- ------------------------------------------------------------
-- 8. skus SKU表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `skus`;
CREATE TABLE `skus` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `spec_values` JSON DEFAULT NULL,
  `spec_text` VARCHAR(256) NOT NULL DEFAULT '',
  `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `original_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `stock` INT NOT NULL DEFAULT 0,
  `sales_count` INT NOT NULL DEFAULT 0,
  `sku_code` VARCHAR(64) NOT NULL DEFAULT '',
  `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_skus_product_id` (`product_id`),
  KEY `idx_skus_product_status` (`product_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='SKU表';

-- ------------------------------------------------------------
-- 9. orders 订单主表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_no` VARCHAR(32) NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `store_id` BIGINT UNSIGNED DEFAULT NULL,
  `rider_id` BIGINT UNSIGNED DEFAULT NULL,
  `order_type` VARCHAR(32) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING_PAYMENT',
  `payment_status` VARCHAR(32) NOT NULL DEFAULT 'UNPAID',
  `settlement_status` VARCHAR(32) NOT NULL DEFAULT 'UNSETTLED',
  `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `product_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `delivery_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `packing_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `extra_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `tip_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `paid_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `refund_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `coupon_record_id` BIGINT UNSIGNED DEFAULT NULL,
  `contact_name` VARCHAR(32) NOT NULL,
  `contact_phone` VARCHAR(20) NOT NULL,
  `delivery_address` VARCHAR(256) NOT NULL,
  `delivery_lat` DECIMAL(10,7) NOT NULL,
  `delivery_lng` DECIMAL(10,7) NOT NULL,
  `user_remark` VARCHAR(512) NOT NULL DEFAULT '',
  `merchant_remark` VARCHAR(512) NOT NULL DEFAULT '',
  `expected_delivery_time` DATETIME DEFAULT NULL,
  `pay_deadline` DATETIME DEFAULT NULL,
  `merchant_accepted_at` DATETIME DEFAULT NULL,
  `rider_accepted_at` DATETIME DEFAULT NULL,
  `picked_up_at` DATETIME DEFAULT NULL,
  `delivered_at` DATETIME DEFAULT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `cancelled_at` DATETIME DEFAULT NULL,
  `cancel_reason` VARCHAR(256) NOT NULL DEFAULT '',
  `rating_score` TINYINT DEFAULT NULL,
  `rating_content` VARCHAR(512) NOT NULL DEFAULT '',
  `rating_images` JSON DEFAULT NULL,
  `rated_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_orders_order_no` (`order_no`),
  KEY `idx_orders_user_id` (`user_id`),
  KEY `idx_orders_store_id` (`store_id`),
  KEY `idx_orders_rider_id` (`rider_id`),
  KEY `idx_orders_order_type` (`order_type`),
  KEY `idx_orders_status` (`status`),
  KEY `idx_orders_payment_status` (`payment_status`),
  KEY `idx_orders_user_status` (`user_id`, `status`),
  KEY `idx_orders_store_status` (`store_id`, `status`),
  KEY `idx_orders_rider_status` (`rider_id`, `status`),
  KEY `idx_orders_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='订单主表';

-- ------------------------------------------------------------
-- 10. order_items 订单商品明细表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `order_items`;
CREATE TABLE `order_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `sku_id` BIGINT UNSIGNED NOT NULL,
  `product_name` VARCHAR(128) NOT NULL,
  `sku_text` VARCHAR(256) NOT NULL DEFAULT '',
  `product_image` VARCHAR(512) NOT NULL DEFAULT '',
  `price` DECIMAL(10,2) NOT NULL,
  `quantity` INT NOT NULL,
  `subtotal` DECIMAL(10,2) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order_id` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='订单商品明细表';

-- ------------------------------------------------------------
-- 11. errand_orders 跑腿订单扩展表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `errand_orders`;
CREATE TABLE `errand_orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `service_type` VARCHAR(32) NOT NULL,
  `pickup_address` VARCHAR(256) NOT NULL DEFAULT '',
  `pickup_lat` DECIMAL(10,7) DEFAULT NULL,
  `pickup_lng` DECIMAL(10,7) DEFAULT NULL,
  `pickup_contact_name` VARCHAR(32) NOT NULL DEFAULT '',
  `pickup_contact_phone` VARCHAR(20) NOT NULL DEFAULT '',
  `item_description` TEXT,
  `item_type` VARCHAR(32) NOT NULL DEFAULT '',
  `item_weight` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `pickup_code` VARCHAR(32) NOT NULL DEFAULT '',
  `budget_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `actual_buy_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `advance_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `floor_info` VARCHAR(32) NOT NULL DEFAULT '',
  `has_elevator` TINYINT(1) NOT NULL DEFAULT 1,
  `images` JSON DEFAULT NULL,
  `requires_review` TINYINT(1) NOT NULL DEFAULT 0,
  `review_status` VARCHAR(32) NOT NULL DEFAULT '',
  `review_remark` VARCHAR(512) NOT NULL DEFAULT '',
  `distance` INT NOT NULL DEFAULT 0,
  `base_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `distance_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `weight_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `floor_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_errand_orders_order_id` (`order_id`),
  KEY `idx_errand_orders_service_type` (`service_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='跑腿订单扩展表';

-- ------------------------------------------------------------
-- 12. payments 支付表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `payments`;
CREATE TABLE `payments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `payment_no` VARCHAR(64) NOT NULL,
  `transaction_id` VARCHAR(64) NOT NULL DEFAULT '',
  `amount` DECIMAL(10,2) NOT NULL,
  `channel` VARCHAR(32) NOT NULL DEFAULT 'WECHAT',
  `status` VARCHAR(32) NOT NULL DEFAULT 'UNPAID',
  `paid_at` DATETIME DEFAULT NULL,
  `refund_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `callback_raw` TEXT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payments_payment_no` (`payment_no`),
  KEY `idx_payments_order_id` (`order_id`),
  KEY `idx_payments_transaction_id` (`transaction_id`),
  KEY `idx_payments_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='支付表';

-- ------------------------------------------------------------
-- 13. aftersales 售后表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `aftersales`;
CREATE TABLE `aftersales` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `aftersale_no` VARCHAR(32) NOT NULL,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `type` VARCHAR(32) NOT NULL,
  `reason` VARCHAR(512) NOT NULL,
  `description` TEXT,
  `images` JSON DEFAULT NULL,
  `refund_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `actual_refund_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING_ACCEPT',
  `handler_id` BIGINT UNSIGNED DEFAULT NULL,
  `handler_type` VARCHAR(32) NOT NULL DEFAULT '',
  `handle_remark` VARCHAR(512) NOT NULL DEFAULT '',
  `handled_at` DATETIME DEFAULT NULL,
  `refunded_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_aftersales_aftersale_no` (`aftersale_no`),
  KEY `idx_aftersales_order_id` (`order_id`),
  KEY `idx_aftersales_user_id` (`user_id`),
  KEY `idx_aftersales_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='售后表';

-- ------------------------------------------------------------
-- 14. settlements 结算表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `settlements`;
CREATE TABLE `settlements` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `settlement_no` VARCHAR(32) NOT NULL,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `target_type` VARCHAR(32) NOT NULL,
  `target_id` BIGINT UNSIGNED NOT NULL,
  `order_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `commission_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `delivery_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `net_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status` VARCHAR(32) NOT NULL DEFAULT 'UNSETTLED',
  `settled_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_settlements_settlement_no` (`settlement_no`),
  KEY `idx_settlements_order_id` (`order_id`),
  KEY `idx_settlements_target` (`target_type`, `target_id`),
  KEY `idx_settlements_status` (`status`),
  KEY `idx_settlements_target_status` (`target_type`, `target_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='结算表';

-- ------------------------------------------------------------
-- 15. withdrawals 提现表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `withdrawals`;
CREATE TABLE `withdrawals` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `withdrawal_no` VARCHAR(32) NOT NULL,
  `target_type` VARCHAR(32) NOT NULL,
  `target_id` BIGINT UNSIGNED NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `actual_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `account_type` VARCHAR(32) NOT NULL,
  `account_name` VARCHAR(64) NOT NULL DEFAULT '',
  `account_no` VARCHAR(64) NOT NULL DEFAULT '',
  `bank_name` VARCHAR(64) NOT NULL DEFAULT '',
  `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  `audit_admin_id` BIGINT UNSIGNED DEFAULT NULL,
  `audit_remark` VARCHAR(512) NOT NULL DEFAULT '',
  `audited_at` DATETIME DEFAULT NULL,
  `transferred_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_withdrawals_withdrawal_no` (`withdrawal_no`),
  KEY `idx_withdrawals_target` (`target_type`, `target_id`),
  KEY `idx_withdrawals_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='提现表';

-- ------------------------------------------------------------
-- 16. rider_tracks 骑手轨迹表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `rider_tracks`;
CREATE TABLE `rider_tracks` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `rider_id` BIGINT UNSIGNED NOT NULL,
  `order_id` BIGINT UNSIGNED DEFAULT NULL,
  `lat` DECIMAL(10,7) NOT NULL,
  `lng` DECIMAL(10,7) NOT NULL,
  `accuracy` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `speed` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `bearing` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `recorded_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rider_tracks_rider_id` (`rider_id`),
  KEY `idx_rider_tracks_order_id` (`order_id`),
  KEY `idx_rider_tracks_rider_recorded` (`rider_id`, `recorded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='骑手轨迹表';

-- ------------------------------------------------------------
-- 17. messages 消息表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `messages`;
CREATE TABLE `messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `target_type` VARCHAR(32) NOT NULL,
  `target_id` BIGINT UNSIGNED NOT NULL,
  `type` VARCHAR(32) NOT NULL,
  `title` VARCHAR(128) NOT NULL,
  `content` TEXT NOT NULL,
  `extra` JSON DEFAULT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `read_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_messages_target` (`target_type`, `target_id`),
  KEY `idx_messages_target_read` (`target_type`, `target_id`, `is_read`),
  KEY `idx_messages_target_type_msg` (`target_type`, `target_id`, `type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='消息表';

-- ------------------------------------------------------------
-- 18. audit_logs 审计日志表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `operator_id` BIGINT UNSIGNED NOT NULL,
  `operator_type` VARCHAR(32) NOT NULL,
  `operator_name` VARCHAR(64) NOT NULL DEFAULT '',
  `action` VARCHAR(64) NOT NULL,
  `module` VARCHAR(64) NOT NULL,
  `target_type` VARCHAR(64) NOT NULL DEFAULT '',
  `target_id` BIGINT UNSIGNED DEFAULT NULL,
  `detail` JSON DEFAULT NULL,
  `ip` VARCHAR(64) NOT NULL DEFAULT '',
  `user_agent` VARCHAR(512) NOT NULL DEFAULT '',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_logs_operator` (`operator_type`, `operator_id`),
  KEY `idx_audit_logs_action` (`action`),
  KEY `idx_audit_logs_module` (`module`),
  KEY `idx_audit_logs_target` (`target_type`, `target_id`),
  KEY `idx_audit_logs_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='审计日志表';

-- ------------------------------------------------------------
-- 19. configs 配置表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `configs`;
CREATE TABLE `configs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `category` VARCHAR(64) NOT NULL,
  `config_key` VARCHAR(128) NOT NULL,
  `config_value` TEXT NOT NULL,
  `value_type` VARCHAR(32) NOT NULL DEFAULT 'STRING',
  `description` VARCHAR(256) NOT NULL DEFAULT '',
  `is_sensitive` TINYINT(1) NOT NULL DEFAULT 0,
  `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_configs_category_key` (`category`, `config_key`),
  KEY `idx_configs_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='配置表';

-- ------------------------------------------------------------
-- 20. areas 区域表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `areas`;
CREATE TABLE `areas` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `parent_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `name` VARCHAR(64) NOT NULL,
  `level` TINYINT NOT NULL,
  `code` VARCHAR(16) NOT NULL DEFAULT '',
  `lat` DECIMAL(10,7) DEFAULT NULL,
  `lng` DECIMAL(10,7) DEFAULT NULL,
  `boundary` JSON DEFAULT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  `sort` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_areas_parent_id` (`parent_id`),
  KEY `idx_areas_level` (`level`),
  KEY `idx_areas_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='区域表';

-- ------------------------------------------------------------
-- 21. pricing_rules 计价规则表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `pricing_rules`;
CREATE TABLE `pricing_rules` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `type` VARCHAR(32) NOT NULL,
  `rule_name` VARCHAR(64) NOT NULL,
  `area_id` BIGINT UNSIGNED DEFAULT NULL,
  `base_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `distance_rules` JSON DEFAULT NULL,
  `weight_rules` JSON DEFAULT NULL,
  `floor_rules` JSON DEFAULT NULL,
  `time_rules` JSON DEFAULT NULL,
  `weather_rules` JSON DEFAULT NULL,
  `priority` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  `effective_from` DATETIME DEFAULT NULL,
  `effective_to` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pricing_rules_type` (`type`),
  KEY `idx_pricing_rules_area_id` (`area_id`),
  KEY `idx_pricing_rules_type_status` (`type`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='计价规则表';

-- ------------------------------------------------------------
-- 22. coupons 优惠券模板表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `coupons`;
CREATE TABLE `coupons` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(64) NOT NULL,
  `type` VARCHAR(32) NOT NULL,
  `discount_value` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `min_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `max_discount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `applicable_type` VARCHAR(32) NOT NULL DEFAULT 'ALL',
  `applicable_stores` JSON DEFAULT NULL,
  `total_count` INT NOT NULL DEFAULT 0,
  `issued_count` INT NOT NULL DEFAULT 0,
  `used_count` INT NOT NULL DEFAULT 0,
  `valid_days` INT NOT NULL DEFAULT 0,
  `valid_start` DATETIME DEFAULT NULL,
  `valid_end` DATETIME DEFAULT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_coupons_status` (`status`),
  KEY `idx_coupons_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='优惠券模板表';

-- ------------------------------------------------------------
-- 23. coupon_records 用户优惠券表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `coupon_records`;
CREATE TABLE `coupon_records` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `coupon_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'UNUSED',
  `used_order_id` BIGINT UNSIGNED DEFAULT NULL,
  `valid_start` DATETIME NOT NULL,
  `valid_end` DATETIME NOT NULL,
  `used_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_coupon_records_user_id` (`user_id`),
  KEY `idx_coupon_records_user_status` (`user_id`, `status`),
  KEY `idx_coupon_records_coupon_id` (`coupon_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户优惠券表';

-- ------------------------------------------------------------
-- 24. admins 管理员表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `admins`;
CREATE TABLE `admins` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(64) NOT NULL,
  `password_hash` VARCHAR(256) NOT NULL,
  `real_name` VARCHAR(32) NOT NULL DEFAULT '',
  `phone` VARCHAR(20) NOT NULL DEFAULT '',
  `email` VARCHAR(128) NOT NULL DEFAULT '',
  `avatar` VARCHAR(512) NOT NULL DEFAULT '',
  `role_id` BIGINT UNSIGNED NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  `last_login_at` DATETIME DEFAULT NULL,
  `last_login_ip` VARCHAR(64) NOT NULL DEFAULT '',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_admins_username` (`username`),
  KEY `idx_admins_role_id` (`role_id`),
  KEY `idx_admins_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='管理员表';

-- ------------------------------------------------------------
-- 25. roles 角色表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(64) NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `description` VARCHAR(256) NOT NULL DEFAULT '',
  `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_roles_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='角色表';

-- ------------------------------------------------------------
-- 26. role_permissions 角色权限表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `role_permissions`;
CREATE TABLE `role_permissions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `role_id` BIGINT UNSIGNED NOT NULL,
  `permission` VARCHAR(128) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_permissions_role_perm` (`role_id`, `permission`),
  KEY `idx_role_permissions_role_id` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='角色权限表';

-- ------------------------------------------------------------
-- 27. banners 轮播图表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `banners`;
CREATE TABLE `banners` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(128) NOT NULL,
  `image` VARCHAR(512) NOT NULL,
  `link_type` VARCHAR(32) NOT NULL DEFAULT 'NONE',
  `link_value` VARCHAR(512) NOT NULL DEFAULT '',
  `position` VARCHAR(32) NOT NULL DEFAULT 'HOME',
  `target_client` VARCHAR(32) NOT NULL DEFAULT 'ALL',
  `sort` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  `start_time` DATETIME DEFAULT NULL,
  `end_time` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_banners_position_status` (`position`, `status`),
  KEY `idx_banners_sort` (`sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='轮播图表';

-- ------------------------------------------------------------
-- 28. order_logs 订单操作日志表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `order_logs`;
CREATE TABLE `order_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `operator_type` VARCHAR(32) NOT NULL,
  `operator_id` BIGINT UNSIGNED DEFAULT NULL,
  `action` VARCHAR(64) NOT NULL,
  `from_status` VARCHAR(32) NOT NULL DEFAULT '',
  `to_status` VARCHAR(32) NOT NULL DEFAULT '',
  `remark` VARCHAR(512) NOT NULL DEFAULT '',
  `extra` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_logs_order_id` (`order_id`),
  KEY `idx_order_logs_order_action` (`order_id`, `action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='订单操作日志表';

-- ------------------------------------------------------------
-- 29. complaints 投诉工单表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `complaints`;
CREATE TABLE `complaints` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `complaint_no` VARCHAR(32) NOT NULL,
  `order_id` BIGINT UNSIGNED DEFAULT NULL,
  `complainant_type` VARCHAR(32) NOT NULL,
  `complainant_id` BIGINT UNSIGNED NOT NULL,
  `target_type` VARCHAR(32) NOT NULL,
  `target_id` BIGINT UNSIGNED DEFAULT NULL,
  `type` VARCHAR(64) NOT NULL,
  `description` TEXT NOT NULL,
  `images` JSON DEFAULT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  `handler_id` BIGINT UNSIGNED DEFAULT NULL,
  `handle_result` TEXT,
  `handled_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_complaints_complaint_no` (`complaint_no`),
  KEY `idx_complaints_order_id` (`order_id`),
  KEY `idx_complaints_complainant` (`complainant_type`, `complainant_id`),
  KEY `idx_complaints_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='投诉工单表';

-- ------------------------------------------------------------
-- 30. blacklist 黑名单表
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `blacklist`;
CREATE TABLE `blacklist` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `type` VARCHAR(32) NOT NULL,
  `value` VARCHAR(128) NOT NULL,
  `reason` VARCHAR(512) NOT NULL,
  `operator_id` BIGINT UNSIGNED DEFAULT NULL,
  `expire_at` DATETIME DEFAULT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_blacklist_type_value` (`type`, `value`),
  KEY `idx_blacklist_status` (`status`),
  KEY `idx_blacklist_expire_at` (`expire_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='黑名单表';

SET FOREIGN_KEY_CHECKS = 1;
