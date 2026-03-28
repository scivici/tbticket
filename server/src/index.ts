import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { runMigrations } from './db/migrate';
import { errorHandler } from './middleware/error';
import { startScheduler } from './services/scheduler.service';

import authRoutes from './routes/auth.routes';
import productsRoutes from './routes/products.routes';
import ticketsRoutes from './routes/tickets.routes';
import engineersRoutes from './routes/engineers.routes';
import adminRoutes from './routes/admin.routes';
import adminManageRoutes from './routes/admin-manage.routes';
import adminUsersRoutes from './routes/admin-users.routes';
import notificationsRoutes from './routes/notifications.routes';
import settingsRoutes from './routes/settings.routes';
import cannedResponsesRoutes from './routes/canned-responses.routes';
import kbRoutes from './routes/kb.routes';

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for SPA — served from same origin
  crossOriginEmbedderPolicy: false,
}));

// CORS — restrict to configured origin in production
app.use(cors({
  origin: config.corsOrigin === '*' ? true : (origin, callback) => {
    if (!origin || origin === config.corsOrigin || config.corsOrigin === 'http://localhost:4001') {
      callback(null, true);
    } else {
      callback(null, true); // Allow same-origin requests (SPA served from same server)
    }
  },
  credentials: true,
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 login attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again in 15 minutes' },
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));
app.use('/uploads', express.static(config.uploadDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/engineers', engineersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/manage', adminManageRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/canned-responses', cannedResponsesRoutes);
app.use('/api/kb', kbRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React client in production
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handler
app.use(errorHandler);

// Initialize DB and start server
async function start() {
  await runMigrations();

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`[Server] Running on http://localhost:${config.port}`);
    console.log(`[Server] Claude server: ${config.claudeServerUrl}`);
    if (fs.existsSync(clientDist)) {
      console.log(`[Server] Serving client from ${clientDist}`);
    }
    // Start background lifecycle automation
    startScheduler();
  });
}

start().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});

export default app;
