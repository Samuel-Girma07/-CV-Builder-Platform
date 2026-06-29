const fs = require('fs');
const path = require('path');

// Application logging: leveled output to the console and an appended log file.
// Kept intentionally small and dependency-free so every line is explainable.

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function write(level, message) {
  const line = `${new Date().toISOString()} [${level}] ${message}`;

  if (level === 'ERROR') {
    console.error(line);
  } else if (level === 'WARN') {
    console.warn(line);
  } else {
    console.log(line);
  }

  // Append asynchronously so logging never blocks the request cycle.
  fs.appendFile(LOG_FILE, `${line}\n`, (err) => {
    if (err) {
      console.error('Failed to write log file:', err.message);
    }
  });
}

const logger = {
  info: (message) => write('INFO', message),
  warn: (message) => write('WARN', message),
  error: (message) => write('ERROR', message),
};

// Express middleware: logs method, path, status, and duration per request.
function requestLogger(req, res, next) {
  const startedAt = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startedAt;
    const level = res.statusCode >= 500 ? 'ERROR' : 'INFO';
    write(level, `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
}

module.exports = { logger, requestLogger };
