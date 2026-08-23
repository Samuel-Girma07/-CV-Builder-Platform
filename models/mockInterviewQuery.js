const pool = require('../config/db');

const MODES = ['behavioral', 'technical', 'mixed'];

const mockInterviewQuery = {
  MODES,

  async createSession(client, userId, applicationId, mode, questionCount) {
    const db = client || pool;
    const result = await db.query(
      `INSERT INTO interview_sessions (user_id, application_id, mode, question_count)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, applicationId, mode, questionCount]
    );
    return result.rows[0];
  },

  /** Owner-scoped session fetch. */
  async getSession(sessionId, userId) {
    const result = await pool.query(
      `SELECT * FROM interview_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, userId]
    );
    return result.rows[0] || null;
  },

  async findActiveByApplication(userId, applicationId) {
    const result = await pool.query(
      `SELECT * FROM interview_sessions
       WHERE user_id = $1 AND application_id = $2 AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [userId, applicationId]
    );
    return result.rows[0] || null;
  },

  async listByApplication(userId, applicationId) {
    const result = await pool.query(
      `SELECT id, mode, status, question_count, score, summary, created_at, completed_at
       FROM interview_sessions
       WHERE user_id = $1 AND application_id = $2
       ORDER BY created_at DESC`,
      [userId, applicationId]
    );
    return result.rows;
  },

  async addMessage(client, sessionId, role, content, { questionIndex = null, critique = null } = {}) {
    const db = client || pool;
    const result = await db.query(
      `INSERT INTO interview_messages (session_id, role, question_index, content, critique)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [sessionId, role, questionIndex, content, critique ? JSON.stringify(critique) : null]
    );
    return result.rows[0];
  },

  async getMessages(sessionId, client = pool) {
    const result = await client.query(
      `SELECT * FROM interview_messages WHERE session_id = $1 ORDER BY id ASC`,
      [sessionId]
    );
    return result.rows;
  },

  async countCandidateAnswers(sessionId, client = pool) {
    const result = await client.query(
      `SELECT COUNT(*)::int AS n FROM interview_messages WHERE session_id = $1 AND role = 'candidate'`,
      [sessionId]
    );
    return Number(result.rows[0].n);
  },

  async completeSession(client, sessionId, score, summary) {
    const db = client || pool;
    const result = await db.query(
      `UPDATE interview_sessions
       SET status = 'completed', score = $2, summary = $3, completed_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [sessionId, score, summary]
    );
    return result.rows[0];
  },
};

module.exports = mockInterviewQuery;
