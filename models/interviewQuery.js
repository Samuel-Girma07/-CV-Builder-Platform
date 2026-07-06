const pool = require('../config/db');

const interviewQuery = {
  async create(userId, applicationId, title, startTime, endTime, location, notes) {
    const result = await pool.query(
      `INSERT INTO interviews (user_id, application_id, title, start_time, end_time, location, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, applicationId, title, startTime, endTime, location, notes]
    );
    return result.rows[0];
  },

  async findByApplicationId(applicationId, userId) {
    const result = await pool.query(
      `SELECT * FROM interviews WHERE application_id = $1 AND user_id = $2 ORDER BY start_time ASC`,
      [applicationId, userId]
    );
    return result.rows;
  },

  async findById(id, userId) {
    const result = await pool.query(
      `SELECT * FROM interviews WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return result.rows[0];
  },

  async checkConflict(userId, startTime, endTime) {
    const result = await pool.query(
      `SELECT id, title, start_time, end_time FROM interviews
       WHERE user_id = $1 AND start_time < $3 AND end_time > $2
       LIMIT 1`,
      [userId, startTime, endTime]
    );
    return result.rows[0] || null;
  }
};

module.exports = interviewQuery;
