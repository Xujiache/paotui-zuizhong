import fs from 'fs';
import path from 'path';
import multer from 'multer';
import crypto from 'crypto';
import config from '../config';
import { AppError } from '../utils/AppError';
import { ErrorCode } from '../types/enums';

const resolveUploadRoot = (): string => {
  const root = path.isAbsolute(config.upload.dir)
    ? config.upload.dir
    : path.resolve(process.cwd(), config.upload.dir);
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  return root;
};

export const UPLOAD_ROOT = resolveUploadRoot();

const buildDayDir = (): { absDir: string; relDir: string } => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const rel = `${year}${month}${day}`;
  const abs = path.join(UPLOAD_ROOT, rel);
  if (!fs.existsSync(abs)) {
    fs.mkdirSync(abs, { recursive: true });
  }
  return { absDir: abs, relDir: rel };
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, buildDayDir().absDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    const name = crypto.randomBytes(8).toString('hex');
    cb(null, `${name}${ext}`);
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (!config.upload.allowedTypes.includes(file.mimetype)) {
    cb(new AppError(ErrorCode.PARAM_INVALID, `不支持的文件类型: ${file.mimetype}`, 400));
    return;
  }
  cb(null, true);
};

export const uploader = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxSize },
});

export const buildPublicUrl = (file: Express.Multer.File): string => {
  const abs = file.path;
  const rel = path.relative(UPLOAD_ROOT, abs).replace(/\\/g, '/');
  const prefix = config.upload.urlPrefix.replace(/\/$/, '');
  return `${prefix}/${rel}`;
};

export const formatUploadResult = (file: Express.Multer.File) => ({
  url: buildPublicUrl(file),
  filename: file.filename,
  size: file.size,
  mimeType: file.mimetype,
});
