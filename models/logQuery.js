const pool = require('../config/db');

const KINDS = ['note', 'call', 'email', 'interview', 'offer', 'rejection'];
const MAX_CONTENT_LENGTH = 2000;

function validateId(idParam) {
  const num = Number(idParam);
  return Number.isInteger(num) && num > 0 ? num : null;
}

const logQuery = {
  KINDS,
  MAX_CONTENT_LENGTH,
  validateId,

  async createContact(client, userId, applicationId, { name, role, email, phone, notes }) {
    const result = await client.query(
      `INSERT INTO app_contacts (user_id, application_id, name, role, email, phone, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, applicationId, name, role || '', email || '', phone || '', notes || '']
    );
    return result.rows[0];
  },

  async listContacts(userId, applicationId) {
    const result = await pool.query(
      `SELECT * FROM app_contacts WHERE user_id = $1 AND application_id = $2 ORDER BY id ASC`,
      [userId, applicationId]
    );
    return result.rows;
  },

  async deleteContact(userId, contactId) {
    const result = await pool.query(
      `DELETE FROM app_contacts WHERE id = $1 AND user_id = $2 RETURNING id`,
      [contactId, userId]
    );
    return result.rows[0] || null;
  },

  async createActivity(client, userId, applicationId, { kind, content, occurredAt }) {
    const result = await client.query(
      `INSERT INTO app_activities (user_id, application_id, kind, content, occurred_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, applicationId, kind, content || '', occurredAt]
    );
    return result.rows[0];
  },

  async listActivities(userId, applicationId) {
    const result = await pool.query(
      `SELECT * FROM app_activities WHERE user_id = $1 AND application_id = $2
       ORDER BY occurred_at DESC, id DESC LIMIT 200`,
      [userId, applicationId]
    );
    return result.rows;
  },

  async deleteActivity(userId, activityId) {
    const result = await pool.query(
      `DELETE FROM app_activities WHERE id = $1 AND user_id = $2 RETURNING id`,
      [activityId, userId]
    );
    return result.rows[0] || null;
  },
};

module.exports = logQuery;
