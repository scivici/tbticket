import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[Error]', err.message);

  if (err.message.includes('File type') && err.message.includes('not allowed')) {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err.message === 'File too large') {
    res.status(400).json({ error: 'File exceeds maximum size of 10MB' });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}
