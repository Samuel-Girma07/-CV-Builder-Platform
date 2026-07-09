const pool = require('../config/db');

const userQuery = {
  /**
   * Create a new user with hashed password.
   */
  async create(email, passwordHash, fullName) {
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, full_name, created_at`,
      [email, passwordHash, fullName]
    );
    return result.rows[0];
  },

  /**
   * Find a user by email.
   */
  async findByEmail(email) {
    const result = await pool.query(
      `SELECT id, email, password_hash, full_name, created_at, must_change_password, reset_token_expires
       FROM users WHERE email = $1`,
      [email]
    );
    return result.rows[0] || null;
  },

  /**
   * Find a user by ID.
   */
  async findById(id) {
    const result = await pool.query(
      `SELECT id, email, full_name, created_at, must_change_password
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Update a user's details.
   */
  async updateDetails(id, email, fullName) {
    const result = await pool.query(
      `UPDATE users
       SET email = $2, full_name = $3
       WHERE id = $1
       RETURNING id, email, full_name, created_at`,
      [id, email, fullName]
    );
    return result.rows[0] || null;
  },

  /**
   * Update a user's password hash and clear any temporary password flags.
   */
  async updatePassword(id, passwordHash) {
    const result = await pool.query(
      `UPDATE users
       SET password_hash = $2, must_change_password = false, reset_token_expires = NULL
       WHERE id = $1
       RETURNING id`,
      [id, passwordHash]
    );
    return result.rows[0] || null;
  },

  /**
   * Delete user by ID.
   */
  async deleteById(id) {
    const result = await pool.query(
      `DELETE FROM users WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Set a temporary password flag and expiration for a user.
   */
  async setTemporaryPassword(id, passwordHash, expiresAt) {
    const result = await pool.query(
      `UPDATE users
       SET password_hash = $2, must_change_password = true, reset_token_expires = $3
       WHERE id = $1
       RETURNING id`,
      [id, passwordHash, expiresAt]
    );
    return result.rows[0] || null;
  },

  /**
   * Find a user with a valid, non-expired reset token.
   */
  async findByResetToken(token) {
    const result = await pool.query(
      `SELECT id, email, password_hash, full_name, created_at
       FROM users
       WHERE reset_token = $1 AND reset_token_expires > NOW()`,
      [token]
    );
    return result.rows[0] || null;
  },

  /**
   * Clear the reset token and expiration for a user.
   */
  async clearResetToken(id) {
    const result = await pool.query(
      `UPDATE users
       SET reset_token = NULL, reset_token_expires = NULL
       WHERE id = $1
       RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  },
};

module.exports = userQuery;
