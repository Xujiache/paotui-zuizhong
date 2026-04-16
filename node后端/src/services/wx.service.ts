import https from 'https';
import config from '../config';
import logger from '../utils/logger';
import { AppError } from '../utils/AppError';
import { ErrorCode } from '../types/enums';

export interface WxCode2SessionResult {
  openid: string;
  unionid?: string;
  sessionKey: string;
}

const fetchJson = (url: string): Promise<Record<string, unknown>> =>
  new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf-8');
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', (err) => reject(err));
  });

export const code2Session = async (code: string): Promise<WxCode2SessionResult> => {
  const isMockMode =
    !config.wx.miniAppId ||
    !config.wx.miniAppSecret ||
    config.server.env === 'development';

  if (isMockMode) {
    logger.info(`[WX-MOCK] code2Session code=${code}`);
    return {
      openid: `mock_openid_${code}`,
      sessionKey: 'mock_session_key',
    };
  }

  const url =
    `https://api.weixin.qq.com/sns/jscode2session?appid=${config.wx.miniAppId}` +
    `&secret=${config.wx.miniAppSecret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;

  const data = await fetchJson(url);

  if (data.errcode && Number(data.errcode) !== 0) {
    logger.error(`微信登录失败: ${JSON.stringify(data)}`);
    throw new AppError(
      ErrorCode.USER_WX_AUTH_FAILED,
      `微信授权失败: ${data.errmsg || data.errcode}`,
      400,
    );
  }

  return {
    openid: String(data.openid || ''),
    unionid: data.unionid ? String(data.unionid) : undefined,
    sessionKey: String(data.session_key || ''),
  };
};
