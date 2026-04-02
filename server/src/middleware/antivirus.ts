import { Request, Response, NextFunction } from 'express';
import net from 'net';
import fs from 'fs';
import { createLogger } from '../services/logger.service';

const log = createLogger('Antivirus');

/**
 * ClamAV antivirus scanning middleware.
 *
 * Connects to the ClamAV daemon over TCP (clamd protocol) to scan uploaded files.
 * Runs after multer (files are already on disk) but before the controller.
 * If a file is infected, it is deleted immediately and the request is rejected.
 *
 * Environment variables:
 *   CLAMAV_HOST     — hostname of ClamAV daemon (default: "clamav")
 *   CLAMAV_PORT     — TCP port of ClamAV daemon (default: 3310)
 *   CLAMAV_REQUIRED — "true" = reject uploads when scanner is down (default)
 *                     "false" = log warning and allow upload through (dev mode)
 */
const CLAMAV_HOST = process.env.CLAMAV_HOST || 'clamav';
const CLAMAV_PORT = parseInt(process.env.CLAMAV_PORT || '3310');
const CLAMAV_REQUIRED = process.env.CLAMAV_REQUIRED !== 'false';

/**
 * Scan a file using the ClamAV daemon INSTREAM protocol.
 * Streams the file contents to clamd over TCP — no local clamdscan binary needed.
 */
function scanFile(filePath: string): Promise<{ clean: boolean; virus?: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let responseData = '';

    socket.setTimeout(30_000);

    socket.on('timeout', () => {
      socket.destroy();
      log.error('ClamAV scan timeout', { filePath });
      resolve(CLAMAV_REQUIRED
        ? { clean: false, virus: '__SCANNER_ERROR__' }
        : { clean: true });
    });

    socket.on('error', (err) => {
      log.error('ClamAV connection error', { filePath, error: err.message });
      resolve(CLAMAV_REQUIRED
        ? { clean: false, virus: '__SCANNER_ERROR__' }
        : { clean: true });
    });

    socket.on('data', (data) => {
      responseData += data.toString();
    });

    socket.on('end', () => {
      const response = responseData.trim();
      if (response.includes('FOUND')) {
        // e.g. "stream: Eicar-Signature FOUND"
        const match = response.match(/:\s*(.+)\s+FOUND/);
        resolve({ clean: false, virus: match?.[1]?.trim() || 'Unknown threat' });
      } else if (response.includes('OK')) {
        resolve({ clean: true });
      } else if (response.includes('INSTREAM size limit exceeded')) {
        log.error('ClamAV stream size limit exceeded — increase StreamMaxLength in clamd.conf', { filePath, response });
        resolve(CLAMAV_REQUIRED
          ? { clean: false, virus: '__SCANNER_ERROR__' }
          : { clean: true });
      } else {
        // Unexpected response
        log.error('ClamAV unexpected response', { filePath, response });
        resolve(CLAMAV_REQUIRED
          ? { clean: false, virus: '__SCANNER_ERROR__' }
          : { clean: true });
      }
    });

    socket.connect(CLAMAV_PORT, CLAMAV_HOST, () => {
      // Use INSTREAM command: send file data in chunks, then a zero-length chunk to end
      socket.write('zINSTREAM\0');

      const fileStream = fs.createReadStream(filePath);
      fileStream.on('data', (chunk: Buffer) => {
        // Each chunk: 4-byte big-endian length + data
        const lengthBuf = Buffer.alloc(4);
        lengthBuf.writeUInt32BE(chunk.length, 0);
        socket.write(lengthBuf);
        socket.write(chunk);
      });
      fileStream.on('end', () => {
        // Zero-length chunk signals end of stream
        const endBuf = Buffer.alloc(4, 0);
        socket.write(endBuf);
      });
      fileStream.on('error', (err) => {
        socket.destroy();
        log.error('File read error during scan', { filePath, error: err.message });
        resolve(CLAMAV_REQUIRED
          ? { clean: false, virus: '__SCANNER_ERROR__' }
          : { clean: true });
      });
    });
  });
}

export async function antivirusScan(req: Request, res: Response, next: NextFunction): Promise<void> {
  const files = (req.files as Express.Multer.File[] | undefined) || [];
  const singleFile = req.file as Express.Multer.File | undefined;

  const allFiles = singleFile ? [singleFile, ...files] : files;

  if (allFiles.length === 0) {
    next();
    return;
  }

  for (const file of allFiles) {
    const result = await scanFile(file.path);

    if (!result.clean) {
      // Delete the infected file immediately
      try { fs.unlinkSync(file.path); } catch { /* already gone */ }

      if (result.virus === '__SCANNER_ERROR__') {
        log.error('Upload rejected — antivirus scanner unavailable', { filename: file.originalname });
        res.status(503).json({
          error: 'File upload temporarily unavailable. Antivirus scanner is not responding. Please try again later.',
        });
        return;
      }

      log.warn('INFECTED FILE BLOCKED', {
        filename: file.originalname,
        virus: result.virus,
        size: file.size,
        mimetype: file.mimetype,
        ip: req.ip,
      });

      // Delete all other files from this request too
      for (const f of allFiles) {
        if (f.path !== file.path) {
          try { fs.unlinkSync(f.path); } catch { /* ignore */ }
        }
      }

      res.status(400).json({
        error: `File "${file.originalname}" was rejected: malware detected (${result.virus}). All files in this upload have been discarded.`,
      });
      return;
    }
  }

  // All files clean
  next();
}
