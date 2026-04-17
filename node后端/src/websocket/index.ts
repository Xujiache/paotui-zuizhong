/**
 * WebSocket 服务
 *
 * 连接流程：
 *   1) 客户端升级到 ws://host/ws?token=<JWT>
 *   2) 服务端校验 JWT，拒绝未登录或已拉黑的 Token
 *   3) 将连接登记到 `<role>:<userId>` 映射中，同一账号允许多连接（多设备）
 *   4) 30s 心跳保活，回收已死连接
 *
 * 协议（服务端 → 客户端 JSON 帧）：
 *   { "type": "order.status_changed", "data": { orderId, status, ... }, "ts": 1700000000 }
 *
 * 客户端 → 服务端仅支持 ping（收到会回 pong），业务流转走 REST API。
 */

import { IncomingMessage, Server as HttpServer } from 'http';
import { URL } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import { verifyAccessToken } from '../utils/jwt';
import { redis } from '../utils/redis';
import logger from '../utils/logger';
import { UserRole } from '../types/enums';

export type WsRole = 'USER' | 'MERCHANT' | 'RIDER' | 'ADMIN';

interface AuthenticatedSocket extends WebSocket {
  userId: number;
  role: WsRole;
  clientType?: string;
  alive: boolean;
}

const HEARTBEAT_INTERVAL_MS = 30_000;
const SUPPORTED_ROLES: Set<string> = new Set([
  UserRole.USER,
  UserRole.MERCHANT,
  UserRole.RIDER,
  UserRole.ADMIN,
]);

/** key=`${role}:${userId}`，value=连接集合（多端同账号时会有多个） */
const connections = new Map<string, Set<AuthenticatedSocket>>();

let wss: WebSocketServer | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;

const buildKey = (role: WsRole, userId: number): string => `${role}:${userId}`;

const extractToken = (req: IncomingMessage): string | null => {
  try {
    const host = req.headers.host ?? 'localhost';
    const url = new URL(req.url ?? '/', `http://${host}`);
    const queryToken = url.searchParams.get('token');
    if (queryToken) return queryToken;
    const header = req.headers['authorization'];
    if (typeof header === 'string') {
      return header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim();
    }
  } catch {
    /* ignore */
  }
  return null;
};

const registerConnection = (socket: AuthenticatedSocket): void => {
  const key = buildKey(socket.role, socket.userId);
  let set = connections.get(key);
  if (!set) {
    set = new Set();
    connections.set(key, set);
  }
  set.add(socket);
};

const unregisterConnection = (socket: AuthenticatedSocket): void => {
  const key = buildKey(socket.role, socket.userId);
  const set = connections.get(key);
  if (!set) return;
  set.delete(socket);
  if (set.size === 0) connections.delete(key);
};

/** 取出指定身份的所有活跃连接（只读，外部不应修改集合） */
export const getConnectionsFor = (role: WsRole, userId: number): AuthenticatedSocket[] => {
  const set = connections.get(buildKey(role, userId));
  if (!set) return [];
  return Array.from(set).filter((s) => s.readyState === WebSocket.OPEN);
};

export const countActiveConnections = (): number => {
  let n = 0;
  for (const set of connections.values()) {
    for (const s of set) {
      if (s.readyState === WebSocket.OPEN) n++;
    }
  }
  return n;
};

const sendSafe = (socket: WebSocket, payload: string): void => {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(payload, (err) => {
    if (err) {
      logger.warn(`[WS] send 失败: ${err.message}`);
    }
  });
};

/** 向指定身份推送（多设备时全部命中） */
export const pushTo = (role: WsRole, userId: number, type: string, data: unknown): number => {
  const sockets = getConnectionsFor(role, userId);
  if (sockets.length === 0) return 0;
  const frame = JSON.stringify({ type, data, ts: Math.floor(Date.now() / 1000) });
  for (const s of sockets) sendSafe(s, frame);
  return sockets.length;
};

/** 按角色广播（开发/运营用途，慎用） */
export const broadcastRole = (role: WsRole, type: string, data: unknown): number => {
  let count = 0;
  const frame = JSON.stringify({ type, data, ts: Math.floor(Date.now() / 1000) });
  for (const [key, set] of connections.entries()) {
    if (!key.startsWith(`${role}:`)) continue;
    for (const s of set) {
      if (s.readyState === WebSocket.OPEN) {
        sendSafe(s, frame);
        count++;
      }
    }
  }
  return count;
};

const startHeartbeat = (server: WebSocketServer): void => {
  heartbeatTimer = setInterval(() => {
    for (const client of server.clients) {
      const s = client as AuthenticatedSocket;
      if (!s.alive) {
        try {
          s.terminate();
        } catch {
          /* ignore */
        }
        continue;
      }
      s.alive = false;
      try {
        s.ping();
      } catch {
        /* ignore */
      }
    }
  }, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref?.();
};

const handleConnection = (socket: AuthenticatedSocket): void => {
  socket.alive = true;
  registerConnection(socket);

  socket.on('pong', () => {
    socket.alive = true;
  });

  socket.on('message', (raw) => {
    // 仅支持客户端主动 ping 保活；业务写操作一律走 REST
    try {
      const text = raw.toString();
      if (!text) return;
      const msg = JSON.parse(text) as { type?: string };
      if (msg.type === 'ping') {
        sendSafe(socket, JSON.stringify({ type: 'pong', ts: Math.floor(Date.now() / 1000) }));
      }
    } catch {
      /* 忽略非法帧 */
    }
  });

  socket.on('close', () => {
    unregisterConnection(socket);
  });

  socket.on('error', (err) => {
    logger.warn(`[WS] 连接异常 role=${socket.role} uid=${socket.userId}: ${err.message}`);
  });

  sendSafe(
    socket,
    JSON.stringify({ type: 'connected', data: { role: socket.role }, ts: Math.floor(Date.now() / 1000) }),
  );
};

export const setupWebSocket = (httpServer: HttpServer, path = '/ws'): WebSocketServer => {
  if (wss) return wss;

  wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', async (req, socket, head) => {
    try {
      const host = req.headers.host ?? 'localhost';
      const requestUrl = new URL(req.url ?? '/', `http://${host}`);
      if (requestUrl.pathname !== path) {
        socket.destroy();
        return;
      }

      const token = extractToken(req);
      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      if (await redis.isBlacklisted(token)) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const payload = verifyAccessToken(token);
      if (!payload || !SUPPORTED_ROLES.has(payload.role)) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss!.handleUpgrade(req, socket, head, (ws) => {
        const authed = ws as AuthenticatedSocket;
        authed.userId = payload.userId;
        authed.role = payload.role as WsRole;
        authed.clientType = payload.clientType;
        wss!.emit('connection', authed, req);
      });
    } catch (err) {
      logger.error(`[WS] upgrade 异常: ${(err as Error).message}`);
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
    }
  });

  wss.on('connection', (socket) => handleConnection(socket as AuthenticatedSocket));

  startHeartbeat(wss);

  logger.info(`[WS] WebSocket 服务已挂载：${path}`);
  return wss;
};

export const closeWebSocket = async (): Promise<void> => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (!wss) return;
  await new Promise<void>((resolve) => {
    for (const client of wss!.clients) {
      try {
        client.close(1001, 'server shutdown');
      } catch {
        /* ignore */
      }
    }
    wss!.close(() => resolve());
  });
  wss = null;
  connections.clear();
  logger.info('[WS] WebSocket 服务已关闭');
};

export default { setupWebSocket, closeWebSocket, pushTo, broadcastRole, countActiveConnections };
