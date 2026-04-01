import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { createLogger } from '../services/logger.service';

const log = createLogger('Upload');

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

/**
 * Magic bytes signatures for file type verification.
 * After multer writes the file to disk, we read the first bytes to verify
 * the actual file type matches what the extension/MIME claims.
 * This prevents disguised executables (e.g. malware.exe renamed to report.log).
 */
const MAGIC_SIGNATURES: { ext: string[]; mime: string[]; magic: Buffer; offset?: number }[] = [
  // Images
  { ext: ['.jpg', '.jpeg'], mime: ['image/jpeg'], magic: Buffer.from([0xFF, 0xD8, 0xFF]) },
  { ext: ['.png'], mime: ['image/png'], magic: Buffer.from([0x89, 0x50, 0x4E, 0x47]) },
  { ext: ['.gif'], mime: ['image/gif'], magic: Buffer.from('GIF8') },
  { ext: ['.webp'], mime: ['image/webp'], magic: Buffer.from('RIFF'), /* WEBP at offset 8 */ },
  // Archives
  { ext: ['.zip'], mime: ['application/zip', 'application/x-zip-compressed'], magic: Buffer.from([0x50, 0x4B, 0x03, 0x04]) },
  { ext: ['.gz', '.tgz'], mime: ['application/gzip', 'application/x-gzip'], magic: Buffer.from([0x1F, 0x8B]) },
  { ext: ['.7z'], mime: ['application/x-7z-compressed'], magic: Buffer.from([0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]) },
  { ext: ['.rar'], mime: ['application/x-rar-compressed'], magic: Buffer.from('Rar!') },
  { ext: ['.tar'], mime: ['application/x-tar'], magic: Buffer.from('ustar'), offset: 257 },
  // Documents
  { ext: ['.pdf'], mime: ['application/pdf'], magic: Buffer.from('%PDF') },
  { ext: ['.xls', '.xlsx'], mime: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], magic: Buffer.from([0x50, 0x4B, 0x03, 0x04]) }, // OOXML is ZIP-based
  // Network captures (pcap)
  { ext: ['.pcap'], mime: ['application/vnd.tcpdump.pcap'], magic: Buffer.from([0xD4, 0xC3, 0xB2, 0xA1]) }, // Little-endian
  { ext: ['.pcap'], mime: ['application/vnd.tcpdump.pcap'], magic: Buffer.from([0xA1, 0xB2, 0xC3, 0xD4]) }, // Big-endian
  { ext: ['.pcapng'], mime: ['application/vnd.tcpdump.pcap'], magic: Buffer.from([0x0A, 0x0D, 0x0D, 0x0A]) }, // Section Header Block
];

/**
 * Dangerous file signatures that should ALWAYS be rejected,
 * regardless of extension or MIME type.
 */
const DANGEROUS_SIGNATURES: { name: string; magic: Buffer; offset?: number }[] = [
  { name: 'Windows EXE/DLL (MZ)', magic: Buffer.from([0x4D, 0x5A]) },                  // MZ header
  { name: 'ELF executable', magic: Buffer.from([0x7F, 0x45, 0x4C, 0x46]) },            // \x7FELF
  { name: 'Mach-O binary', magic: Buffer.from([0xCF, 0xFA, 0xED, 0xFE]) },             // macOS binary
  { name: 'Java class file', magic: Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]) },           // .class
  { name: 'Windows shortcut (LNK)', magic: Buffer.from([0x4C, 0x00, 0x00, 0x00]) },    // .lnk
  { name: 'Microsoft Installer (MSI)', magic: Buffer.from([0xD0, 0xCF, 0x11, 0xE0]) }, // OLE2 (also .doc but we don't allow those)
];

/**
 * Read the first N bytes of a file to check magic bytes.
 */
function readFileHeader(filePath: string, bytes: number = 300): Buffer {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(bytes);
  fs.readSync(fd, buf, 0, bytes, 0);
  fs.closeSync(fd);
  return buf;
}

/**
 * Check if a buffer starts with the given magic bytes at the specified offset.
 */
function matchesMagic(header: Buffer, magic: Buffer, offset: number = 0): boolean {
  if (header.length < offset + magic.length) return false;
  return header.subarray(offset, offset + magic.length).equals(magic);
}

// MIME types allowed by the upload filter.
// NOTE: application/octet-stream is intentionally EXCLUDED — it allows anything through.
// Files that browsers send as octet-stream (e.g. .pcap) are still accepted via extension matching.
const allowedTypes = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'text/plain', 'text/csv', 'text/log', 'text/xml',
  'application/json', 'application/xml',
  'application/zip', 'application/x-zip-compressed',
  'application/gzip', 'application/x-gzip', 'application/x-tar',
  'application/x-compressed', 'application/x-7z-compressed',
  'application/vnd.tcpdump.pcap',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const allowedExtensions = ['.log', '.cfg', '.conf', '.pcap', '.pcapng', '.cap',
  '.gz', '.tgz', '.tar', '.7z', '.rar', '.csv', '.xml', '.yaml', '.yml',
  '.ini', '.txt', '.md', '.sip', '.sdp', '.xls', '.xlsx'];

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  const baseName = path.basename(file.originalname).toLowerCase();

  // HTML files: only allow if filename starts with "call_trace" (e.g. call_trace_0xA4D4CC8C.html)
  if (ext === '.html' || ext === '.htm') {
    if (baseName.startsWith('call_trace')) {
      cb(null, true);
    } else {
      cb(new Error('HTML files are only allowed for call trace exports (filename must start with "call_trace")'));
    }
    return;
  }

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

/**
 * Post-upload magic bytes validation middleware.
 * Runs AFTER multer writes files to disk but BEFORE the controller processes them.
 * - Rejects files with dangerous binary signatures (EXE, ELF, etc.)
 * - For binary files with known magic bytes, verifies the content matches the claimed type
 * - Text-based files (.log, .cfg, .txt, .csv, etc.) are allowed without magic check
 */
export async function validateFileContent(req: Request, res: Response, next: NextFunction): Promise<void> {
  const files = (req.files as Express.Multer.File[] | undefined) || [];
  const singleFile = req.file as Express.Multer.File | undefined;
  const allFiles = singleFile ? [singleFile, ...files] : files;

  if (allFiles.length === 0) {
    next();
    return;
  }

  // Extensions considered text-based — no magic bytes to verify, just check for dangerous signatures
  const textExtensions = new Set(['.log', '.cfg', '.conf', '.csv', '.xml', '.yaml', '.yml',
    '.ini', '.txt', '.md', '.sip', '.sdp', '.json', '.svg', '.html', '.htm']);

  for (const file of allFiles) {
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

    let header: Buffer;
    try {
      header = readFileHeader(file.path);
    } catch {
      // Can't read file — reject
      deleteFiles(allFiles);
      res.status(400).json({ error: `Could not validate file "${file.originalname}"` });
      return;
    }

    // Step 1: ALWAYS reject dangerous binary signatures
    for (const sig of DANGEROUS_SIGNATURES) {
      if (matchesMagic(header, sig.magic, sig.offset || 0)) {
        log.warn('DANGEROUS FILE BLOCKED', {
          filename: file.originalname,
          detectedType: sig.name,
          mimetype: file.mimetype,
          ext,
          ip: (req as any).ip,
        });
        deleteFiles(allFiles);
        res.status(400).json({
          error: `File "${file.originalname}" rejected: detected as ${sig.name}. Executable files are not allowed.`,
        });
        return;
      }
    }

    // Step 2: For binary files, verify magic bytes match the claimed type
    if (!textExtensions.has(ext)) {
      const expectedSigs = MAGIC_SIGNATURES.filter(s => s.ext.includes(ext) || s.mime.includes(file.mimetype));

      if (expectedSigs.length > 0) {
        const matches = expectedSigs.some(s => matchesMagic(header, s.magic, s.offset || 0));
        if (!matches) {
          log.warn('FILE TYPE MISMATCH', {
            filename: file.originalname,
            claimedExt: ext,
            claimedMime: file.mimetype,
            headerHex: header.subarray(0, 16).toString('hex'),
            ip: (req as any).ip,
          });
          deleteFiles(allFiles);
          res.status(400).json({
            error: `File "${file.originalname}" content does not match its file type (${ext}). The file may be corrupted or disguised.`,
          });
          return;
        }
      }
    }
  }

  next();
}

/**
 * Delete all files from a failed upload batch.
 */
function deleteFiles(files: Express.Multer.File[]) {
  for (const f of files) {
    try { fs.unlinkSync(f.path); } catch { /* ignore */ }
  }
}
