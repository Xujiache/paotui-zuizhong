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
  await check(
    'UL-01 微信登录(新用户)',
    () =>
      req('POST', '/api/v1/auth/user/wx-login', {
        body: { code: `smoke_${Date.now()}` },
      }),
    (r) => {
      const b = r.body as {
        code?: number;
        data?: { accessToken?: string; isNewUser?: boolean; hasPhone?: boolean };
      };
      if (b?.code !== 0) return `code=${b?.code}`;
      if (!b.data?.accessToken) return 'missing accessToken';
      if (!b.data?.isNewUser) return 'isNewUser != true';
      if (b.data?.hasPhone !== false) return 'hasPhone should be false';
      userToken = b.data.accessToken;
      return true;
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

  console.log(`\n━━━━━━━━ 结果 ━━━━━━━━`);
  console.log(`通过: ${pass}, 失败: ${fail}`);
  if (fail > 0) {
    console.log('\n失败详情:');
    for (const f of failures) {
      console.log(`  • ${f.label}: ${f.detail}`);
    }
    process.exit(1);
  }
};

runSmoke().catch((err) => {
  console.error(err);
  process.exit(1);
});
