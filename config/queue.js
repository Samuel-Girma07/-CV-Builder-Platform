const PgBoss = require('pg-boss');
const { logger } = require('../middlewares/logger');
const { resolveSsl } = require('./ssl');

/*
  Background job queue (pg-boss) — Postgres-backed, zero extra infrastructure.

  Owned queues. Workers are registered by feature modules at boot; jobs
  enqueued without a worker simply stay pending until one runs, so shipping
  the producer and consumer independently is always safe.
*/
const QUEUES = ['email.send', 'reminder.due', 'email.weekly-digest'];

let boss = null;
let running = false;

function connectionOptions() {
  // Mirror config/db.js via the shared SSL policy (PGSSLSTRICT /
  // PGSSLROOTCERT / sslmode-in-URL). Keep the queue lightweight.
  return {
    connectionString: process.env.DATABASE_URL,
    max: 2,
    ssl: resolveSsl(process.env.DATABASE_URL),
  };
}

/**
 * Start pg-boss against the application database. Idempotent.
 * Callers may treat failures as non-fatal: the API keeps serving and job
 * producers no-op loudly until the queue is back.
 */
async function startQueue() {
  if (running) return boss;

  boss = new PgBoss(connectionOptions());
  boss.on('error', (err) => logger.error(`pg-boss error: ${err.message}`));

  await boss.start();
  for (const name of QUEUES) {
    try {
      await boss.createQueue(name);
    } catch (err) {
      if (!/already exists/i.test(err.message)) throw err;
    }
  }

  running = true;
  logger.info(`Background job queue started (queues: ${QUEUES.join(', ')})`);
  return boss;
}

/**
 * Enqueue a job. Returns null (with a loud warning) when the queue never
 * started, so callers can fire-and-forget without try/catch ceremony.
 */
async function sendJob(queue, data, options = {}) {
  if (!running || !boss) {
    logger.warn(`Job queue unavailable: dropped '${queue}' job.`);
    return null;
  }
  return boss.send(queue, data, options);
}

/** Register a recurring schedule (standard cron syntax). */
async function scheduleJob(queue, cron, data = null) {
  if (!running || !boss) {
    logger.warn(`Job queue unavailable: skipped scheduling '${queue}'.`);
    return null;
  }
  return boss.schedule(queue, cron, data);
}

/** Attach a worker to a queue; resolves with a work handle. */
async function registerWorker(queue, handler, options = {}) {
  if (!running || !boss) {
    throw new Error('Job queue is not running');
  }
  return boss.work(queue, options, handler);
}

/** Stop accepting new work and let in-flight jobs finish. */
async function stopQueue() {
  if (!running || !boss) return;
  try {
    await boss.stop();
    logger.info('Background job queue stopped.');
  } finally {
    running = false;
    boss = null;
  }
}

module.exports = { QUEUES, startQueue, stopQueue, sendJob, scheduleJob, registerWorker };
