require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const { logger, requestLogger } = require('./middlewares/logger');

const app = express();
const PORT = process.env.PORT || 3000;

const requiredEnv = ['DATABASE_URL', 'JWT_SECRET', 'NVIDIA_API_KEY'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  logger.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const interviewRoutes = require('./routes/interviewRoutes');
const xrayRoutes = require('./routes/xrayRoutes');

app.use(helmet());
app.use(cors({ origin: 'http://localhost:3000' }));
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
app.use('/api/interviews', interviewRoutes);
app.use('/api/xray', xrayRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found.' });
});

app.get('*', (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  logger.error(`Server error on ${req.method} ${req.originalUrl}: ${err.stack || err.message}`);

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

app.listen(PORT, () => {
  logger.info(`CV Builder API and client running at http://localhost:${PORT}`);
});
