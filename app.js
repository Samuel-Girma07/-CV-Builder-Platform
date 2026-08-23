require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const { logger, requestLogger } = require('./middlewares/logger');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

const requiredEnv = ['DATABASE_URL', 'JWT_SECRET', 'NVIDIA_API_KEY'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  logger.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

// Password recovery silently no-ops without an email provider. That is an
// acceptable demo mode but must never happen unnoticed in production.
if (process.env.NODE_ENV === 'production' && !process.env.RESEND_API_KEY) {
  logger.error(
    'RESEND_API_KEY is NOT configured in production: password recovery emails cannot be delivered and users will be locked out of reset flows.'
  );
}

// A short JWT secret makes session tokens forgeable by brute force. Fail at
// boot with instructions rather than running insecurely.
if (process.env.JWT_SECRET.length < 32) {
  logger.error('JWT_SECRET must be at least 32 characters. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  process.exit(1);
}

const pool = require('./config/db');
async function runStartupMigration() {
  try {
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;
    `);
    logger.info('Database startup migration completed (reset_token columns ensured).');
  } catch (err) {
    logger.error('Database startup migration failed:', err);
  }
}
runStartupMigration();

// Background job queue (pg-boss). Non-fatal: if it cannot start, the API
// keeps serving and job producers no-op loudly instead of crashing.
const { startQueue, stopQueue } = require('./config/queue');
startQueue().catch((err) => {
  logger.error(`Background job queue failed to start: ${err.message}`);
});

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const insightRoutes = require('./routes/insightRoutes');
const interviewRoutes = require('./routes/interviewRoutes');
const xrayRoutes = require('./routes/xrayRoutes');

app.use(helmet());
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(requestLogger);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'cv-builder-platform',
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/insights', insightRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/xray', xrayRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found.' });
});

app.get('*', (req, res) => {
  // Requests that look like files (missing assets, stale URLs, scanners)
  // must not receive the SPA shell with a misleading 200 — only clean,
  // extension-less client routes fall through to index.html.
  if (path.extname(req.path)) {
    return res.status(404).json({ error: 'Not found.' });
  }
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  logger.error(`Server error on ${req.method} ${req.baseUrl || ''}${req.path}: ${err.stack || err.message}`);

  if (res.headersSent) {
    return next(err);
  }

  if (err.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 5MB.' });
  }

  const status = err.status || err.statusCode || 500;
  const message = err.status ? err.message : 'Something went wrong on the server.';
  return res.status(status).json({ error: message });
});

const server = app.listen(PORT, () => {
  logger.info(`CV Builder API and client running at http://localhost:${PORT}`);
});

/* Graceful shutdown: stop accepting connections, let in-flight requests
   finish, then close the Postgres pool before exiting. Prevents Render-style
   restarts from dropping active requests or leaking pool clients. */
function shutdown(signal) {
  logger.info(`${signal} received: draining connections and closing the database pool...`);
  server.close(async () => {
    try {
      await stopQueue();
    } catch (err) {
      logger.error(`Queue shutdown error: ${err.message}`);
    }
    try {
      await pool.end();
    } finally {
      process.exit(0);
    }
  });
  // Hard exit if draining stalls (e.g. a hung socket).
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
