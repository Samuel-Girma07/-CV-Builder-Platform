const queue = require('../config/queue');
const pool = require('../config/db');
const { sendDigestEmail } = require('../utils/email');
const { logger } = require('../middlewares/logger');

// Mondays 09:00 in the server's timezone.
const DIGEST_CRON = '0 9 * * 1';

async function getOptedInUsers() {
  const result = await pool.query(
    `SELECT id, email FROM users WHERE digest_opt_in = true`
  );
  return result.rows;
}

async function getUserStats(userId) {
  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'Applied')::int AS applied,
       COUNT(*) FILTER (WHERE status = 'Interviewing')::int AS interviewing,
       COUNT(*) FILTER (WHERE status = 'Offered/Hired')::int AS offered,
       COUNT(*) FILTER (WHERE status = 'Rejected')::int AS rejected,
       COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS recent
     FROM applications WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  const row = result.rows[0] || {};
  const reminders = await pool.query(
    `SELECT COUNT(*)::int AS n FROM reminders WHERE user_id = $1 AND status = 'pending'`,
    [userId]
  );
  return {
    applied: Number(row.applied || 0),
    interviewing: Number(row.interviewing || 0),
    offered: Number(row.offered || 0),
    rejected: Number(row.rejected || 0),
    recent: Number(row.recent || 0),
    pendingReminders: Number(reminders.rows[0].n || 0),
  };
}

/**
 * One scheduled tick fans out to every opted-in user. A failure for one user
 * is logged and swallowed so a single bad mailbox cannot skip the rest.
 */
async function handleDigestTick() {
  const users = await getOptedInUsers();
  logger.info(`Weekly digest tick: ${users.length} opted-in user(s).`);
  for (const user of users) {
    try {
      const stats = await getUserStats(user.id);
      await sendDigestEmail(user.email, stats);
    } catch (err) {
      logger.error(`Digest failed for user ${user.id}: ${err.message}`);
    }
  }
}

async function registerSchedule() {
  await queue.registerWorker('email.weekly-digest', handleDigestTick);
  // schedule() is idempotent per (queue, cron) key in pg-boss v10.
  await queue.scheduleJob('email.weekly-digest', DIGEST_CRON, null);
  logger.info(`Weekly digest scheduled (${DIGEST_CRON}).`);
}

module.exports = { registerSchedule, handleDigestTick, getOptedInUsers, getUserStats, DIGEST_CRON };
