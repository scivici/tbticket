import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { runMigrations } from './db/migrate';
import { errorHandler } from './middleware/error';

import authRoutes from './routes/auth.routes';
import productsRoutes from './routes/products.routes';
import ticketsRoutes from './routes/tickets.routes';
import engineersRoutes from './routes/engineers.routes';
import adminRoutes from './routes/admin.routes';
import adminManageRoutes from './routes/admin-manage.routes';
import adminUsersRoutes from './routes/admin-users.routes';
import notificationsRoutes from './routes/notifications.routes';

const app = express();

// Middleware
app.use(cors({
  origin: (_origin, callback) => {
    // Allow all origins when serving client from same server (production)
    // or match configured origin (development with separate Vite server)
    callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
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
runMigrations();

app.listen(config.port, '0.0.0.0', () => {
  console.log(`[Server] Running on http://localhost:${config.port}`);
  console.log(`[Server] Claude server: ${config.claudeServerUrl}`);
  if (fs.existsSync(clientDist)) {
    console.log(`[Server] Serving client from ${clientDist}`);
  }
});

export default app;
