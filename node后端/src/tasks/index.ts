/**
 * 定时任务总入口
 *
 * 所有任务都由 node-cron 调度，所有任务互斥（单实例避免同一任务重入）。
 * 任务列表：
 *   - paymentTimeout       每分钟     关闭支付超时订单（15min）
 *   - merchantTimeout      每分钟     商家接单超时自动退款（5min）
 *   - autoConfirm          每 15 分钟 自动确认收货（24h）
 *   - dispatchExtend       每 2 分钟  调度扩圈提醒（5min 仍无人接）
 *
 * 通过环境变量 TASKS_ENABLED=false 可以完全关闭调度（常用于测试/CI）。
 */

import cron, { ScheduledTask } from 'node-cron';
import logger from '../utils/logger';
import { runPaymentTimeoutTask } from './paymentTimeout.task';
import { runMerchantTimeoutTask } from './merchantTimeout.task';
import { runAutoConfirmTask } from './autoConfirm.task';
import { runDispatchExtendTask } from './dispatchExtend.task';

interface TaskDefinition {
  name: string;
  schedule: string;
  runner: () => Promise<number>;
}

const TASKS: TaskDefinition[] = [
  { name: 'paymentTimeout', schedule: '*/1 * * * *', runner: runPaymentTimeoutTask },
  { name: 'merchantTimeout', schedule: '*/1 * * * *', runner: runMerchantTimeoutTask },
  { name: 'autoConfirm', schedule: '*/15 * * * *', runner: runAutoConfirmTask },
  { name: 'dispatchExtend', schedule: '*/2 * * * *', runner: runDispatchExtendTask },
];

const scheduledTasks: ScheduledTask[] = [];
const busy = new Set<string>();

const isEnabled = (): boolean => {
  const raw = process.env.TASKS_ENABLED;
  if (raw === undefined || raw === '') return true;
  return raw.toLowerCase() !== 'false';
};

const wrap = (def: TaskDefinition): (() => Promise<void>) => {
  return async () => {
    if (busy.has(def.name)) {
      logger.warn(`[tasks/${def.name}] 上一轮仍在执行，跳过本轮`);
      return;
    }
    busy.add(def.name);
    const start = Date.now();
    try {
      const n = await def.runner();
      const cost = Date.now() - start;
      if (n > 0) {
        logger.info(`[tasks/${def.name}] 完成 affected=${n} 耗时=${cost}ms`);
      }
    } catch (err) {
      logger.error(`[tasks/${def.name}] 异常: ${(err as Error).message}`);
    } finally {
      busy.delete(def.name);
    }
  };
};

export const startTasks = (): void => {
  if (!isEnabled()) {
    logger.info('[tasks] TASKS_ENABLED=false，定时任务不启动');
    return;
  }
  if (scheduledTasks.length > 0) {
    logger.warn('[tasks] 已启动，跳过重复注册');
    return;
  }
  for (const def of TASKS) {
    const task = cron.schedule(def.schedule, wrap(def), {
      scheduled: true,
      timezone: 'Asia/Shanghai',
    });
    scheduledTasks.push(task);
    logger.info(`[tasks] 已注册 ${def.name} @ ${def.schedule}`);
  }
};

export const stopTasks = (): void => {
  for (const t of scheduledTasks) {
    try {
      t.stop();
    } catch {
      /* ignore */
    }
  }
  scheduledTasks.length = 0;
  logger.info('[tasks] 所有定时任务已停止');
};

/**
 * 按名字手动触发一次任务（供测试/管理后台按钮使用）
 */
export const runTaskOnce = async (name: string): Promise<number> => {
  const def = TASKS.find((t) => t.name === name);
  if (!def) throw new Error(`未知任务：${name}`);
  return def.runner();
};

export default { startTasks, stopTasks, runTaskOnce };
