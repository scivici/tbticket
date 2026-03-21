import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'text/plain', 'text/csv', 'text/log', 'text/xml',
    'application/json', 'application/xml',
    'application/zip', 'application/x-zip-compressed',
    'application/gzip', 'application/x-gzip', 'application/x-tar',
    'application/x-compressed', 'application/x-7z-compressed',
    'application/octet-stream',
    'application/vnd.tcpdump.pcap',
  ];

  const allowedExtensions = ['.log', '.cfg', '.conf', '.pcap', '.pcapng', '.cap',
    '.gz', '.tgz', '.tar', '.7z', '.rar', '.csv', '.xml', '.yaml', '.yml',
    '.ini', '.txt', '.md', '.sip', '.sdp'];

  const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} (${ext}) not allowed`));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSize,
    files: config.maxFiles,
  },
});
