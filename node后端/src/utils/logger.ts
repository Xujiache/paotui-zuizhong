import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import config from '../config';

const logDir = path.resolve(config.log.dir);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    const text = stack ? `${message}\n${stack}` : message;
    return `${timestamp} [${level.toUpperCase()}]: ${text}${metaStr}`;
  }),
);

const createFileTransport = (level: string): DailyRotateFile => {
  const levelDir = path.join(logDir, level);
  if (!fs.existsSync(levelDir)) {
    fs.mkdirSync(levelDir, { recursive: true });
  }
  return new DailyRotateFile({
    dirname: levelDir,
    filename: '%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level,
    maxSize: '20m',
    maxFiles: '14d',
    zippedArchive: true,
  });
};

const logger = winston.createLogger({
  level: config.log.level,
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), logFormat),
    }),
    createFileTransport('error'),
    createFileTransport('warn'),
    createFileTransport('info'),
    new DailyRotateFile({
      dirname: logDir,
      filename: 'combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
    }),
  ],
  exitOnError: false,
});

export default logger;
