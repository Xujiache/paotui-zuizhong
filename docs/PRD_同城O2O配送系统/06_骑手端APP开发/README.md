# 阶段06：骑手端APP开发

> 版本: v1.0  
> 状态: 待执行  
> 前置阶段: 阶段03（后端核心服务）、阶段04/05（可并行）

---

## 一、阶段目标

完成**骑手端APP（安卓+iOS双端）共18个页面**的全部开发工作，实现骑手从注册入驻、接单抢单、取货配送、异常处理到收入提现的完整履约闭环。

### 核心交付目标

1. 骑手端APP 18个页面全部开发完成
2. 安卓和iOS双端编译通过，核心功能表现一致
3. 原生能力对接完成：持续定位、轨迹上报、锁屏语音播报、地图导航、扫码核验、后台保活
4. 与后端核心服务（阶段03产出）完成全部接口联调
5. 骑手从抢单到送达确认的主流程可完整走通

---

## 二、技术栈

| 项目 | 选型 | 说明 |
|------|------|------|
| 开发框架 | uni-app x (Vue3 + UTS) | 一套代码编译安卓+iOS双端 |
| UI框架 | uXui (unix-ui) v1.2.0 | uni-app x 专属 UI 组件库 |
| 状态管理 | Pinia | Vue3官方推荐 |
| 网络请求 | 封装uni.request | 统一拦截器、鉴权、断网缓存 |
| 地图SDK | 高德地图 uni-app x 插件 | 路线规划、实时导航、轨迹展示 |
| 持续定位 | 原生插件(安卓Location / iOS CLLocationManager) | 后台持续定位上报 |
| 扫码核验 | uni.scanCode + 原生相机 | 取货码扫描核验 |
| 语音播报 | TTS引擎 + MediaPlayer | 新订单锁屏语音提醒 |
| 离线推送 | 极光推送(JPush) uni-app x 插件 | 安卓+iOS离线消息推送 |
| 后台保活 | 原生插件(前台服务+后台模式) | 保证定位和消息接收 |
| 离线缓存 | SQLite本地库 | 断网时轨迹和订单缓存 |
| 编译目标 | Android APK + iOS IPA | HBuilderX 云打包/本地打包 |
| 开发工具 | HBuilderX ^4.66 | uni-app x 专属 IDE |

### 原生能力需求清单

| 能力 | 安卓实现 | iOS实现 | 用途 |
|------|----------|---------|------|
| 持续定位 | FusedLocationProvider + 前台Service | CLLocationManager + Background Location | 实时位置上报 |
| 轨迹上报 | 定时上报 + 断网SQLite缓存 | 后台任务 + 本地缓存 | 配送轨迹记录 |
| 地图导航 | 高德地图SDK / 调起高德/百度导航 | 高德地图SDK / 调起苹果/高德导航 | 取货和送达导航 |
| 扫码核验 | Camera2 API + ZXing | AVFoundation + CoreImage | 取货码扫描 |
| 语音播报 | Android TTS + MediaPlayer | AVSpeechSynthesizer | 新订单语音提醒 |
| 锁屏提醒 | 悬浮通知 + 全屏Activity | 推送通知 + Sound/Vibration | 锁屏新订单提醒 |
| 离线推送 | 极光(FCM+厂商通道) | APNs | 后台消息推送 |
| 后台保活 | 前台Service + JobScheduler | Background Modes(location,fetch) | 保证定位和推送 |
| 拨打电话 | Intent(ACTION_CALL) | tel: URL Scheme | 联系用户/商家 |

---

## 三、进入条件

| 序号 | 条件 | 验证方式 |
|------|------|----------|
| 1 | 阶段03后端核心服务开发完成 | 接口文档和Postman集合 |
| 2 | 骑手中心接口可用（注册、入驻、审核、状态切换） | Postman验证 |
| 3 | 调度中心接口可用（订单池、抢单、扩圈） | Postman验证 |
| 4 | 订单中心接口可用（骑手维度列表、取货、配送、送达确认） | Postman验证 |
| 5 | 定位轨迹接口可用（位置上报、轨迹查询） | Postman验证 |
| 6 | 结算中心接口可用（收入统计、账单、提现） | Postman验证 |
| 7 | 消息中心接口可用（推送注册、消息列表） | Postman验证 |
| 8 | 地图SDK账号已注册（高德Key已申请） | 控制台确认 |
| 9 | 极光推送账号已注册，双端推送证书已配置 | 极光控制台确认 |
| 10 | 安卓签名证书和iOS开发证书/描述文件已准备 | 证书文件确认 |
| 11 | UI设计稿已交付 | 设计文件可访问 |

---

## 四、退出条件

| 序号 | 条件 | 验证方式 |
|------|------|----------|
| 1 | 18个页面全部开发完成 | 逐页面检查 |
| 2 | 安卓端编译打包成功 | APK安装测试 |
| 3 | iOS端编译打包成功 | IPA/TestFlight测试 |
| 4 | 骑手抢单到送达全流程可走通 | 主流程测试 |
| 5 | 持续定位和轨迹上报正常 | 真机户外测试 |
| 6 | 地图导航功能正常 | 真机导航测试 |
| 7 | 扫码核验功能正常 | 真机扫码测试 |
| 8 | 语音播报功能正常（含锁屏） | 真机测试 |
| 9 | 离线缓存和恢复同步正常 | 断网恢复测试 |
| 10 | 安卓和iOS核心功能表现一致 | 双端对比测试 |
| 11 | 无阻断级别Bug | Bug清单确认 |

---

## 五、产出物清单

| 序号 | 产出物 | 格式 | 说明 |
|------|--------|------|------|
| 1 | 骑手端APP完整源码 | uni-app x 工程 | 18个页面 + 原生插件 + 公共组件 |
| 2 | 安卓安装包 | APK | 签名正式包 |
| 3 | iOS安装包 | IPA | 签名正式包 |
| 4 | 定位与导航技术报告 | Markdown | 精度、功耗、频率测试结果 |
| 5 | 原生能力对接报告 | Markdown | 扫码/语音/推送/保活测试结果 |
| 6 | 接口联调记录 | Markdown | 每个接口的调用状态 |
| 7 | 主流程测试报告 | Markdown | 骑手核心流程测试结果 |
| 8 | 双端兼容性报告 | Markdown | 安卓各版本和iOS各版本测试结果 |

---

## 六、本阶段不做什么

| 序号 | 不做内容 | 说明 |
|------|----------|------|
| 1 | 用户端开发 | 属于阶段04 |
| 2 | 商家端APP开发 | 属于阶段05 |
| 3 | 平台管理后台前端 | 属于阶段07 |
| 4 | 自动派单完整算法 | 首期为抢单模式 |
| 5 | 智能路线多单优化 | 不属于首期范围 |
| 6 | 复杂奖惩体系 | 首期只做基础 |
| 7 | 应用商店上架 | 属于部署上线阶段 |

---

## 七、页面总览（18个）

| 分组 | 页面编号 | 页面名称 | 路由 |
|------|----------|----------|------|
| 账号与入驻 | RD-01 | 注册登录页 | pages/auth/login |
| 账号与入驻 | RD-02 | 入驻申请页 | pages/auth/apply |
| 账号与入驻 | RD-03 | 审核进度页 | pages/auth/review |
| 账号与入驻 | RD-04 | 接单设置页 | pages/auth/settings |
| 接单与配送 | RD-05 | 首页/接单大厅 | pages/hall/index |
| 接单与配送 | RD-06 | 订单池筛选页 | pages/hall/filter |
| 接单与配送 | RD-07 | 订单详情页 | pages/order/detail |
| 接单与配送 | RD-08 | 抢单确认页 | pages/order/grab |
| 接单与配送 | RD-09 | 到店取货页 | pages/delivery/pickup |
| 接单与配送 | RD-10 | 导航配送页 | pages/delivery/navigate |
| 接单与配送 | RD-11 | 送达确认页 | pages/delivery/confirm |
| 接单与配送 | RD-12 | 异常上报页 | pages/delivery/report |
| 收入与管理 | RD-13 | 我的订单页 | pages/myorder/index |
| 收入与管理 | RD-14 | 收入统计页 | pages/income/index |
| 收入与管理 | RD-15 | 提现页 | pages/income/withdraw |
| 收入与管理 | RD-16 | 申诉中心 | pages/appeal/index |
| 收入与管理 | RD-17 | 消息中心 | pages/message/index |
| 收入与管理 | RD-18 | 个人资料页 | pages/profile/index |

---

## 八、与后端接口对接清单概览

### 8.1 认证授权域

| 接口 | 方法 | 路径 | 调用页面 |
|------|------|------|----------|
| 骑手注册 | POST | /api/rider/auth/register | RD-01 |
| 骑手登录 | POST | /api/rider/auth/login | RD-01 |
| 验证码发送 | POST | /api/rider/auth/sms-code | RD-01 |
| 刷新Token | POST | /api/rider/auth/refresh | 全局拦截器 |

### 8.2 入驻与设置域

| 接口 | 方法 | 路径 | 调用页面 |
|------|------|------|----------|
| 提交入驻申请 | POST | /api/rider/apply | RD-02 |
| 查询审核状态 | GET | /api/rider/apply/status | RD-03 |
| 重新提交资料 | PUT | /api/rider/apply | RD-03 |
| 获取接单设置 | GET | /api/rider/settings | RD-04 |
| 更新接单设置 | PUT | /api/rider/settings | RD-04 |
| 切换在线状态 | PUT | /api/rider/status | RD-05 |
| 获取个人资料 | GET | /api/rider/profile | RD-18 |
| 更新个人资料 | PUT | /api/rider/profile | RD-18 |

### 8.3 订单池与接单域

| 接口 | 方法 | 路径 | 调用页面 |
|------|------|------|----------|
| 订单池列表 | GET | /api/rider/pool/list | RD-05, RD-06 |
| 订单详情 | GET | /api/rider/order/:id | RD-07 |
| 抢单 | POST | /api/rider/order/:id/grab | RD-08 |
| 确认到店 | POST | /api/rider/order/:id/arrive | RD-09 |
| 扫码核验 | POST | /api/rider/order/:id/verify | RD-09 |
| 确认取货 | POST | /api/rider/order/:id/pickup | RD-09 |
| 送达确认 | POST | /api/rider/order/:id/deliver | RD-11 |
| 异常上报 | POST | /api/rider/order/:id/report | RD-12 |

### 8.4 定位与轨迹域

| 接口 | 方法 | 路径 | 调用页面 |
|------|------|------|----------|
| 位置上报 | POST | /api/rider/location/report | 后台持续上报 |
| 批量位置上报 | POST | /api/rider/location/batch-report | 断网恢复后批量上报 |

### 8.5 收入与财务域

| 接口 | 方法 | 路径 | 调用页面 |
|------|------|------|----------|
| 我的订单列表 | GET | /api/rider/myorder/list | RD-13 |
| 收入统计 | GET | /api/rider/income/summary | RD-14 |
| 收入明细 | GET | /api/rider/income/detail | RD-14 |
| 提现申请 | POST | /api/rider/withdraw | RD-15 |
| 提现记录 | GET | /api/rider/withdraw/list | RD-15 |

### 8.6 申诉与消息域

| 接口 | 方法 | 路径 | 调用页面 |
|------|------|------|----------|
| 提交申诉 | POST | /api/rider/appeal | RD-16 |
| 申诉列表 | GET | /api/rider/appeal/list | RD-16 |
| 申诉详情 | GET | /api/rider/appeal/:id | RD-16 |
| 注册推送设备 | POST | /api/rider/push/register | 全局启动 |
| 消息列表 | GET | /api/rider/message/list | RD-17 |
| 标记已读 | PUT | /api/rider/message/:id/read | RD-17 |
| 未读数量 | GET | /api/rider/message/unread-count | RD-05 |

---

## 九、工程结构约定

```
rider-app/
├── src/
│   ├── pages/
│   │   ├── auth/                 # 注册登录、入驻、审核、接单设置
│   │   ├── hall/                 # 接单大厅、筛选
│   │   ├── order/                # 订单详情、抢单确认
│   │   ├── delivery/             # 取货、导航、送达、异常上报
│   │   ├── myorder/              # 我的订单
│   │   ├── income/               # 收入统计、提现
│   │   ├── appeal/               # 申诉中心
│   │   ├── message/              # 消息中心
│   │   └── profile/              # 个人资料
│   ├── components/               # 公共组件
│   │   ├── OrderPoolCard.uvue     # 订单池卡片
│   │   ├── MapView.uvue           # 地图视图组件
│   │   ├── NavigateButton.uvue    # 导航按钮
│   │   ├── ScanButton.uvue        # 扫码按钮
│   │   ├── StatusSwitch.uvue      # 在线状态开关
│   │   ├── IncomeCard.uvue        # 收入卡片
│   │   └── OrderAlert.uvue        # 新订单弹窗/播报
│   ├── nativeplugins/            # 原生插件目录
│   │   ├── amap-location/        # 高德定位插件
│   │   ├── amap-navi/            # 高德导航插件
│   │   ├── jpush/                # 极光推送插件
│   │   ├── tts-engine/           # TTS语音引擎
│   │   ├── keep-alive/           # 后台保活插件
│   │   └── scanner/              # 扫码插件
│   ├── services/                 # 业务服务
│   │   ├── locationService.uts    # 定位服务（后台持续上报）
│   │   ├── trackService.uts       # 轨迹缓存与上报服务
│   │   ├── voiceService.uts       # 语音播报服务
│   │   └── offlineService.uts     # 离线缓存服务
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
| 后台定位被系统杀死 | 轨迹中断、位置不更新 | 安卓用前台Service+通知栏，iOS用Background Location模式 |
| 定位精度不足 | 轨迹偏移、距离计算不准 | GPS+WiFi+基站混合定位，室内外自适应切换 |
| 高频定位导致耗电 | 骑手抱怨电量消耗 | 根据配送状态动态调整上报频率 |
| 地图SDK调用限额 | 导航功能受限 | 合理缓存路线数据，非必要不重复请求 |
| 扫码识别率 | 低光照或二维码模糊时失败 | 提供手动输入取货码的备选方案 |
| iOS后台保活限制 | 定位和推送延迟 | Background Location + APNs静默推送组合方案 |
| 安卓碎片化 | 不同厂商ROM行为差异 | 适配主流厂商的自启动和后台白名单引导 |
