import http from 'http';

const BASE = 'http://localhost:3099';

interface HttpResult {
  status: number;
  body: unknown;
  headers: http.IncomingHttpHeaders;
}

const req = (
  method: string,
  path: string,
  opt?: { token?: string; body?: unknown; headers?: Record<string, string> },
): Promise<HttpResult> =>
  new Promise((resolve, reject) => {
    const data = opt?.body ? Buffer.from(JSON.stringify(opt.body)) : undefined;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(opt?.headers ?? {}),
    };
    if (opt?.token) headers['Authorization'] = `Bearer ${opt.token}`;
    if (data) headers['Content-Length'] = String(data.length);

    const url = new URL(BASE + path);
    const r = http.request(
      {
        method,
        host: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf-8');
          let body: unknown = text;
          try {
            body = JSON.parse(text);
          } catch {
            /* keep raw text */
          }
          resolve({ status: res.statusCode || 0, body, headers: res.headers });
        });
      },
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });

type CheckFn = (r: HttpResult) => boolean | string;

let pass = 0;
let fail = 0;
const failures: Array<{ label: string; detail: string }> = [];

const check = async (label: string, fn: () => Promise<HttpResult>, cond: CheckFn) => {
  try {
    const r = await fn();
    const result = cond(r);
    if (result === true) {
      pass++;
      console.log(`  ✅ ${label}`);
    } else {
      fail++;
      const detail =
        typeof result === 'string'
          ? result
          : `status=${r.status} body=${JSON.stringify(r.body).slice(0, 300)}`;
      failures.push({ label, detail });
      console.log(`  ❌ ${label} — ${detail}`);
    }
  } catch (err) {
    fail++;
    const detail = (err as Error).message;
    failures.push({ label, detail });
    console.log(`  ❌ ${label} — ${detail}`);
  }
};

const expectCode = (expected: number) => (r: HttpResult) => {
  const body = r.body as { code?: number } | null;
  return body?.code === expected ? true : `expected code=${expected}, got ${JSON.stringify(body)}`;
};

const expectStatus = (status: number) => (r: HttpResult) =>
  r.status === status ? true : `expected status ${status}, got ${r.status}`;

const expectOk = (r: HttpResult) => {
  const body = r.body as { code?: number } | null;
  return body?.code === 0 ? true : `expected code=0, got ${JSON.stringify(body)}`;
};

const runSmoke = async (): Promise<void> => {
  // 提前声明跨章节变量，避免 TDZ
  let fresh_admin = '';

  console.log('\n━━━━━━━━ 网关基础 ━━━━━━━━');

  await check(
    'GW-01 GET /api/v1/common/health 返回200',
    () => req('GET', '/api/v1/common/health'),
    (r) => (r.status === 200 && (r.body as { code?: number })?.code === 0 ? true : 'fail'),
  );
  await check(
    'GW-01b GET /api/v1/health 别名',
    () => req('GET', '/api/v1/health'),
    expectOk,
  );
  await check(
    'GW-03 404路由返回10002',
    () => req('GET', '/api/v1/not-exist-route'),
    expectCode(10002),
  );
  await check(
    'GW-04 CORS头',
    () =>
      req('OPTIONS', '/api/v1/common/health', {
        headers: { Origin: 'http://127.0.0.1', 'Access-Control-Request-Method': 'GET' },
      }),
    (r) =>
      r.headers['access-control-allow-origin']
        ? true
        : `missing CORS headers: ${JSON.stringify(r.headers)}`,
  );
  await check(
    'GW-06 JSON请求体解析',
    () => req('POST', '/api/v1/common/sms/send-code', { body: { phone: '13800138000' } }),
    (r) => {
      const c = (r.body as { code?: number })?.code;
      return c === 0 || c === 11006 ? true : `unexpected code ${c}`;
    },
  );

  console.log('\n━━━━━━━━ 管理员登录闭环 ━━━━━━━━');

  let adminToken = '';
  let adminRefresh = '';

  await check(
    'AL-01 admin/admin123 登录成功',
    () =>
      req('POST', '/api/v1/auth/admin/login', {
        body: { username: 'admin', password: 'admin123' },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { accessToken?: string; refreshToken?: string } };
      if (b?.code !== 0) return `code=${b?.code}`;
      if (!b.data?.accessToken || !b.data?.refreshToken) return 'missing tokens';
      adminToken = b.data.accessToken;
      adminRefresh = b.data.refreshToken;
      return true;
    },
  );

  await check(
    'AL-03 错误密码返回401',
    () =>
      req('POST', '/api/v1/auth/admin/login', {
        body: { username: 'admin', password: 'definitely_wrong_pwd' },
      }),
    (r) => (r.status === 401 ? true : `status=${r.status}`),
  );

  await check(
    'AL-02 GET /auth/admin/info 返回roleName+permissions',
    () => req('GET', '/api/v1/auth/admin/info', { token: adminToken }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { roleCode?: string; permissions?: string[] };
      };
      if (b?.code !== 0) return `code=${b?.code}`;
      if (b.data?.roleCode !== 'SUPER_ADMIN') return `roleCode=${b.data?.roleCode}`;
      if (!Array.isArray(b.data?.permissions) || !b.data.permissions.includes('*')) {
        return 'permissions missing *';
      }
      return true;
    },
  );

  console.log('\n━━━━━━━━ 认证 & 权限 ━━━━━━━━');

  await check(
    'AU-03 无Token访问 info 返回11001',
    () => req('GET', '/api/v1/auth/admin/info'),
    expectCode(11001),
  );

  await check(
    'AU-04 refresh-token 换新对',
    () =>
      req('POST', '/api/v1/auth/refresh-token', {
        body: { refreshToken: adminRefresh },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { accessToken?: string; refreshToken?: string } };
      if (b?.code !== 0) return `code=${b?.code}`;
      if (!b.data?.accessToken || !b.data?.refreshToken) return 'missing tokens';
      if (b.data.accessToken === adminToken) return 'accessToken not rotated';
      adminToken = b.data.accessToken;
      adminRefresh = b.data.refreshToken;
      return true;
    },
  );

  console.log('\n━━━━━━━━ 短信验证码 ━━━━━━━━');

  const smsPhone = `139${Math.floor(10000000 + Math.random() * 89999999)}`;
  await check(
    'SM-01 发送验证码',
    () => req('POST', '/api/v1/common/sms/send-code', { body: { phone: smsPhone } }),
    expectOk,
  );

  await check(
    'SM-02 60秒内重发被拒绝（11006）',
    () => req('POST', '/api/v1/common/sms/send-code', { body: { phone: smsPhone } }),
    expectCode(11006),
  );

  await check(
    'SM-03 错误手机号格式返回10001',
    () => req('POST', '/api/v1/common/sms/send-code', { body: { phone: 'abc' } }),
    expectCode(10001),
  );

  console.log('\n━━━━━━━━ 商家登录闭环 ━━━━━━━━');

  const merPhone = `138${Math.floor(10000000 + Math.random() * 89999999)}`;
  await check(
    'ML 发送注册验证码',
    () =>
      req('POST', '/api/v1/auth/merchant/send-code', {
        body: { phone: merPhone, scene: 'REGISTER' },
      }),
    expectOk,
  );
  await check(
    'ML-01 商家注册（PENDING）',
    () =>
      req('POST', '/api/v1/auth/merchant/register', {
        body: {
          phone: merPhone,
          code: '123456',
          password: 'test123456',
          name: '测试商家',
          contactName: '张三',
        },
      }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { merchantInfo?: { status?: string; auditStatus?: string } };
      };
      if (b?.code !== 0) return `code=${b?.code}`;
      if (b.data?.merchantInfo?.status !== 'PENDING') return 'status != PENDING';
      if (b.data?.merchantInfo?.auditStatus !== 'PENDING') return 'auditStatus != PENDING';
      return true;
    },
  );
  await check(
    'ML-04 密码登录成功',
    () =>
      req('POST', '/api/v1/auth/merchant/login-pwd', {
        body: { phone: merPhone, password: 'test123456' },
      }),
    expectOk,
  );
  await check(
    'ML-05 错误密码返回13002',
    () =>
      req('POST', '/api/v1/auth/merchant/login-pwd', {
        body: { phone: merPhone, password: 'wrong' },
      }),
    expectCode(13002),
  );

  console.log('\n━━━━━━━━ 骑手登录闭环 ━━━━━━━━');

  const ridPhone = `137${Math.floor(10000000 + Math.random() * 89999999)}`;
  let riderToken = '';
  await check(
    'RL 发送验证码',
    () =>
      req('POST', '/api/v1/auth/rider/send-code', {
        body: { phone: ridPhone, scene: 'REGISTER' },
      }),
    expectOk,
  );
  await check(
    'RL-01 骑手注册（PENDING/OFFLINE）',
    () =>
      req('POST', '/api/v1/auth/rider/register', {
        body: {
          phone: ridPhone,
          code: '123456',
          password: 'rider123',
          name: '骑手A',
        },
      }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: {
          accessToken?: string;
          riderInfo?: { status?: string; onlineStatus?: string; auditStatus?: string };
        };
      };
      if (b?.code !== 0) return `code=${b?.code}`;
      if (b.data?.riderInfo?.status !== 'PENDING') return 'status';
      if (b.data?.riderInfo?.auditStatus !== 'PENDING') return 'auditStatus';
      if (b.data?.riderInfo?.onlineStatus !== 'OFFLINE') return 'onlineStatus';
      riderToken = b.data.accessToken ?? '';
      return true;
    },
  );
  await check(
    'RL-02 重复注册（验证码已过期）',
    () =>
      req('POST', '/api/v1/auth/rider/register', {
        body: {
          phone: ridPhone,
          code: '123456',
          password: 'rider123',
          name: '骑手A',
        },
      }),
    (r) => {
      const c = (r.body as { code?: number })?.code;
      return c === 11005 || c === 14004 ? true : `unexpected code ${c}`;
    },
  );

  console.log('\n━━━━━━━━ 用户(微信) 登录闭环 ━━━━━━━━');

  let userToken = '';
  let userId = 0;
  await check(
    'UL-01 微信登录(新用户)',
    () =>
      req('POST', '/api/v1/auth/user/wx-login', {
        body: { code: `smoke_${Date.now()}` },
      }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: {
          accessToken?: string;
          isNewUser?: boolean;
          hasPhone?: boolean;
          userInfo?: { id: number };
        };
      };
      if (b?.code !== 0) return `code=${b?.code}`;
      if (!b.data?.accessToken) return 'missing accessToken';
      if (!b.data?.isNewUser) return 'isNewUser != true';
      if (b.data?.hasPhone !== false) return 'hasPhone should be false';
      userToken = b.data.accessToken;
      userId = b.data.userInfo?.id ?? 0;
      return userId > 0 ? true : 'missing userInfo.id';
    },
  );

  const bindPhone = `135${Math.floor(10000000 + Math.random() * 89999999)}`;
  await check(
    'UL pre-send 验证码',
    () =>
      req('POST', '/api/v1/common/sms/send-code', {
        body: { phone: bindPhone, scene: 'BIND_PHONE' },
      }),
    expectOk,
  );
  await check(
    'UL-03 绑定手机号返回脱敏',
    () =>
      req('POST', '/api/v1/auth/user/bind-phone', {
        token: userToken,
        body: { phone: bindPhone, code: '123456' },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { phone?: string } };
      if (b?.code !== 0) return `code=${b?.code}`;
      if (!b.data?.phone?.includes('****')) return `phone not masked: ${b.data?.phone}`;
      return true;
    },
  );

  console.log('\n━━━━━━━━ 骑手中心（阶段03） ━━━━━━━━');

  // 提前登录拿管理员 token（骑手中心需要）
  await check(
    'RC prep 管理员登录',
    () =>
      req('POST', '/api/v1/auth/admin/login', {
        body: { username: 'admin', password: 'admin123' },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { accessToken?: string } };
      fresh_admin = b.data?.accessToken ?? '';
      return fresh_admin ? true : `code=${b?.code}`;
    },
  );

  // riderToken 来自 RL-01 注册，PENDING 状态
  await check(
    'RC-07 未审核骑手不能上线（应14005）',
    () =>
      req('PATCH', '/api/v1/rider/online-status', {
        token: riderToken,
        body: { status: 'ONLINE' },
      }),
    (r) => {
      const c = (r.body as { code?: number })?.code;
      return c === 14005 ? true : `unexpected code ${c}`;
    },
  );

  await check(
    'RC-01 提交骑手入驻资料',
    () =>
      req('POST', '/api/v1/rider/apply', {
        token: riderToken,
        body: {
          idCardNo: '440300199001010001',
          idCardFront: 'https://example.com/if.jpg',
          idCardBack: 'https://example.com/ib.jpg',
          healthCert: 'https://example.com/hc.jpg',
          vehicleType: 'ELECTRIC',
          vehicleNo: '粤B12345',
          emergencyContact: '李四',
          emergencyPhone: '13900001234',
        },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { auditStatus?: string } };
      return b?.code === 0 && b.data?.auditStatus === 'PENDING' ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'RC-11 后台骑手列表',
    () => req('GET', '/api/v1/admin/riders?pageSize=10', { token: fresh_admin }),
    (r) => {
      const b = r.body as { code?: number; data?: { list?: unknown[] } };
      return b?.code === 0 && Array.isArray(b.data?.list) ? true : `got ${JSON.stringify(b)}`;
    },
  );

  // 从骑手 profile 接口拿 id（PENDING 状态时可拿）
  let rcId = 0;
  await check(
    'RC-03 获取骑手资料',
    () => req('GET', '/api/v1/rider/profile', { token: riderToken }),
    (r) => {
      const b = r.body as { code?: number; data?: { id?: number; auditStatus?: string } };
      if (b?.code !== 0) return `code=${b?.code}`;
      rcId = b.data?.id ?? 0;
      return rcId > 0 ? true : 'missing id';
    },
  );

  await check(
    'RC-10 管理员审核骑手通过',
    () =>
      req('POST', `/api/v1/admin/riders/${rcId}/audit`, {
        token: fresh_admin,
        body: { action: 'APPROVE', remark: '资料齐全' },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { auditStatus?: string; status?: string } };
      return b?.code === 0 && b.data?.auditStatus === 'APPROVED' && b.data?.status === 'ACTIVE'
        ? true
        : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'RC-03 审核后 切换 ONLINE 成功',
    () =>
      req('PATCH', '/api/v1/rider/online-status', {
        token: riderToken,
        body: { status: 'ONLINE' },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { onlineStatus?: string } };
      return b?.code === 0 && b.data?.onlineStatus === 'ONLINE' ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'RC-04 上报位置',
    () =>
      req('POST', '/api/v1/rider/location', {
        token: riderToken,
        body: { lat: 22.5432, lng: 113.9473, speed: 10, accuracy: 5 },
      }),
    expectOk,
  );

  await check(
    'RC-06 更新接单设置',
    () =>
      req('PUT', '/api/v1/rider/accept-settings', {
        token: riderToken,
        body: { acceptRadius: 4000, acceptOrderTypes: ['PRODUCT', 'ERRAND'] },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { acceptRadius?: number } };
      return b?.code === 0 && b.data?.acceptRadius === 4000 ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'RC 收入统计（占位）',
    () => req('GET', '/api/v1/rider/income', { token: riderToken }),
    (r) => {
      const b = r.body as { code?: number; data?: { balance?: number } };
      return b?.code === 0 && typeof b.data?.balance === 'number' ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'RC-13 后台冻结骑手',
    () =>
      req('PATCH', `/api/v1/admin/riders/${rcId}/status`, {
        token: fresh_admin,
        body: { status: 'FROZEN' },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { status?: string; onlineStatus?: string } };
      return b?.code === 0 && b.data?.status === 'FROZEN' && b.data?.onlineStatus === 'OFFLINE'
        ? true
        : `got ${JSON.stringify(b)}`;
    },
  );

  console.log('\n━━━━━━━━ 商家中心（阶段03） ━━━━━━━━');

  // merPhone / merchantId 早已创建（ML-01），用 merchantLoginByPassword 拿 token
  const mcPhone = `136${Math.floor(10000000 + Math.random() * 89999999)}`;
  let mcToken = '';
  let mcId = 0;
  await check(
    'MC prep 发送商家注册验证码',
    () =>
      req('POST', '/api/v1/auth/merchant/send-code', {
        body: { phone: mcPhone, scene: 'REGISTER' },
      }),
    expectOk,
  );
  await check(
    'MC prep 注册商家',
    () =>
      req('POST', '/api/v1/auth/merchant/register', {
        body: {
          phone: mcPhone,
          code: '123456',
          password: 'mcpass123',
          name: '冒烟商家',
          contactName: '王五',
        },
      }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { accessToken?: string; merchantInfo?: { id?: number } };
      };
      if (b?.code !== 0) return `code=${b?.code}`;
      mcToken = b.data?.accessToken ?? '';
      mcId = b.data?.merchantInfo?.id ?? 0;
      return mcToken && mcId ? true : 'missing token/id';
    },
  );

  await check(
    'MC-01 提交入驻资料',
    () =>
      req('POST', '/api/v1/merchant/apply', {
        token: mcToken,
        body: {
          licenseNo: '91440300MA000001',
          licenseImage: 'https://example.com/lic.jpg',
          idCardFront: 'https://example.com/idf.jpg',
          idCardBack: 'https://example.com/idb.jpg',
          category: '快餐便当',
        },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { auditStatus?: string } };
      return b?.code === 0 && b.data?.auditStatus === 'PENDING' ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'MC 审核进度查询',
    () => req('GET', '/api/v1/merchant/audit-status', { token: mcToken }),
    (r) => {
      const b = r.body as { code?: number; data?: { auditStatus?: string } };
      return b?.code === 0 && b.data?.auditStatus === 'PENDING' ? true : `got ${JSON.stringify(b)}`;
    },
  );

  // MC 未审核时创建门店应失败
  await check(
    'MC 未审核创建门店（应13005）',
    () =>
      req('POST', '/api/v1/merchant/stores', {
        token: mcToken,
        body: {
          name: 'X店',
          phone: '075588888888',
          province: '广东省',
          city: '深圳市',
          district: '南山区',
          address: '科技园',
          lat: 22.5431,
          lng: 113.9472,
        },
      }),
    (r) => {
      const c = (r.body as { code?: number })?.code;
      return c === 13005 ? true : `unexpected code ${c}`;
    },
  );

  await check(
    'MC prep 管理员登录',
    () =>
      req('POST', '/api/v1/auth/admin/login', {
        body: { username: 'admin', password: 'admin123' },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { accessToken?: string } };
      fresh_admin = b.data?.accessToken ?? '';
      return fresh_admin ? true : `code=${b?.code}`;
    },
  );

  await check(
    'MC-10 后台审核通过',
    () =>
      req('POST', `/api/v1/admin/merchants/${mcId}/audit`, {
        token: fresh_admin,
        body: { action: 'APPROVE', remark: '资料齐全' },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { auditStatus?: string; status?: string } };
      return b?.code === 0 && b.data?.auditStatus === 'APPROVED' && b.data?.status === 'ACTIVE'
        ? true
        : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'MC-02 重复审核应失败',
    () =>
      req('POST', `/api/v1/admin/merchants/${mcId}/audit`, {
        token: fresh_admin,
        body: { action: 'APPROVE' },
      }),
    (r) => {
      const c = (r.body as { code?: number })?.code;
      return c === 13008 ? true : `unexpected code ${c}`;
    },
  );

  let storeId = 0;
  await check(
    'MC-04 创建门店',
    () =>
      req('POST', '/api/v1/merchant/stores', {
        token: mcToken,
        body: {
          name: '冒烟门店',
          phone: '075588888888',
          province: '广东省',
          city: '深圳市',
          district: '南山区',
          address: '科技园南路1号',
          lat: 22.5431,
          lng: 113.9472,
          minOrderAmount: 15,
          deliveryFee: 3,
          deliveryRange: 3000,
          deliveryTime: 30,
          packingFee: 1,
        },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { id?: number; status?: string } };
      if (b?.code !== 0) return `code=${b?.code}`;
      if (b.data?.status !== 'OPEN') return `status=${b.data?.status}`;
      storeId = b.data?.id ?? 0;
      return storeId > 0 ? true : 'missing id';
    },
  );

  await check(
    'MC-05 更新门店（logo）',
    () =>
      req('PUT', `/api/v1/merchant/stores/${storeId}`, {
        token: mcToken,
        body: { logo: 'https://example.com/logo.png' },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { logo?: string } };
      return b?.code === 0 && b.data?.logo === 'https://example.com/logo.png'
        ? true
        : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'MC-18 更新店铺公告',
    () =>
      req('PUT', `/api/v1/merchant/stores/${storeId}/announcement`, {
        token: mcToken,
        body: { announcement: '新开业优惠中' },
      }),
    expectOk,
  );

  await check(
    'MC-06 设置营业时间',
    () =>
      req('PUT', `/api/v1/merchant/stores/${storeId}/business-hours`, {
        token: mcToken,
        body: {
          businessHours: [
            { start: '09:00', end: '14:00' },
            { start: '17:00', end: '22:00' },
          ],
        },
      }),
    expectOk,
  );

  await check(
    'MC-07 设置配送配置',
    () =>
      req('PUT', `/api/v1/merchant/stores/${storeId}/delivery`, {
        token: mcToken,
        body: { minOrderAmount: 20, deliveryFee: 5, deliveryRange: 5000 },
      }),
    expectOk,
  );

  await check(
    'MC-08 切换营业状态',
    () =>
      req('PATCH', `/api/v1/merchant/stores/${storeId}/status`, {
        token: mcToken,
        body: { status: 'CLOSED' },
      }),
    expectOk,
  );

  // 切回 OPEN 以便 nearby 测试
  await check(
    'MC-08 切回 OPEN',
    () =>
      req('PATCH', `/api/v1/merchant/stores/${storeId}/status`, {
        token: mcToken,
        body: { status: 'OPEN' },
      }),
    expectOk,
  );

  await check(
    'MC-09 商家门店列表',
    () => req('GET', '/api/v1/merchant/stores', { token: mcToken }),
    (r) => {
      const b = r.body as { code?: number; data?: { list?: unknown[] } };
      return b?.code === 0 && Array.isArray(b.data?.list) && (b.data!.list!.length ?? 0) > 0
        ? true
        : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'MC-14 用户端附近商家（应含新门店）',
    () =>
      req(
        'GET',
        `/api/v1/merchant/nearby?lat=22.5431&lng=113.9472&distance=3000`,
        { token: userToken },
      ),
    (r) => {
      const b = r.body as { code?: number; data?: { list?: Array<{ id: number }> } };
      if (b?.code !== 0) return `code=${b?.code}`;
      const hasStore = (b.data?.list ?? []).some((x) => x.id === storeId);
      return hasStore ? true : `not found storeId=${storeId} in list`;
    },
  );

  await check(
    'MC-15 用户端商家详情',
    () => req('GET', `/api/v1/merchant/stores/${storeId}/detail`, { token: userToken }),
    (r) => {
      const b = r.body as { code?: number; data?: { id?: number } };
      return b?.code === 0 && b.data?.id === storeId ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'MC-11 后台商家列表',
    () => req('GET', '/api/v1/admin/merchants?pageSize=10', { token: fresh_admin }),
    (r) => {
      const b = r.body as { code?: number; data?: { list?: unknown[]; pagination?: unknown } };
      return b?.code === 0 && Array.isArray(b.data?.list) ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'MC-12 后台商家详情',
    () => req('GET', `/api/v1/admin/merchants/${mcId}`, { token: fresh_admin }),
    (r) => {
      const b = r.body as { code?: number; data?: { id?: number; status?: string } };
      return b?.code === 0 && b.data?.id === mcId && b.data?.status === 'ACTIVE'
        ? true
        : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'MC-13 后台冻结商家',
    () =>
      req('PATCH', `/api/v1/admin/merchants/${mcId}/status`, {
        token: fresh_admin,
        body: { status: 'FROZEN' },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { status?: string } };
      return b?.code === 0 && b.data?.status === 'FROZEN' ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'MC-13 冻结后商家不能密码登录（应13003）',
    () =>
      req('POST', '/api/v1/auth/merchant/login-pwd', {
        body: { phone: mcPhone, password: 'mcpass123' },
      }),
    (r) => {
      const c = (r.body as { code?: number })?.code;
      return c === 13003 ? true : `unexpected code ${c}`;
    },
  );

  console.log('\n━━━━━━━━ 商品中心 + 购物车（阶段03） ━━━━━━━━');

  // 用 MC 商家建的门店（storeId）+ mcToken
  let catId = 0;
  await check(
    'PC-01 新增分类',
    () =>
      req('POST', '/api/v1/product/categories', {
        token: mcToken,
        body: { storeId, name: '主食' },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { id?: number } };
      if (b?.code !== 0) return `code=${b?.code}`;
      catId = b.data?.id ?? 0;
      return catId > 0 ? true : 'missing id';
    },
  );

  await check(
    'PC-01 查询分类列表',
    () => req('GET', `/api/v1/product/categories?storeId=${storeId}`, { token: mcToken }),
    (r) => {
      const b = r.body as { code?: number; data?: { list?: unknown[] } };
      return b?.code === 0 && Array.isArray(b.data?.list) && (b.data!.list!.length ?? 0) > 0
        ? true
        : `got ${JSON.stringify(b)}`;
    },
  );

  let productId = 0;
  let skuAId = 0;
  let skuBId = 0;
  await check(
    'PC-04 创建商品 + 两个 SKU',
    () =>
      req('POST', '/api/v1/product/products', {
        token: mcToken,
        body: {
          storeId,
          categoryId: catId,
          name: '香辣鸡腿堡',
          description: '精选鸡腿肉',
          images: ['https://example.com/p1.jpg'],
          basePriceFen: 2500,
          packingFeeFen: 200,
          unit: '份',
          minBuy: 1,
          maxBuy: 5,
          isHot: true,
          skus: [
            {
              specValues: { size: '单人份' },
              specText: '单人份',
              priceFen: 2500,
              originalPriceFen: 3000,
              stock: 100,
            },
            {
              specValues: { size: '双人份' },
              specText: '双人份',
              priceFen: 4500,
              originalPriceFen: 5500,
              stock: 50,
            },
          ],
        },
      }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { id?: number; skus?: Array<{ id: number }> };
      };
      if (b?.code !== 0) return `code=${b?.code}`;
      productId = b.data?.id ?? 0;
      skuAId = b.data?.skus?.[0]?.id ?? 0;
      skuBId = b.data?.skus?.[1]?.id ?? 0;
      return productId > 0 && skuAId > 0 && skuBId > 0 ? true : 'missing ids';
    },
  );

  await check(
    'PC-08 商品详情（SKU 齐全）',
    () => req('GET', `/api/v1/product/products/${productId}`, { token: mcToken }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { skus?: Array<{ stock: number; price: number }> };
      };
      if (b?.code !== 0) return `code=${b?.code}`;
      const skus = b.data?.skus ?? [];
      return skus.length === 2 && skus[0].price === 2500 && skus[0].stock === 100
        ? true
        : `got ${JSON.stringify(b.data)}`;
    },
  );

  await check(
    'PC-09 减少库存 3 件',
    () =>
      req('PATCH', `/api/v1/product/skus/${skuAId}/stock`, {
        token: mcToken,
        body: { action: 'DECREMENT', quantity: 3 },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { stock?: number } };
      return b?.code === 0 && b.data?.stock === 97 ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'PC-10 超额减库存（应15001）',
    () =>
      req('PATCH', `/api/v1/product/skus/${skuAId}/stock`, {
        token: mcToken,
        body: { action: 'DECREMENT', quantity: 999 },
      }),
    expectCode(15001),
  );

  await check(
    'PC-11 用户端商品列表（仅含上架）',
    () =>
      req('GET', `/api/v1/product/stores/${storeId}/products`, { token: userToken }),
    (r) => {
      const b = r.body as { code?: number; data?: { list?: Array<{ id: number }> } };
      if (b?.code !== 0) return `code=${b?.code}`;
      return (b.data?.list ?? []).some((p) => p.id === productId)
        ? true
        : `not found productId=${productId}`;
    },
  );

  await check(
    'PC-06 商品上下架（下架）',
    () =>
      req('PATCH', `/api/v1/product/products/${productId}/status`, {
        token: mcToken,
        body: { status: 'OFF_SHELF' },
      }),
    expectOk,
  );

  await check(
    'PC-13 用户端不展示下架商品',
    () =>
      req('GET', `/api/v1/product/stores/${storeId}/products`, { token: userToken }),
    (r) => {
      const b = r.body as { code?: number; data?: { list?: Array<{ id: number }> } };
      if (b?.code !== 0) return `code=${b?.code}`;
      const hasIt = (b.data?.list ?? []).some((p) => p.id === productId);
      return !hasIt ? true : '下架商品仍返回';
    },
  );

  await check(
    'PC-06 上架回来',
    () =>
      req('PATCH', `/api/v1/product/products/${productId}/status`, {
        token: mcToken,
        body: { status: 'ON_SHELF' },
      }),
    expectOk,
  );

  await check(
    'PC-12 商品搜索',
    () =>
      req('GET', '/api/v1/product/search?keyword=鸡腿', { token: userToken }),
    (r) => {
      const b = r.body as { code?: number; data?: { list?: Array<{ id: number }> } };
      return b?.code === 0 && (b.data?.list ?? []).some((p) => p.id === productId)
        ? true
        : `got ${JSON.stringify(b)}`;
    },
  );

  // ========== 购物车 ==========
  let cartItemId = 0;
  await check(
    'C-01 加入购物车',
    () =>
      req('POST', '/api/v1/cart/items', {
        token: userToken,
        body: { storeId, productId, skuId: skuAId, quantity: 2 },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { id?: number; quantity?: number } };
      if (b?.code !== 0) return `code=${b?.code}`;
      cartItemId = b.data?.id ?? 0;
      return cartItemId > 0 && b.data?.quantity === 2 ? true : 'missing id';
    },
  );

  await check(
    'C-01 再次加入（累加）',
    () =>
      req('POST', '/api/v1/cart/items', {
        token: userToken,
        body: { storeId, productId, skuId: skuAId, quantity: 1 },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { quantity?: number } };
      return b?.code === 0 && b.data?.quantity === 3 ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'C-02 更新数量',
    () =>
      req('PUT', `/api/v1/cart/items/${cartItemId}`, {
        token: userToken,
        body: { quantity: 2 },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { quantity?: number } };
      return b?.code === 0 && b.data?.quantity === 2 ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'C-04 获取购物车（按门店分组）',
    () => req('GET', '/api/v1/cart', { token: userToken }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { groups?: Array<{ storeId: number; items: unknown[] }> };
      };
      if (b?.code !== 0) return `code=${b?.code}`;
      const grp = (b.data?.groups ?? []).find((g) => g.storeId === storeId);
      return grp && grp.items.length === 1 ? true : `got ${JSON.stringify(b.data)}`;
    },
  );

  await check(
    'C-06 购物车结算前校验',
    () =>
      req('POST', '/api/v1/cart/check', {
        token: userToken,
        body: { storeId },
      }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { valid?: boolean; storeOpen?: boolean };
      };
      return b?.code === 0 && b.data?.storeOpen === true ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'C-05 清空当前门店购物车',
    () => req('DELETE', `/api/v1/cart?storeId=${storeId}`, { token: userToken }),
    expectOk,
  );

  console.log('\n━━━━━━━━ 订单下单主流程（阶段03） ━━━━━━━━');

  // 先恢复骑手在线（前面 RC-13 已冻结并下线）——重新审核/上线一个新骑手
  const ord_rPhone = `134${Math.floor(10000000 + Math.random() * 89999999)}`;
  let ord_riderToken = '';
  let ord_riderId = 0;
  await check(
    '订单 prep 骑手发送验证码',
    () =>
      req('POST', '/api/v1/auth/rider/send-code', {
        body: { phone: ord_rPhone, scene: 'REGISTER' },
      }),
    expectOk,
  );
  await check(
    '订单 prep 新骑手注册',
    () =>
      req('POST', '/api/v1/auth/rider/register', {
        body: {
          phone: ord_rPhone,
          code: '123456',
          password: 'ord_rider_pwd',
          name: '订单骑手',
        },
      }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { accessToken?: string; riderInfo?: { id: number } };
      };
      if (b?.code !== 0) return `code=${b?.code}`;
      ord_riderToken = b.data?.accessToken ?? '';
      ord_riderId = b.data?.riderInfo?.id ?? 0;
      return ord_riderToken && ord_riderId ? true : 'missing token/id';
    },
  );
  await check(
    '订单 prep 管理员审核骑手通过',
    () =>
      req('POST', `/api/v1/admin/riders/${ord_riderId}/audit`, {
        token: fresh_admin,
        body: { action: 'APPROVE' },
      }),
    expectOk,
  );
  await check(
    '订单 prep 骑手上线',
    () =>
      req('PATCH', '/api/v1/rider/online-status', {
        token: ord_riderToken,
        body: { status: 'ONLINE' },
      }),
    expectOk,
  );

  // 用户必须先有一个地址，离门店 (22.5431, 113.9472) 近一点
  let userAddressId = 0;
  await check(
    '订单 prep 新增收货地址',
    () =>
      req('POST', '/api/v1/user/addresses', {
        token: userToken,
        body: {
          contactName: '买家',
          contactPhone: '13800138000',
          province: '广东省',
          city: '深圳市',
          district: '南山区',
          address: '科技园南路',
          houseNumber: '2栋101',
          lat: 22.5432,
          lng: 113.9473,
          tag: '家',
          isDefault: true,
        },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { id?: number } };
      if (b?.code !== 0) return `code=${b?.code}`;
      userAddressId = b.data?.id ?? 0;
      return userAddressId > 0 ? true : 'missing id';
    },
  );

  // 给门店重置 min_order_amount=0 以便本 smoke 测试不被起送价阻拦
  await check(
    '订单 prep 重置起送价为0',
    () =>
      req('PUT', `/api/v1/merchant/stores/${storeId}/delivery`, {
        token: mcToken,
        body: { minOrderAmount: 0 },
      }),
    expectOk,
  );

  // 计价预估（PR-01）
  await check(
    'PRC-01 商品订单计价',
    () =>
      req('POST', '/api/v1/pricing/product-order', {
        token: userToken,
        body: {
          storeId,
          items: [{ skuId: skuAId, quantity: 2 }],
          deliveryLat: 22.5432,
          deliveryLng: 113.9473,
        },
      }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { productAmount?: number; totalAmount?: number };
      };
      return b?.code === 0 && b.data?.productAmount === 5000
        ? true
        : `got ${JSON.stringify(b)}`;
    },
  );

  // OC-01 创建商品订单
  let orderId = 0;
  let orderNo = '';
  let paymentNo = '';
  await check(
    'OC-01 创建商品订单',
    () =>
      req('POST', '/api/v1/order/product-orders', {
        token: userToken,
        body: {
          storeId,
          addressId: userAddressId,
          items: [{ skuId: skuAId, quantity: 2 }],
          remark: 'smoke',
        },
      }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { orderId?: number; orderNo?: string; paymentNo?: string; paidAmount?: number };
      };
      if (b?.code !== 0) return `code=${b?.code}`;
      orderId = b.data?.orderId ?? 0;
      orderNo = b.data?.orderNo ?? '';
      paymentNo = b.data?.paymentNo ?? '';
      return orderId && orderNo && paymentNo ? true : 'missing fields';
    },
  );

  await check(
    '订单详情（PENDING_PAYMENT）',
    () => req('GET', `/api/v1/order/orders/${orderId}`, { token: userToken }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { status?: string; paymentStatus?: string };
      };
      return b?.code === 0 &&
        b.data?.status === 'PENDING_PAYMENT' &&
        b.data?.paymentStatus === 'UNPAID'
        ? true
        : `got ${JSON.stringify(b.data)}`;
    },
  );

  // 查支付记录
  let paymentAmountFen = 0;
  await check(
    '订单 prep 查支付记录',
    () => req('GET', `/api/v1/order/payment/${orderNo}`, { token: userToken }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { paymentNo?: string; amountFen?: number };
      };
      if (b?.code !== 0) return `code=${b?.code}`;
      paymentAmountFen = b.data?.amountFen ?? 0;
      return b.data?.paymentNo === paymentNo ? true : 'paymentNo mismatch';
    },
  );

  // OC-06 模拟支付回调
  await check(
    'OC-06 模拟支付回调（mock）',
    () =>
      req('POST', '/api/v1/order/payment/callback', {
        body: {
          paymentNo,
          transactionId: `TX${Date.now()}`,
          amountFen: paymentAmountFen,
        },
      }),
    expectOk,
  );

  // OC-07 重复回调幂等
  await check(
    'OC-07 支付回调幂等（重复调用）',
    () =>
      req('POST', '/api/v1/order/payment/callback', {
        body: {
          paymentNo,
          transactionId: `TX${Date.now()}`,
          amountFen: paymentAmountFen,
        },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { idempotent?: boolean } };
      return b?.code === 0 && b.data?.idempotent === true ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    '支付后订单状态 PENDING_MERCHANT',
    () => req('GET', `/api/v1/order/orders/${orderId}`, { token: userToken }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { status?: string; paymentStatus?: string };
      };
      return b?.code === 0 &&
        b.data?.status === 'PENDING_MERCHANT' &&
        b.data?.paymentStatus === 'PAID'
        ? true
        : `got ${JSON.stringify(b.data)}`;
    },
  );

  // OC-09 商家接单
  await check(
    'OC-09 商家接单',
    () =>
      req('POST', `/api/v1/order/orders/${orderId}/merchant-accept`, {
        token: mcToken,
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { status?: string } };
      return b?.code === 0 && b.data?.status === 'PENDING_RIDER'
        ? true
        : `got ${JSON.stringify(b)}`;
    },
  );

  // DC-02 骑手查看订单池，应能看到该订单
  await check(
    'DC-02 骑手查看订单池（含该订单）',
    () =>
      req(
        'GET',
        `/api/v1/dispatch/order-pool?lat=22.5432&lng=113.9473&radius=5000`,
        { token: ord_riderToken },
      ),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { list?: Array<{ id: number }> };
      };
      return b?.code === 0 && (b.data?.list ?? []).some((o) => o.id === orderId)
        ? true
        : `got ${JSON.stringify(b.data)}`;
    },
  );

  // DC-04 OC-12 骑手抢单
  await check(
    'OC-12 骑手抢单',
    () =>
      req('POST', `/api/v1/dispatch/orders/${orderId}/grab`, {
        token: ord_riderToken,
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { status?: string } };
      return b?.code === 0 && b.data?.status === 'PENDING_PICKUP'
        ? true
        : `got ${JSON.stringify(b)}`;
    },
  );

  // DC-05 并发抢单（第二次抢同一单）
  await check(
    'DC-05 重复抢单应失败（18001）',
    () =>
      req('POST', `/api/v1/dispatch/orders/${orderId}/grab`, {
        token: ord_riderToken,
      }),
    (r) => {
      const c = (r.body as { code?: number })?.code;
      return c === 18001 ? true : `unexpected code ${c}`;
    },
  );

  // OC-14 骑手取货
  await check(
    'OC-14 骑手确认取货',
    () =>
      req('POST', `/api/v1/order/orders/${orderId}/pickup`, {
        token: ord_riderToken,
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { status?: string } };
      return b?.code === 0 && b.data?.status === 'DELIVERING'
        ? true
        : `got ${JSON.stringify(b)}`;
    },
  );

  // OC-15 骑手送达
  await check(
    'OC-15 骑手确认送达',
    () =>
      req('POST', `/api/v1/order/orders/${orderId}/deliver`, {
        token: ord_riderToken,
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { status?: string } };
      return b?.code === 0 && b.data?.status === 'DELIVERED'
        ? true
        : `got ${JSON.stringify(b)}`;
    },
  );

  // OC-16 用户确认收货
  await check(
    'OC-16 用户确认收货',
    () =>
      req('POST', `/api/v1/order/orders/${orderId}/complete`, {
        token: userToken,
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { status?: string } };
      return b?.code === 0 && b.data?.status === 'COMPLETED'
        ? true
        : `got ${JSON.stringify(b)}`;
    },
  );

  // OC-23 订单操作日志（应有 CREATE/PAY/MERCHANT_ACCEPT/RIDER_GRAB/PICKUP/DELIVER/COMPLETE）
  await check(
    'OC-23 订单操作日志',
    () => req('GET', `/api/v1/order/orders/${orderId}/logs`, { token: userToken }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { list?: Array<{ action: string }> };
      };
      if (b?.code !== 0) return `code=${b?.code}`;
      const actions = (b.data?.list ?? []).map((l) => l.action);
      const required = ['CREATE', 'PAY', 'MERCHANT_ACCEPT', 'RIDER_GRAB', 'PICKUP', 'DELIVER', 'COMPLETE'];
      const missing = required.filter((a) => !actions.includes(a));
      return missing.length === 0 ? true : `missing actions: ${missing.join(',')}`;
    },
  );

  // SM-06 非法状态流转：已完成订单再接单
  await check(
    'SM-06 已完成订单再接单（应16005）',
    () =>
      req('POST', `/api/v1/order/orders/${orderId}/merchant-accept`, {
        token: mcToken,
      }),
    expectCode(16005),
  );

  // ==== 跑腿订单核心流程 ====
  let errandOrderId = 0;
  let errandPaymentNo = '';
  let errandAmountFen = 0;
  await check(
    'OC-18 创建跑腿订单（帮送）',
    () =>
      req('POST', '/api/v1/order/errand-orders', {
        token: userToken,
        body: {
          serviceType: 'DELIVER',
          pickupAddress: '科技园A栋',
          pickupLat: 22.5431,
          pickupLng: 113.9472,
          pickupContactName: '寄件人',
          pickupContactPhone: '13900008888',
          deliveryAddressId: userAddressId,
          itemDescription: '文件袋',
          itemWeight: 0.5,
          floorInfo: '3楼',
        },
      }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { orderId?: number; paymentNo?: string; paidAmount?: number };
      };
      if (b?.code !== 0) return `code=${b?.code}`;
      errandOrderId = b.data?.orderId ?? 0;
      errandPaymentNo = b.data?.paymentNo ?? '';
      errandAmountFen = b.data?.paidAmount ?? 0;
      return errandOrderId && errandPaymentNo ? true : 'missing fields';
    },
  );

  await check(
    'OC-19 跑腿支付回调（帮送免审核）',
    () =>
      req('POST', '/api/v1/order/payment/callback', {
        body: {
          paymentNo: errandPaymentNo,
          transactionId: `ERT${Date.now()}`,
          amountFen: errandAmountFen,
        },
      }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { status?: string };
      };
      return b?.code === 0 && b.data?.status === 'PENDING_DISPATCH'
        ? true
        : `got ${JSON.stringify(b.data)}`;
    },
  );

  await check(
    'OC-12 跑腿骑手抢单（进入 RIDER_ACCEPTED）',
    () =>
      req('POST', `/api/v1/dispatch/orders/${errandOrderId}/grab`, {
        token: ord_riderToken,
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { status?: string } };
      return b?.code === 0 && b.data?.status === 'RIDER_ACCEPTED'
        ? true
        : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'OC-26 跑腿骑手出发',
    () =>
      req('POST', `/api/v1/order/orders/${errandOrderId}/depart`, {
        token: ord_riderToken,
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { status?: string } };
      return b?.code === 0 && b.data?.status === 'ON_THE_WAY' ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'OC-27 跑腿骑手到达开始执行',
    () =>
      req('POST', `/api/v1/order/orders/${errandOrderId}/start-service`, {
        token: ord_riderToken,
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { status?: string } };
      return b?.code === 0 && b.data?.status === 'IN_PROGRESS' ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    '跑腿骑手送达',
    () =>
      req('POST', `/api/v1/order/orders/${errandOrderId}/deliver`, {
        token: ord_riderToken,
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { status?: string } };
      return b?.code === 0 && b.data?.status === 'DELIVERED' ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    '跑腿用户确认完成',
    () =>
      req('POST', `/api/v1/order/orders/${errandOrderId}/complete`, {
        token: userToken,
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { status?: string } };
      return b?.code === 0 && b.data?.status === 'COMPLETED' ? true : `got ${JSON.stringify(b)}`;
    },
  );

  console.log('\n━━━━━━━━ 状态机 & 异常场景（阶段03） ━━━━━━━━');

  // 新建一个订单专门做 cancel + 非法跳转测试
  let order2Id = 0;
  let order2PaymentNo = '';
  let order2Amount = 0;
  await check(
    'SM prep 创建订单2',
    () =>
      req('POST', '/api/v1/order/product-orders', {
        token: userToken,
        body: {
          storeId,
          addressId: userAddressId,
          items: [{ skuId: skuBId, quantity: 1 }],
          remark: 'sm-test',
        },
      }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { orderId?: number; paymentNo?: string; paidAmount?: number };
      };
      if (b?.code !== 0) return `code=${b?.code}`;
      order2Id = b.data?.orderId ?? 0;
      order2PaymentNo = b.data?.paymentNo ?? '';
      order2Amount = b.data?.paidAmount ?? 0;
      return order2Id > 0 ? true : 'missing id';
    },
  );

  // SM-01 PENDING_PAYMENT 时商家接单 → 16005
  await check(
    'SM-01 PENDING_PAYMENT 商家接单（16005）',
    () =>
      req('POST', `/api/v1/order/orders/${order2Id}/merchant-accept`, {
        token: mcToken,
      }),
    expectCode(16005),
  );

  // EX-04 金额不一致 → 16008
  await check(
    'EX-04 支付金额不一致（16008）',
    () =>
      req('POST', '/api/v1/order/payment/callback', {
        body: {
          paymentNo: order2PaymentNo,
          transactionId: `TX${Date.now()}`,
          amountFen: order2Amount + 100,
        },
      }),
    expectCode(16008),
  );

  // 正确支付
  await check(
    'SM prep 订单2 正确支付',
    () =>
      req('POST', '/api/v1/order/payment/callback', {
        body: {
          paymentNo: order2PaymentNo,
          transactionId: `TX${Date.now()}`,
          amountFen: order2Amount,
        },
      }),
    expectOk,
  );

  // SM-02 PENDING_MERCHANT 时骑手抢单 → 18001（非候选池状态）
  await check(
    'SM-02 PENDING_MERCHANT 骑手抢单（18001）',
    () =>
      req('POST', `/api/v1/dispatch/orders/${order2Id}/grab`, {
        token: ord_riderToken,
      }),
    expectCode(18001),
  );

  // OC-21 用户在 PENDING_MERCHANT 时取消订单 → CANCELLED
  await check(
    'OC-21 用户取消（PENDING_MERCHANT）',
    () =>
      req('POST', `/api/v1/order/orders/${order2Id}/cancel`, {
        token: userToken,
        body: { reason: '用户主动取消' },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { status?: string } };
      return b?.code === 0 && b.data?.status === 'CANCELLED'
        ? true
        : `got ${JSON.stringify(b)}`;
    },
  );

  // OC-22 已取消订单再次取消（不能取消终态）
  await check(
    'OC-22 已取消订单再次取消（16010）',
    () =>
      req('POST', `/api/v1/order/orders/${order2Id}/cancel`, {
        token: userToken,
        body: { reason: 'retry' },
      }),
    expectCode(16010),
  );

  // 验证取消订单的库存已回补（skuB 创建商品时 stock=50，扣减1 后剩 49，取消应回到 50）
  await check(
    'OC-21 取消订单后库存已恢复',
    () => req('GET', `/api/v1/product/products/${productId}`, { token: mcToken }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { skus?: Array<{ id: number; stock: number }> };
      };
      if (b?.code !== 0) return `code=${b?.code}`;
      const skuB = b.data?.skus?.find((s) => s.id === skuBId);
      return skuB && skuB.stock === 50 ? true : `skuB stock=${skuB?.stock}`;
    },
  );

  // 创建第三个订单做 SM-03/04/05 测试
  let order3Id = 0;
  let order3PaymentNo = '';
  let order3Amount = 0;
  await check(
    'SM prep 创建订单3',
    () =>
      req('POST', '/api/v1/order/product-orders', {
        token: userToken,
        body: {
          storeId,
          addressId: userAddressId,
          items: [{ skuId: skuAId, quantity: 1 }],
        },
      }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { orderId?: number; paymentNo?: string; paidAmount?: number };
      };
      if (b?.code !== 0) return `code=${b?.code}`;
      order3Id = b.data?.orderId ?? 0;
      order3PaymentNo = b.data?.paymentNo ?? '';
      order3Amount = b.data?.paidAmount ?? 0;
      return true;
    },
  );
  await check(
    'SM prep 订单3 支付',
    () =>
      req('POST', '/api/v1/order/payment/callback', {
        body: {
          paymentNo: order3PaymentNo,
          transactionId: `TX${Date.now()}`,
          amountFen: order3Amount,
        },
      }),
    expectOk,
  );
  await check(
    'SM prep 订单3 商家接单',
    () =>
      req('POST', `/api/v1/order/orders/${order3Id}/merchant-accept`, {
        token: mcToken,
      }),
    expectOk,
  );

  // SM-03 PENDING_RIDER 时骑手取货（未抢单）→ 16005
  await check(
    'SM-03 PENDING_RIDER 骑手取货（403/16005）',
    () =>
      req('POST', `/api/v1/order/orders/${order3Id}/pickup`, {
        token: ord_riderToken,
      }),
    (r) => {
      const c = (r.body as { code?: number })?.code;
      // 未抢单 rider_id 不匹配，会返回 11003（forbidden）；或 16005 状态非法
      return c === 11003 || c === 16005 ? true : `unexpected code ${c}`;
    },
  );

  // 骑手抢订单3
  await check(
    'SM prep 订单3 骑手抢单',
    () =>
      req('POST', `/api/v1/dispatch/orders/${order3Id}/grab`, {
        token: ord_riderToken,
      }),
    expectOk,
  );

  // SM-05 DELIVERING 之前的用户确认 → 16005
  await check(
    'SM-05 PENDING_PICKUP 时用户确认（16005）',
    () =>
      req('POST', `/api/v1/order/orders/${order3Id}/complete`, {
        token: userToken,
      }),
    expectCode(16005),
  );

  // EX-07 退款金额超限 → 19001
  await check(
    'EX-07 退款金额超限（19001）',
    () =>
      req('POST', '/api/v1/aftersale/refund', {
        token: userToken,
        body: {
          orderId: order3Id,
          reason: '测试',
          refundAmountFen: 999999999,
        },
      }),
    expectCode(19001),
  );

  console.log('\n━━━━━━━━ 结算中心（阶段03） ━━━━━━━━');

  // OC-16 已触发结算，商家应有账单且余额 > 0
  await check(
    'SC-04 商家账单存在',
    () =>
      req('GET', '/api/v1/settlement/merchant-bills?pageSize=5', {
        token: mcToken,
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { list?: unknown[] } };
      return b?.code === 0 && Array.isArray(b.data?.list) && (b.data!.list!.length ?? 0) > 0
        ? true
        : `got ${JSON.stringify(b.data)}`;
    },
  );

  await check(
    'SC-05 商家余额 > 0（结算后）',
    () => req('GET', '/api/v1/settlement/balance', { token: mcToken }),
    (r) => {
      const b = r.body as { code?: number; data?: { balance?: number } };
      return b?.code === 0 && (b.data?.balance ?? 0) > 0
        ? true
        : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'SC-04 骑手账单存在',
    () =>
      req('GET', '/api/v1/settlement/rider-bills?pageSize=5', {
        token: ord_riderToken,
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { list?: unknown[] } };
      return b?.code === 0 && Array.isArray(b.data?.list) && (b.data!.list!.length ?? 0) > 0
        ? true
        : `got ${JSON.stringify(b.data)}`;
    },
  );

  let withdrawalId = 0;
  await check(
    'SC-06 骑手申请提现',
    () =>
      req('POST', '/api/v1/settlement/withdraw', {
        token: ord_riderToken,
        body: {
          amountFen: 100,
          accountType: 'WECHAT',
          accountName: '骑手小李',
        },
      }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { id?: number; status?: string };
      };
      if (b?.code !== 0) return `code=${b?.code}`;
      withdrawalId = b.data?.id ?? 0;
      return b.data?.status === 'PENDING' ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'SC-07 超额提现（应20001）',
    () =>
      req('POST', '/api/v1/settlement/withdraw', {
        token: ord_riderToken,
        body: {
          amountFen: 99999999,
          accountType: 'WECHAT',
        },
      }),
    expectCode(20001),
  );

  await check(
    'SC-08 后台审核提现通过',
    () =>
      req('POST', `/api/v1/admin/withdrawals/${withdrawalId}/audit`, {
        token: fresh_admin,
        body: { action: 'APPROVE', remark: '审核通过' },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { status?: string } };
      return b?.code === 0 && b.data?.status === 'APPROVED' ? true : `got ${JSON.stringify(b)}`;
    },
  );

  console.log('\n━━━━━━━━ 售后中心（阶段03） ━━━━━━━━');

  // 订单 orderId 已经 COMPLETED，用户可以提交售后
  let aftersaleId = 0;
  await check(
    'ASC-01 用户提交退款申请',
    () =>
      req('POST', '/api/v1/aftersale/refund', {
        token: userToken,
        body: {
          orderId,
          reason: '商品与描述不符',
          description: '详细描述',
          refundAmountFen: 1000,
        },
      }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { id?: number; status?: string };
      };
      if (b?.code !== 0) return `code=${b?.code}`;
      aftersaleId = b.data?.id ?? 0;
      return b.data?.status === 'PENDING_ACCEPT' ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'ASC-02 重复申请应失败（19002）',
    () =>
      req('POST', '/api/v1/aftersale/refund', {
        token: userToken,
        body: {
          orderId,
          reason: '重复',
          refundAmountFen: 100,
        },
      }),
    expectCode(19002),
  );

  await check(
    'ASC-05 平台审核退款通过',
    () =>
      req('POST', `/api/v1/admin/aftersales/${aftersaleId}/handle`, {
        token: fresh_admin,
        body: { action: 'APPROVE', remark: '同意退款' },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { status?: string } };
      return b?.code === 0 && b.data?.status === 'PENDING_REFUND'
        ? true
        : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'ASC-06 执行退款',
    () =>
      req('POST', `/api/v1/aftersale/aftersales/${aftersaleId}/refund`, {
        token: userToken,
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { refunded?: boolean } };
      return b?.code === 0 && b.data?.refunded === true ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'ASC-06 订单已退款',
    () => req('GET', `/api/v1/order/orders/${orderId}`, { token: userToken }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { status?: string; paymentStatus?: string };
      };
      return b?.code === 0 &&
        b.data?.status === 'REFUNDED' &&
        (b.data?.paymentStatus === 'PARTIAL_REFUNDED' ||
          b.data?.paymentStatus === 'FULL_REFUNDED')
        ? true
        : `got ${JSON.stringify(b.data)}`;
    },
  );

  await check(
    'ASC-11 提交投诉',
    () =>
      req('POST', '/api/v1/aftersale/complaints', {
        token: userToken,
        body: {
          orderId,
          complainantType: 'USER',
          targetType: 'MERCHANT',
          targetId: mcId,
          type: 'SERVICE_ATTITUDE',
          description: '商家态度不好',
        },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { id?: number } };
      return b?.code === 0 && typeof b.data?.id === 'number' ? true : `got ${JSON.stringify(b)}`;
    },
  );

  console.log('\n━━━━━━━━ 消息中心（阶段03） ━━━━━━━━');

  // 通过 /message/send 发消息给用户，然后验证列表/未读/已读
  let msgId = 0;
  await check(
    'MSG-01 发送消息（通过 admin 给用户）',
    () =>
      req('POST', '/api/v1/message/send', {
        token: fresh_admin,
        body: {
          targetType: 'USER',
          targetId: userId,
          type: 'SYSTEM',
          title: '冒烟测试通知',
          content: '这是一条测试消息',
        },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { id?: number } };
      if (b?.code !== 0) return `code=${b?.code}`;
      msgId = b.data?.id ?? 0;
      return msgId > 0 ? true : 'missing id';
    },
  );

  await check(
    'MSG-02 用户获取消息列表',
    () => req('GET', '/api/v1/message/messages', { token: userToken }),
    (r) => {
      const b = r.body as { code?: number; data?: { list?: Array<{ id: number }> } };
      return b?.code === 0 &&
        Array.isArray(b.data?.list) &&
        (b.data!.list!.length ?? 0) > 0
        ? true
        : `got ${JSON.stringify(b.data)}`;
    },
  );

  await check(
    'MSG-03 未读数 > 0',
    () => req('GET', '/api/v1/message/unread-count', { token: userToken }),
    (r) => {
      const b = r.body as { code?: number; data?: { unread?: number } };
      return b?.code === 0 && (b.data?.unread ?? 0) > 0 ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'MSG-04 单条标记已读',
    () => req('PATCH', `/api/v1/message/messages/${msgId}/read`, { token: userToken }),
    expectOk,
  );

  await check(
    'MSG-05 全部已读',
    () => req('PATCH', '/api/v1/message/messages/read-all', { token: userToken }),
    expectOk,
  );

  console.log('\n━━━━━━━━ 配置中心（阶段03） ━━━━━━━━');

  await check(
    'CF-01 区域列表',
    () => req('GET', '/api/v1/config/areas'),
    (r) => {
      const b = r.body as { code?: number; data?: { list?: unknown[] } };
      return b?.code === 0 && Array.isArray(b.data?.list) ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'CF-11 用户端 Banner 查询',
    () => req('GET', '/api/v1/config/banners?position=HOME'),
    (r) => {
      const b = r.body as { code?: number; data?: { list?: unknown[] } };
      return b?.code === 0 && Array.isArray(b.data?.list) ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'CF-13 获取服务类型',
    () => req('GET', '/api/v1/config/service-types'),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { list?: Array<{ code: string }> };
      };
      return b?.code === 0 &&
        (b.data?.list ?? []).some((s) => s.code === 'DELIVER')
        ? true
        : `got ${JSON.stringify(b.data)}`;
    },
  );

  console.log('\n━━━━━━━━ 优惠券（阶段03） ━━━━━━━━');

  await check(
    'CP-01 查询可领取优惠券（可能为空）',
    () => req('GET', '/api/v1/coupons/available', { token: userToken }),
    (r) => {
      const b = r.body as { code?: number; data?: { list?: unknown[] } };
      return b?.code === 0 && Array.isArray(b.data?.list) ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'CP-03 查询我的优惠券',
    () => req('GET', '/api/v1/user/coupons', { token: userToken }),
    (r) => {
      const b = r.body as { code?: number; data?: { list?: unknown[] } };
      return b?.code === 0 && Array.isArray(b.data?.list) ? true : `got ${JSON.stringify(b)}`;
    },
  );

  console.log('\n━━━━━━━━ 用户中心（阶段03） ━━━━━━━━');

  let addressId = 0;
  await check(
    'UC-01 获取地址列表（初始空）',
    () => req('GET', '/api/v1/user/addresses', { token: userToken }),
    (r) => {
      const b = r.body as { code?: number; data?: { list?: unknown[] } };
      return b?.code === 0 && Array.isArray(b.data?.list) ? true : `got ${JSON.stringify(b)}`;
    },
  );
  await check(
    'UC-02 新增地址',
    () =>
      req('POST', '/api/v1/user/addresses', {
        token: userToken,
        body: {
          contactName: '张三',
          contactPhone: '13800138000',
          province: '广东省',
          city: '深圳市',
          district: '南山区',
          address: '科技园南路XX号',
          houseNumber: 'A栋1001',
          lat: 22.5431,
          lng: 113.9472,
          tag: '公司',
          isDefault: true,
        },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { id?: number; isDefault?: boolean } };
      if (b?.code !== 0) return `code=${b?.code}`;
      if (!b.data?.id) return 'missing id';
      if (b.data.isDefault !== true) return 'isDefault != true';
      addressId = b.data.id;
      return true;
    },
  );
  await check(
    'UC-03 修改地址',
    () =>
      req('PUT', `/api/v1/user/addresses/${addressId}`, {
        token: userToken,
        body: { houseNumber: 'B栋2002' },
      }),
    (r) => {
      const b = r.body as { code?: number; data?: { houseNumber?: string } };
      return b?.code === 0 && b.data?.houseNumber === 'B栋2002' ? true : `got ${JSON.stringify(b)}`;
    },
  );
  await check(
    'UC-05 设为默认',
    () =>
      req('PATCH', `/api/v1/user/addresses/${addressId}/default`, { token: userToken }),
    expectOk,
  );
  await check(
    'UC-09 不能操作他人地址（用 riderToken 尝试）',
    () =>
      req('PUT', `/api/v1/user/addresses/${addressId}`, {
        token: riderToken,
        body: { houseNumber: 'X' },
      }),
    (r) => {
      const c = (r.body as { code?: number })?.code;
      return c === 11003 || c === 12005 ? true : `unexpected code ${c}`;
    },
  );
  await check(
    'UC-04 删除地址',
    () => req('DELETE', `/api/v1/user/addresses/${addressId}`, { token: userToken }),
    expectOk,
  );

  await check(
    'UC-07 添加收藏',
    () =>
      req('POST', '/api/v1/user/favorites', {
        token: userToken,
        body: { targetType: 'STORE', targetId: 1001 },
      }),
    (r) => {
      const c = (r.body as { code?: number })?.code;
      return c === 0 ? true : `code=${c}`;
    },
  );
  await check(
    'UC-07 获取收藏列表',
    () => req('GET', '/api/v1/user/favorites', { token: userToken }),
    (r) => {
      const b = r.body as { code?: number; data?: { list?: unknown[] } };
      return b?.code === 0 && Array.isArray(b.data?.list) && (b.data!.list!.length ?? 0) > 0
        ? true
        : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'UC-08 记录浏览',
    () =>
      req('POST', '/api/v1/user/history', {
        token: userToken,
        body: { targetType: 'PRODUCT', targetId: 2001 },
      }),
    expectOk,
  );
  await check(
    'UC-08 获取浏览历史',
    () => req('GET', '/api/v1/user/history', { token: userToken }),
    (r) => {
      const b = r.body as { code?: number; data?: { list?: unknown[] } };
      return b?.code === 0 && Array.isArray(b.data?.list) ? true : `got ${JSON.stringify(b)}`;
    },
  );

  await check(
    'UC 获取个人资料',
    () => req('GET', '/api/v1/user/profile', { token: userToken }),
    (r) => {
      const b = r.body as { code?: number; data?: { id?: number } };
      return b?.code === 0 && typeof b.data?.id === 'number' ? true : `got ${JSON.stringify(b)}`;
    },
  );

  console.log('\n━━━━━━━━ 权限隔离 ━━━━━━━━');

  await check(
    '骑手Token访问管理员接口返回11003',
    () => req('GET', '/api/v1/auth/admin/info', { token: riderToken }),
    expectCode(11003),
  );

  console.log('\n━━━━━━━━ 参数校验 ━━━━━━━━');

  await check(
    'MW-01 参数校验失败带errors[]',
    () => req('POST', '/api/v1/common/sms/send-code', { body: {} }),
    (r) => {
      const b = r.body as {
        code?: number;
        errors?: Array<{ field: string; message: string }>;
      };
      if (b?.code !== 10001) return `code=${b?.code}`;
      if (!Array.isArray(b.errors) || b.errors.length === 0) return 'missing errors[]';
      return true;
    },
  );

  console.log('\n━━━━━━━━ 登出 + 黑名单 ━━━━━━━━');

  await check(
    'AU-05 登出成功',
    () => req('POST', '/api/v1/auth/logout', { token: adminToken }),
    expectOk,
  );
  await check(
    '登出后旧Token 11002',
    () => req('GET', '/api/v1/auth/admin/info', { token: adminToken }),
    expectCode(11002),
  );
  await check(
    '登出后刷新Token 11002',
    () =>
      req('POST', '/api/v1/auth/refresh-token', {
        body: { refreshToken: adminRefresh },
      }),
    expectCode(11002),
  );

  console.log(`\n=========== RESULT ===========`);
  console.log(`PASS: ${pass}, FAIL: ${fail}`);
  if (fail > 0) {
    console.log('\n--- FAIL DETAILS ---');
    for (const f of failures) {
      console.log(`* ${f.label}: ${f.detail}`);
    }
    process.exit(1);
  }
};

runSmoke().catch((err) => {
  console.error(err);
  process.exit(1);
});
