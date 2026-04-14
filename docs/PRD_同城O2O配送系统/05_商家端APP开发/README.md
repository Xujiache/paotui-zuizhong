# 阶段05：商家端APP开发

> 版本: v1.0  
> 状态: 待执行  
> 前置阶段: 阶段03（后端核心服务）、阶段04（用户端，可并行）

---

## 一、阶段目标

完成**商家端APP（安卓+iOS双端）共20个页面**的全部开发工作，实现商家从注册入驻、商品经营、订单履约、售后处理到财务提现的完整业务闭环。

### 核心交付目标

1. 商家端APP 20个页面全部开发完成
2. 安卓和iOS双端编译通过，核心功能表现一致
3. 原生能力对接完成：蓝牙打印、离线推送、语音播报、后台保活、离线缓存
4. 与后端核心服务（阶段03产出）完成全部接口联调
5. 商家接单到履约完成的主流程可完整走通

---

## 二、技术栈

| 项目 | 选型 | 说明 |
|------|------|------|
| 开发框架 | uni-app x (Vue3 + UTS) | 一套代码编译安卓+iOS双端 |
| UI框架 | uXui (unix-ui) v1.2.0 | uni-app x 专属 UI 组件库 |
| 状态管理 | Pinia | Vue3官方推荐 |
| 网络请求 | 封装uni.request | 统一拦截器、鉴权、离线缓存 |
| 蓝牙打印 | uni.openBluetoothAdapter + ESC/POS指令 | 小票打印 |
| 离线推送 | 极光推送(JPush) uni-app x 插件 | 安卓+iOS离线消息推送 |
| 语音播报 | uni.createInnerAudioContext + TTS引擎 | 新订单语音提醒 |
| 后台保活 | 原生插件(安卓前台服务 / iOS后台模式) | 保证消息及时接收 |
| 离线缓存 | uni.setStorageSync + SQLite本地库 | 断网时订单数据缓存 |
| 编译目标 | Android APK + iOS IPA | HBuilderX 云打包/本地打包 |
| 开发工具 | HBuilderX ^4.66 | uni-app x 专属 IDE |

### 原生能力需求清单

| 能力 | 安卓实现 | iOS实现 | 用途 |
|------|----------|---------|------|
| 蓝牙打印 | BluetoothAdapter API | CoreBluetooth | 小票打印机连接和打印 |
| 离线推送 | 极光推送(FCM/厂商通道) | APNs | 新订单提醒、系统消息 |
| 锁屏提醒 | 悬浮通知 + 全屏Intent | 通知Banner + 声音 | 新订单锁屏状态提醒 |
| 语音播报 | Android TTS / MediaPlayer | AVSpeechSynthesizer | 新订单语音播报 |
| 后台保活 | 前台Service + WorkManager | Background Modes | 保证推送和数据同步 |
| 相机权限 | Camera API | AVFoundation | 商品图片拍摄上传 |
| 文件存储 | 外部存储权限 | 沙盒存储 | 对账单导出 |

---

## 三、进入条件

| 序号 | 条件 | 验证方式 |
|------|------|----------|
| 1 | 阶段03后端核心服务开发完成 | 接口文档和Postman集合 |
| 2 | 商家中心接口可用（注册、入驻、店铺CRUD、营业配置） | Postman验证 |
| 3 | 商品中心接口可用（分类、商品CRUD、规格库存管理） | Postman验证 |
| 4 | 订单中心接口可用（商家维度列表、接单/拒单、订单详情） | Postman验证 |
| 5 | 售后中心接口可用（售后列表、处理、异常上报） | Postman验证 |
| 6 | 结算中心接口可用（账单列表、流水、提现申请） | Postman验证 |
| 7 | 消息中心接口可用（推送注册、消息列表、已读标记） | Postman验证 |
| 8 | 极光推送账号已注册，安卓和iOS推送证书已配置 | 极光控制台确认 |
| 9 | 安卓签名证书和iOS开发证书/描述文件已准备 | 证书文件确认 |
| 10 | UI设计稿已交付 | 设计文件可访问 |

---

## 四、退出条件

| 序号 | 条件 | 验证方式 |
|------|------|----------|
| 1 | 20个页面全部开发完成 | 逐页面检查 |
| 2 | 安卓端编译打包成功 | APK安装测试 |
| 3 | iOS端编译打包成功 | IPA/TestFlight测试 |
| 4 | 商家接单全流程可走通 | 主流程测试 |
| 5 | 蓝牙打印功能正常 | 真机打印测试 |
| 6 | 离线推送功能正常（锁屏+后台） | 推送测试 |
| 7 | 语音播报功能正常 | 真机测试 |
| 8 | 离线缓存和恢复同步正常 | 断网恢复测试 |
| 9 | 安卓和iOS核心功能表现一致 | 双端对比测试 |
| 10 | 无阻断级别Bug | Bug清单确认 |

---

## 五、产出物清单

| 序号 | 产出物 | 格式 | 说明 |
|------|--------|------|------|
| 1 | 商家端APP完整源码 | uni-app x 工程 | 20个页面 + 原生插件 + 公共组件 |
| 2 | 安卓安装包 | APK | 签名正式包 |
| 3 | iOS安装包 | IPA | 签名正式包 |
| 4 | 原生能力对接报告 | Markdown | 打印/推送/语音/保活测试结果 |
| 5 | 接口联调记录 | Markdown | 每个接口的调用状态 |
| 6 | 主流程测试报告 | Markdown | 商家核心流程测试结果 |
| 7 | 双端兼容性报告 | Markdown | 安卓各版本和iOS各版本测试结果 |

---

## 六、本阶段不做什么

| 序号 | 不做内容 | 说明 |
|------|----------|------|
| 1 | 用户端开发 | 属于阶段04 |
| 2 | 骑手端APP开发 | 属于阶段06 |
| 3 | 平台管理后台前端 | 属于阶段07 |
| 4 | 多门店深度经营体系 | 不属于首期范围 |
| 5 | 高级营销编排 | 不属于首期范围 |
| 6 | 复杂BI和数据驾驶舱 | 首期只做基础数据看板 |
| 7 | 应用商店上架 | 属于部署上线阶段 |

---

## 七、页面总览（20个）

| 分组 | 页面编号 | 页面名称 | 路由 |
|------|----------|----------|------|
| 账号与入驻 | MC-01 | 注册登录页 | pages/auth/login |
| 账号与入驻 | MC-02 | 入驻申请页 | pages/auth/apply |
| 账号与入驻 | MC-03 | 审核进度页 | pages/auth/review |
| 账号与入驻 | MC-04 | 账号设置页 | pages/auth/settings |
| 工作台与订单 | MC-05 | 工作台首页 | pages/workbench/index |
| 工作台与订单 | MC-06 | 新订单弹窗/播报 | 全局组件（非独立路由） |
| 工作台与订单 | MC-07 | 订单列表页 | pages/order/list |
| 工作台与订单 | MC-08 | 订单详情页 | pages/order/detail |
| 工作台与订单 | MC-09 | 售后处理页 | pages/order/aftersale |
| 工作台与订单 | MC-10 | 异常上报页 | pages/order/report |
| 商品与店铺 | MC-11 | 商品分类页 | pages/product/category |
| 商品与店铺 | MC-12 | 商品管理页 | pages/product/manage |
| 商品与店铺 | MC-13 | 规格库存页 | pages/product/sku |
| 商品与店铺 | MC-14 | 店铺设置页 | pages/shop/settings |
| 商品与店铺 | MC-15 | 营业/配送配置页 | pages/shop/config |
| 商品与店铺 | MC-16 | 打印配置页 | pages/shop/printer |
| 财务与消息 | MC-17 | 数据看板页 | pages/finance/dashboard |
| 财务与消息 | MC-18 | 账单中心页 | pages/finance/bill |
| 财务与消息 | MC-19 | 提现申请页 | pages/finance/withdraw |
| 财务与消息 | MC-20 | 消息中心 | pages/message/index |

---

## 八、与后端接口对接清单概览

### 8.1 认证授权域

| 接口 | 方法 | 路径 | 调用页面 |
|------|------|------|----------|
| 商家注册 | POST | /api/merchant/auth/register | MC-01 |
| 商家登录 | POST | /api/merchant/auth/login | MC-01 |
| 验证码发送 | POST | /api/merchant/auth/sms-code | MC-01 |
| 刷新Token | POST | /api/merchant/auth/refresh | 全局拦截器 |

### 8.2 入驻与店铺域

| 接口 | 方法 | 路径 | 调用页面 |
|------|------|------|----------|
| 提交入驻申请 | POST | /api/merchant/apply | MC-02 |
| 查询审核状态 | GET | /api/merchant/apply/status | MC-03 |
| 重新提交资料 | PUT | /api/merchant/apply | MC-03 |
| 获取店铺信息 | GET | /api/merchant/shop | MC-14 |
| 更新店铺信息 | PUT | /api/merchant/shop | MC-14 |
| 营业配置查询 | GET | /api/merchant/shop/config | MC-15 |
| 更新营业配置 | PUT | /api/merchant/shop/config | MC-15 |
| 配送配置查询 | GET | /api/merchant/shop/delivery | MC-15 |
| 更新配送配置 | PUT | /api/merchant/shop/delivery | MC-15 |

### 8.3 商品管理域

| 接口 | 方法 | 路径 | 调用页面 |
|------|------|------|----------|
| 分类列表 | GET | /api/merchant/category/list | MC-11 |
| 新增分类 | POST | /api/merchant/category | MC-11 |
| 编辑分类 | PUT | /api/merchant/category/:id | MC-11 |
| 删除分类 | DELETE | /api/merchant/category/:id | MC-11 |
| 商品列表 | GET | /api/merchant/product/list | MC-12 |
| 新增商品 | POST | /api/merchant/product | MC-12 |
| 编辑商品 | PUT | /api/merchant/product/:id | MC-12 |
| 上下架商品 | PUT | /api/merchant/product/:id/status | MC-12 |
| 规格列表 | GET | /api/merchant/product/:id/sku | MC-13 |
| 更新规格库存 | PUT | /api/merchant/product/:id/sku | MC-13 |

### 8.4 订单域

| 接口 | 方法 | 路径 | 调用页面 |
|------|------|------|----------|
| 订单列表 | GET | /api/merchant/order/list | MC-07 |
| 订单详情 | GET | /api/merchant/order/:id | MC-08 |
| 接单 | POST | /api/merchant/order/:id/accept | MC-06, MC-08 |
| 拒单 | POST | /api/merchant/order/:id/reject | MC-06, MC-08 |
| 确认备货完成 | POST | /api/merchant/order/:id/ready | MC-08 |
| 售后列表 | GET | /api/merchant/aftersale/list | MC-09 |
| 处理售后 | POST | /api/merchant/aftersale/:id/handle | MC-09 |
| 异常上报 | POST | /api/merchant/order/:id/report | MC-10 |

### 8.5 财务域

| 接口 | 方法 | 路径 | 调用页面 |
|------|------|------|----------|
| 工作台数据 | GET | /api/merchant/dashboard | MC-05, MC-17 |
| 账单列表 | GET | /api/merchant/bill/list | MC-18 |
| 账单详情 | GET | /api/merchant/bill/:id | MC-18 |
| 提现申请 | POST | /api/merchant/withdraw | MC-19 |
| 提现记录 | GET | /api/merchant/withdraw/list | MC-19 |

### 8.6 消息与推送域

| 接口 | 方法 | 路径 | 调用页面 |
|------|------|------|----------|
| 注册推送设备 | POST | /api/merchant/push/register | 全局启动 |
| 消息列表 | GET | /api/merchant/message/list | MC-20 |
| 标记已读 | PUT | /api/merchant/message/:id/read | MC-20 |
| 未读数量 | GET | /api/merchant/message/unread-count | MC-05 |

---

## 九、工程结构约定

```
merchant-app/
├── src/
│   ├── pages/
│   │   ├── auth/                 # 注册登录、入驻、审核、设置
│   │   ├── workbench/            # 工作台首页
│   │   ├── order/                # 订单列表、详情、售后、异常上报
│   │   ├── product/              # 商品分类、管理、规格库存
│   │   ├── shop/                 # 店铺设置、营业配送配置、打印配置
│   │   ├── finance/              # 数据看板、账单、提现
│   │   └── message/              # 消息中心
│   ├── components/               # 公共组件
│   │   ├── OrderAlert.uvue        # 新订单弹窗/播报组件
│   │   ├── OrderCard.uvue         # 订单卡片
│   │   ├── ProductCard.uvue       # 商品卡片
│   │   ├── PrintButton.uvue       # 打印按钮
│   │   └── StatusBadge.uvue       # 状态标签
│   ├── nativeplugins/            # 原生插件目录
│   │   ├── bluetooth-printer/    # 蓝牙打印插件
│   │   ├── jpush/                # 极光推送插件
│   │   ├── tts-engine/           # TTS语音引擎
│   │   └── keep-alive/           # 后台保活插件
│   ├── store/                    # Pinia状态管理
│   ├── api/                      # 接口封装
│   ├── utils/                    # 工具函数
│   ├── styles/                   # 全局样式
│   ├── static/                   # 静态资源
│   ├── App.uvue
│   ├── main.uts
│   ├── pages.json
│   └── manifest.json
├── .env.development
├── .env.production
└── package.json
```

---

## 十、风险与注意事项

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 蓝牙打印兼容性 | 不同打印机型号指令集差异 | 优先适配主流机型（佳博、商米），提供打印机型号白名单 |
| iOS后台保活限制 | 推送可能延迟 | 利用APNs静默推送 + VoIP推送实现准实时 |
| 安卓厂商推送碎片化 | 部分厂商通道接入成本高 | 通过极光推送统一管理厂商通道 |
| 离线缓存数据一致性 | 恢复网络后可能与服务端冲突 | 以服务端数据为准，本地用时间戳做冲突检测 |
| 双端UI差异 | 安卓和iOS原生控件表现不一致 | 关键组件使用自定义UI，减少原生控件依赖 |
| APP审核被拒 | 延迟上线 | 提前了解应用商店审核规则 |
