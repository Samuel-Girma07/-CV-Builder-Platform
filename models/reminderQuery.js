const pool = require('../config/db');

const REMINDER_STATUSES = ['pending', 'sent', 'dismissed'];
const MAX_MESSAGE_LENGTH = 500;

const reminderQuery = {
  REMINDER_STATUSES,
  MAX_MESSAGE_LENGTH,

  /**
   * Create a follow-up reminder. `remindAt` must already be a Date.
   */
  async create(userId, applicationId, remindAt, message = '') {
    const result = await pool.query(
      `INSERT INTO reminders (user_id, application_id, remind_at, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, applicationId, remindAt, String(message || '').slice(0, MAX_MESSAGE_LENGTH)]
    );
    return result.rows[0];
  },

  /** All reminders for one application (owner-scoped), soonest first. */
  async listForApplication(userId, applicationId) {
    const result = await pool.query(
      `SELECT r.*, a.job_title, a.company
       FROM reminders r
       JOIN applications a ON a.id = r.application_id
       WHERE r.user_id = $1 AND r.application_id = $2
       ORDER BY r.remind_at ASC`,
      [userId, applicationId]
    );
    return result.rows;
  },

  /** Pending + recently-sent reminders across the user's pipeline. */
  async listForUser(userId, limit = 100) {
    const result = await pool.query(
      `SELECT r.*, a.job_title, a.company
       FROM reminders r
       JOIN applications a ON a.id = r.application_id
       WHERE r.user_id = $1 AND a.deleted_at IS NULL
       ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.remind_at ASC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  },

  /** Owner-scoped dismissal. Returns the updated row or null. */
  async dismiss(userId, reminderId) {
    const result = await pool.query(
      `UPDATE reminders SET status = 'dismissed'
       WHERE id = $1 AND user_id = $2 AND status = 'pending'
       RETURNING *`,
      [reminderId, userId]
    );
    return result.rows[0] || null;
  },

  /** Load a reminder joined with delivery context for the email worker. */
  async getWithApplication(reminderId) {
    const result = await pool.query(
      `SELECT r.*, u.email AS user_email, u.full_name,
              a.job_title, a.company
       FROM reminders r
       JOIN users u ON u.id = r.user_id
       JOIN applications a ON a.id = r.application_id
       WHERE r.id = $1`,
      [reminderId]
    );
    return result.rows[0] || null;
  },

  /** Idempotency guard + completion in one statement: only pending → sent. */
  async markSent(reminderId) {
    const result = await pool.query(
      `UPDATE reminders SET status = 'sent', sent_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING id`,
      [reminderId]
    );
    return result.rows[0] || null;
  },

  /**
   * Recovery scan: pending reminders that should already have fired (e.g. the
   * server was down at their scheduled time). The worker re-enqueues these on boot.
   */
  async getOverduePending(limit = 200) {
    const result = await pool.query(
      `SELECT id FROM reminders
       WHERE status = 'pending' AND remind_at <= NOW()
       ORDER BY remind_at ASC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map((r) => r.id);
  },
};

module.exports = reminderQuery;
