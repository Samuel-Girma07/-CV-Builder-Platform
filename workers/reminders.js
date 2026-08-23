const queue = require('../config/queue');
const reminderQuery = require('../models/reminderQuery');
const { sendReminderEmail } = require('../utils/email');
const { logger } = require('../middlewares/logger');

/*
  reminder.due worker.

  Jobs are enqueued with pg-boss `sendAfter` set to the reminder time, so no
  polling cron is needed. A boot-time recovery pass re-enqueues anything that
  came due while the server was down. Delivery is idempotent: markSent only
  transitions pending → sent, so duplicate jobs can never double-email.
*/
async function deliverOne(reminderId) {
  const reminder = await reminderQuery.getWithApplication(reminderId);
  if (!reminder || reminder.status !== 'pending') return; // already handled or deleted

  await sendReminderEmail(reminder.user_email, {
    jobTitle: reminder.job_title,
    company: reminder.company,
    remindAt: reminder.remind_at,
    message: reminder.message,
  });

  await reminderQuery.markSent(reminderId);
}

/* pg-boss v10 hands workers a BATCH of jobs. Each is processed
   independently; if any delivery throws, we rethrow at the end so exactly
   the failed batch retries while successful ones are already marked sent. */
async function handleReminderJobs(jobs) {
  const list = Array.isArray(jobs) ? jobs : [jobs];
  let firstError = null;
  for (const job of list) {
    const reminderId = Number(job && job.data && job.data.reminderId);
    if (!Number.isInteger(reminderId) || reminderId <= 0) {
      logger.warn(`reminder.due job had invalid payload: ${JSON.stringify(job && job.data)}`);
      continue;
    }
    try {
      await deliverOne(reminderId);
    } catch (err) {
      logger.error(`Reminder ${reminderId} delivery failed: ${err.message}`);
      if (!firstError) firstError = err;
    }
  }
  if (firstError) throw firstError;
}

async function enqueueReminder(reminderId, remindAt) {
  return queue.sendJob('reminder.due', { reminderId }, { sendAfter: new Date(remindAt) });
}

/** Re-enqueue reminders that came due while the server was offline. */
async function recoverOverdue() {
  const ids = await reminderQuery.getOverduePending();
  for (const id of ids) {
    // Fire immediately (sendAfter defaults to now).
    await enqueueReminder(id, new Date());
  }
  if (ids.length > 0) logger.info(`Re-enqueued ${ids.length} overdue reminder(s).`);
}

async function register() {
  await queue.registerWorker('reminder.due', handleReminderJobs);
  logger.info('Reminder worker registered.');
}

module.exports = { register, recoverOverdue, enqueueReminder, handleReminderJobs, deliverOne };
