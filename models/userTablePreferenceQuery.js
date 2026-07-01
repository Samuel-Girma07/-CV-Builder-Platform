const pool = require('../config/db');

const userTablePreferenceQuery = {
  /**
   * Get a user's table preferences.
   */
  async get(userId) {
    const result = await pool.query(
      `SELECT column_order, hidden_columns, custom_column_defs, updated_at
       FROM user_table_preferences WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  },

  /**
   * Upsert a user's table preferences.
   */
  async upsert(userId, { columnOrder, hiddenColumns, customColumnDefs }) {
    const result = await pool.query(
      `INSERT INTO user_table_preferences (user_id, column_order, hidden_columns, custom_column_defs, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id)
       DO UPDATE SET
         column_order = COALESCE($2, user_table_preferences.column_order),
         hidden_columns = COALESCE($3, user_table_preferences.hidden_columns),
         custom_column_defs = COALESCE($4, user_table_preferences.custom_column_defs),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        userId,
        columnOrder ? JSON.stringify(columnOrder) : null,
        hiddenColumns ? JSON.stringify(hiddenColumns) : null,
        customColumnDefs ? JSON.stringify(customColumnDefs) : null,
      ]
    );
    return result.rows[0];
  },
};

module.exports = userTablePreferenceQuery;
