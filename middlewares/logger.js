const fs = require('fs');
const path = require('path');

// Application logging: leveled output to the console and an appended log file.
// Kept intentionally small and dependency-free so every line is explainable.

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

// Size-based single-generation rotation: app.log -> app.log.1 when the
// active file exceeds 5MB, so the log can never grow without bound.
const MAX_LOG_BYTES = 5 * 1024 * 1024;

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function rotateIfNeeded() {
  try {
    const stat = fs.statSync(LOG_FILE);
    if (stat.size > MAX_LOG_BYTES) {
      fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
    }
  } catch (err) {
    // File does not exist yet (or is momentarily locked) — nothing to rotate.
  }
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

  rotateIfNeeded();

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
    // Path only: query strings can carry one-time tickets or credentials.
    write(level, `${req.method} ${req.baseUrl || ''}${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
}

module.exports = { logger, requestLogger };
