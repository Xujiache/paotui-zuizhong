# 同城O2O配送系统

> 一站式本地生活服务平台：商家商品下单 + 跑腿任务发单双主线。

## 技术栈

| 端 | 技术 |
|----|------|
| 后端服务 | Node.js 20+ · Express 4 · TypeScript 5 · MySQL 8 · Redis 7 |
| 平台管理后台 | Vue 3 · Element Plus · Tailwind CSS 4 · Vite 7 · TypeScript |
| 用户小程序 | uni-app x · Vue 3 · UTS |
| 用户微信端 | 微信原生小程序 |
| 商家 / 骑手 APP | uni-app x · Vue 3 · UTS（Android + iOS） |

## 目录结构

```
同城O2O配送系统/
├── node后端/                   # 后端服务
├── 管理后台/                   # 平台管理后台
├── 微信小程序（用户端）/        # 用户端 uni-app x 小程序
├── 微信端/                     # 用户端原生微信小程序
├── 商家端/                     # 商家端 APP（uni-app x）
├── 骑手端/                     # 骑手端 APP（uni-app x）
├── docs/                       # 产品需求 + 设计文档
│   └── PRD_同城O2O配送系统/
│       ├── 01_项目启动与架构设计/
│       ├── 02_数据库设计与基础服务/
│       ├── 03_后端核心业务服务开发/
│       ├── 04_用户端开发(小程序+微信端)/
│       ├── 05_商家端APP开发/
│       ├── 06_骑手端APP开发/
│       ├── 07_平台管理后台开发/
│       ├── 08_联调测试与优化/
│       └── 09_部署上线与项目验收/
├── .github/workflows/          # CI 配置
├── .gitignore
├── .gitattributes
├── .editorconfig
└── README.md
```

## 环境要求

- Node.js **>= 20.19.0**
- npm 9+（或 pnpm 8+）
- MySQL **8.0.x**
- Redis **7.0.x**
- HBuilderX **^4.66**（用于 uni-app x 项目）
- 微信开发者工具（用于小程序/微信端）

## 快速启动

### 1. 初始化数据库

```bash
mysql -u root -p -e "CREATE DATABASE o2o_delivery DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"
mysql -u root -p -e "CREATE DATABASE o2o_delivery_test DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"
mysql -u root -p -e "CREATE USER 'o2o_dev'@'localhost' IDENTIFIED BY 'dev_password_123';"
mysql -u root -p -e "GRANT ALL ON o2o_delivery.* TO 'o2o_dev'@'localhost'; GRANT ALL ON o2o_delivery_test.* TO 'o2o_dev'@'localhost'; FLUSH PRIVILEGES;"
```

### 2. 后端

```bash
cd node后端
cp .env.example .env       # 按需调整 DB / Redis / JWT_SECRET
npm install
npm run db:init            # 建表 + 种子数据（超管 admin/admin123）
npm run dev                # http://localhost:3000
```

健康检查：`GET http://localhost:3000/api/v1/common/health`

### 3. 管理后台

```bash
cd 管理后台
cp .env.example .env.development
pnpm install
pnpm dev                   # http://localhost:3006
```

默认账号：`admin` / `admin123`

### 4. uni-app x 三端

- 在 HBuilderX 中分别打开 `微信小程序（用户端）/`、`商家端/`、`骑手端/`
- 修改对应目录下 `utils/env.uts` 中的 `BASE_URL` 指向你的后端地址
- 通过 HBuilderX 运行到微信开发者工具或模拟器

### 5. 用户微信端（原生）

- 在微信开发者工具中导入 `微信端/` 目录

## 文档入口

- [产品需求（PRD）完整版](docs/PRD_同城O2O配送系统/PRD_完整版.md)
- [技术架构设计](docs/PRD_同城O2O配送系统/01_项目启动与架构设计/技术架构设计文档.md)
- [开发环境与规范](docs/PRD_同城O2O配送系统/01_项目启动与架构设计/开发环境与项目规范.md)
- [数据库设计](docs/PRD_同城O2O配送系统/02_数据库设计与基础服务/数据库设计文档.md)
- [接口规范与状态机](docs/PRD_同城O2O配送系统/03_后端核心业务服务开发/接口规范与状态机.md)
- [OpenAPI 接口目录](docs/api/openapi.yaml)

## 认证接口一览（阶段02 已交付）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/common/health` | 健康检查 |
| `POST` | `/api/v1/common/sms/send-code` | 发送短信验证码 |
| `POST` | `/api/v1/common/upload/image` | 单图上传 |
| `POST` | `/api/v1/common/upload/images` | 多图上传（最多 9 张） |
| `POST` | `/api/v1/auth/user/wx-login` | 用户微信授权登录 |
| `POST` | `/api/v1/auth/user/bind-phone` | 用户绑定手机号 |
| `PUT` | `/api/v1/auth/user/profile` | 用户更新资料 |
| `POST` | `/api/v1/auth/merchant/send-code` | 商家发送验证码 |
| `POST` | `/api/v1/auth/merchant/register` | 商家注册 |
| `POST` | `/api/v1/auth/merchant/login` | 商家验证码登录 |
| `POST` | `/api/v1/auth/merchant/login-pwd` | 商家密码登录 |
| `POST` | `/api/v1/auth/rider/send-code` | 骑手发送验证码 |
| `POST` | `/api/v1/auth/rider/register` | 骑手注册 |
| `POST` | `/api/v1/auth/rider/login` | 骑手登录 |
| `POST` | `/api/v1/auth/admin/login` | 管理员登录 |
| `GET` | `/api/v1/auth/admin/info` | 获取管理员信息 |
| `POST` | `/api/v1/auth/refresh-token` | 刷新 Token |
| `POST` | `/api/v1/auth/logout` | 登出（加入黑名单） |

## 响应格式

所有接口统一返回：

```jsonc
// 成功
{ "code": 0, "message": "success", "data": { /* ... */ } }

// 分页
{ "code": 0, "message": "success", "data": { "list": [], "pagination": { "page": 1, "pageSize": 20, "total": 100, "totalPages": 5 } } }

// 错误
{ "code": 10001, "message": "参数校验失败", "data": null, "errors": [{ "field": "body.phone", "message": "手机号格式不正确" }] }
```

## 开发规范

- 代码规范：[docs/PRD_同城O2O配送系统/01_项目启动与架构设计/开发环境与项目规范.md](docs/PRD_同城O2O配送系统/01_项目启动与架构设计/开发环境与项目规范.md)
- 错误码表：[docs/PRD_同城O2O配送系统/03_后端核心业务服务开发/接口规范与状态机.md](docs/PRD_同城O2O配送系统/03_后端核心业务服务开发/接口规范与状态机.md)

## License

内部项目，版权归定制开发方所有。
