const pool = require('../config/db');

const profileQuery = {
  /**
   * Create or update a profile's parsed_json_data for a user.
   * Uses UPSERT (INSERT ... ON CONFLICT UPDATE) since user_id is UNIQUE.
   */
  async upsert(userId, parsedJsonData) {
    const result = await pool.query(
      `INSERT INTO profiles (user_id, parsed_json_data, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id)
       DO UPDATE SET parsed_json_data = $2, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, JSON.stringify(parsedJsonData)]
    );
    return result.rows[0];
  },

  /**
   * Get profile by user ID.
   */
  async findByUserId(userId) {
    const result = await pool.query(
      `SELECT id, user_id, parsed_json_data, updated_at
       FROM profiles WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  },
};

module.exports = profileQuery;
