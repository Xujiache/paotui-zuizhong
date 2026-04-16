-- ============================================================
-- 演示用户账号 + 相关数据（地址/购物车/订单）
-- 登录方式：在小程序登录页点「微信一键登录」即可自动登入此账号
-- （开发期 wx-login 使用固定 code "demo_test_user" 命中此用户）
-- ============================================================

SET NAMES utf8mb4;

-- 清理旧演示账号
DELETE FROM `cart_items` WHERE `user_id` = 7777;
DELETE FROM `user_addresses` WHERE `user_id` = 7777;
DELETE FROM `order_items` WHERE `order_id` IN (SELECT id FROM (SELECT id FROM orders WHERE `user_id` = 7777) t);
DELETE FROM `order_logs` WHERE `order_id` IN (SELECT id FROM (SELECT id FROM orders WHERE `user_id` = 7777) t);
DELETE FROM `errand_orders` WHERE `order_id` IN (SELECT id FROM (SELECT id FROM orders WHERE `user_id` = 7777) t);
DELETE FROM `orders` WHERE `user_id` = 7777;
DELETE FROM `users` WHERE `id` = 7777;

-- ------------------------------------------------------------
-- 演示用户
-- ------------------------------------------------------------
INSERT INTO `users` (
  `id`, `phone`, `nickname`, `avatar`, `gender`,
  `openid`, `unionid`, `status`, `last_login_at`
) VALUES (
  7777, '13800138888', '张三（测试）', 'https://via.placeholder.com/100?text=User', 1,
  'mock_openid_demo_test_user', NULL, 'ACTIVE', NOW()
);

-- ------------------------------------------------------------
-- 演示地址（3 条，第 1 条为默认）
-- ------------------------------------------------------------
INSERT INTO `user_addresses` (
  `id`, `user_id`, `contact_name`, `contact_phone`,
  `province`, `city`, `district`, `address`, `house_number`,
  `lat`, `lng`, `tag`, `is_default`
) VALUES
  (5001, 7777, '张三', '13800138888',
   '北京市', '北京市', '东城区', '王府井大街 88 号', '1栋 3单元 502',
   39.9100, 116.4100, '家', 1),
  (5002, 7777, '张先生', '13900139999',
   '北京市', '北京市', '东城区', '东直门南大街 20 号', 'A 座 8 层',
   39.9420, 116.4290, '公司', 0),
  (5003, 7777, '张小三', '13700137777',
   '北京市', '北京市', '东城区', '朝阳门外大街 10 号', '5 号楼 201',
   39.9280, 116.4360, '朋友家', 0);

-- ------------------------------------------------------------
-- 演示购物车（老王烧烤 + 鲜果集市）
-- ------------------------------------------------------------
INSERT INTO `cart_items` (`user_id`, `store_id`, `product_id`, `sku_id`, `quantity`) VALUES
  (7777, 1001, 3001, 4002, 3),  -- 烤羊肉串微辣 x3
  (7777, 1001, 3002, 4004, 2),  -- 烤牛肉串 x2
  (7777, 1001, 3005, 4007, 2),  -- 冰镇可乐 x2
  (7777, 1002, 3011, 4011, 1);  -- 苹果 1 斤

-- ------------------------------------------------------------
-- 演示订单 1：已完成（商品订单，老王烧烤）
-- ------------------------------------------------------------
INSERT INTO `orders` (
  `id`, `order_no`, `user_id`, `store_id`, `order_type`,
  `status`, `payment_status`, `settlement_status`,
  `total_amount`, `product_amount`, `delivery_fee`, `packing_fee`,
  `paid_amount`, `discount_amount`,
  `contact_name`, `contact_phone`, `delivery_address`,
  `delivery_lat`, `delivery_lng`, `user_remark`,
  `merchant_accepted_at`, `completed_at`, `created_at`
) VALUES (
  8001, 'PO202604170001', 7777, 1001, 'PRODUCT',
  'COMPLETED', 'PAID', 'SETTLED',
  33.50, 29.00, 3.00, 1.50,
  33.50, 0.00,
  '张三', '13800138888', '北京市北京市东城区王府井大街 88 号 1栋 3单元 502',
  39.9100, 116.4100, '多放点孜然',
  DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)
);

INSERT INTO `order_items` (`order_id`, `product_id`, `sku_id`, `product_name`, `sku_text`, `product_image`, `price`, `quantity`, `subtotal`) VALUES
  (8001, 3001, 4001, '烤羊肉串', '原味', 'https://via.placeholder.com/300?text=LaoWang1', 3.00, 5, 15.00),
  (8001, 3002, 4004, '烤牛肉串', '', 'https://via.placeholder.com/300?text=LaoWang2', 4.00, 2, 8.00),
  (8001, 3005, 4007, '冰镇可乐 330ml', '', 'https://via.placeholder.com/300?text=LaoWang5', 5.00, 1, 5.00),
  (8001, 3004, 4006, '凉拌黄瓜', '', 'https://via.placeholder.com/300?text=LaoWang4', 8.00, 0, 1.00);

-- ------------------------------------------------------------
-- 演示订单 2：待支付（商品订单，鲜果集市）
-- 后端真实枚举见 src/types/enums.ts，商品订单 PENDING_PAYMENT / PENDING_MERCHANT / PENDING_RIDER / PENDING_PICKUP / DELIVERING / DELIVERED / COMPLETED / CANCELLED。
-- ------------------------------------------------------------
INSERT INTO `orders` (
  `id`, `order_no`, `user_id`, `store_id`, `order_type`,
  `status`, `payment_status`,
  `total_amount`, `product_amount`, `delivery_fee`, `packing_fee`,
  `paid_amount`, `discount_amount`,
  `contact_name`, `contact_phone`, `delivery_address`,
  `delivery_lat`, `delivery_lng`, `pay_deadline`, `created_at`
) VALUES (
  8002, 'PO202604170002', 7777, 1002, 'PRODUCT',
  'PENDING_PAYMENT', 'UNPAID',
  17.50, 15.00, 2.50, 0.00,
  0.00, 0.00,
  '张先生', '13900139999', '北京市北京市东城区东直门南大街 20 号 A 座 8 层',
  39.9420, 116.4290, DATE_ADD(NOW(), INTERVAL 15 MINUTE), DATE_SUB(NOW(), INTERVAL 2 MINUTE)
);

INSERT INTO `order_items` (`order_id`, `product_id`, `sku_id`, `product_name`, `sku_text`, `product_image`, `price`, `quantity`, `subtotal`) VALUES
  (8002, 3011, 4011, '山东烟台苹果', '1斤', 'https://via.placeholder.com/300?text=Fruit1', 15.00, 1, 15.00);

-- ------------------------------------------------------------
-- 演示订单 3：配送中（跑腿订单）
-- 跑腿订单真实枚举：PENDING_PAYMENT / PENDING_DISPATCH / PENDING_REVIEW / RIDER_ACCEPTED / ON_THE_WAY / IN_PROGRESS / DELIVERED / COMPLETED。
-- 这里"骑手已取件 + 正在配送给收件人"对应 IN_PROGRESS（而不是商品订单专属的 DELIVERING）。
-- ------------------------------------------------------------
INSERT INTO `orders` (
  `id`, `order_no`, `user_id`, `order_type`,
  `status`, `payment_status`,
  `total_amount`, `paid_amount`, `tip_amount`,
  `contact_name`, `contact_phone`, `delivery_address`,
  `delivery_lat`, `delivery_lng`, `user_remark`,
  `rider_accepted_at`, `picked_up_at`, `created_at`
) VALUES (
  8003, 'EO202604170003', 7777, 'ERRAND',
  'IN_PROGRESS', 'PAID',
  12.00, 12.00, 2.00,
  '张三', '13800138888', '北京市北京市东城区王府井大街 88 号 1栋 3单元 502',
  39.9100, 116.4100, '请尽快送达',
  DATE_SUB(NOW(), INTERVAL 25 MINUTE), DATE_SUB(NOW(), INTERVAL 20 MINUTE), DATE_SUB(NOW(), INTERVAL 30 MINUTE)
);

INSERT INTO `errand_orders` (
  `order_id`, `service_type`, `pickup_address`,
  `pickup_lat`, `pickup_lng`, `pickup_contact_name`, `pickup_contact_phone`,
  `item_description`, `item_weight`, `floor_info`, `has_elevator`,
  `budget_amount`, `distance`,
  `base_fee`, `distance_fee`, `weight_fee`, `floor_fee`
) VALUES (
  8003, 'DELIVER', '北京市朝阳区 CBD 国贸三期 45 层',
  39.9085, 116.4585, '李经理', '13600136000',
  '合同文件一份，非常重要', 0.5, '45 楼', 1,
  0.00, 5200,
  5.00, 3.00, 0.00, 2.00
);

-- ------------------------------------------------------------
-- 订单状态流转日志（全部按 src/types/enums.ts 的真实枚举书写）
-- 商品订单：PENDING_PAYMENT → PENDING_MERCHANT → PENDING_RIDER → PENDING_PICKUP → DELIVERING → DELIVERED → COMPLETED
-- 跑腿订单：PENDING_PAYMENT → PENDING_DISPATCH(或 PENDING_REVIEW) → RIDER_ACCEPTED → ON_THE_WAY → IN_PROGRESS → DELIVERED → COMPLETED
-- ------------------------------------------------------------
INSERT INTO `order_logs` (`order_id`, `from_status`, `to_status`, `action`, `remark`, `operator_type`, `operator_id`, `created_at`) VALUES
  (8001, '', 'PENDING_PAYMENT', 'CREATE', '创建订单', 'USER', 7777, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (8001, 'PENDING_PAYMENT', 'PENDING_MERCHANT', 'PAY', '支付成功', 'SYSTEM', NULL, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (8001, 'PENDING_MERCHANT', 'PENDING_RIDER', 'MERCHANT_ACCEPT', '商家接单', 'MERCHANT', 9001, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (8001, 'PENDING_RIDER', 'PENDING_PICKUP', 'RIDER_GRAB', '骑手抢单', 'RIDER', 0, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (8001, 'PENDING_PICKUP', 'DELIVERING', 'PICKUP', '骑手已取货，开始配送', 'RIDER', 0, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (8001, 'DELIVERING', 'DELIVERED', 'DELIVER', '已送达', 'RIDER', 0, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (8001, 'DELIVERED', 'COMPLETED', 'COMPLETE', '订单完成', 'USER', 7777, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (8002, '', 'PENDING_PAYMENT', 'CREATE', '创建订单', 'USER', 7777, DATE_SUB(NOW(), INTERVAL 2 MINUTE)),
  (8003, '', 'PENDING_PAYMENT', 'CREATE', '创建跑腿订单', 'USER', 7777, DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
  (8003, 'PENDING_PAYMENT', 'PENDING_DISPATCH', 'PAY', '支付成功，进入派单', 'SYSTEM', NULL, DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
  (8003, 'PENDING_DISPATCH', 'RIDER_ACCEPTED', 'RIDER_ACCEPT', '骑手接单', 'RIDER', 0, DATE_SUB(NOW(), INTERVAL 25 MINUTE)),
  (8003, 'RIDER_ACCEPTED', 'ON_THE_WAY', 'DEPART', '骑手正在前往取件', 'RIDER', 0, DATE_SUB(NOW(), INTERVAL 22 MINUTE)),
  (8003, 'ON_THE_WAY', 'IN_PROGRESS', 'START_SERVICE', '骑手已取件，配送中', 'RIDER', 0, DATE_SUB(NOW(), INTERVAL 20 MINUTE));
