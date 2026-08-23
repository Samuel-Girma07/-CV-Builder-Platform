const pool = require('../config/db');

const userQuery = {
  /**
   * Create a new user with hashed password.
   * Accepts an optional transaction client so caller can bundle the profile
   * upsert atomically; defaults to the shared pool.
   */
  async create(email, passwordHash, fullName, client = pool) {
    const result = await client.query(
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
      `SELECT id, email, password_hash, full_name, created_at, must_change_password, reset_token_expires, totp_secret_enc, totp_enabled
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
      `SELECT id, email, full_name, created_at, must_change_password, reset_token_expires, totp_secret_enc, totp_enabled
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
   * Opt in/out of the weekly pipeline digest email.
   */
  async setDigestOptIn(id, digestOptIn) {
    const result = await pool.query(
      `UPDATE users SET digest_opt_in = $2 WHERE id = $1 RETURNING id`,
      [id, Boolean(digestOptIn)]
    );
    return result.rows[0] || null;
  },

  /**
   * Store an encrypted TOTP seed without enabling it yet (enrollment step 1).
   */
  async setTotpSecret(id, totpSecretEnc) {
    const result = await pool.query(
      `UPDATE users SET totp_secret_enc = $2 WHERE id = $1 RETURNING id`,
      [id, totpSecretEnc]
    );
    return result.rows[0] || null;
  },

  async enableTotp(id) {
    const result = await pool.query(
      `UPDATE users SET totp_enabled = true WHERE id = $1 AND totp_secret_enc IS NOT NULL RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  },

  async clearTotp(id) {
    const result = await pool.query(
      `UPDATE users SET totp_secret_enc = NULL, totp_enabled = false WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Store a hashed reset token with an expiry. Deliberately does NOT touch
   * password_hash: the current credential stays valid until a reset completes.
   */
  async setResetToken(id, tokenHash, expiresAt) {
    const result = await pool.query(
      `UPDATE users
       SET reset_token = $2, reset_token_expires = $3
       WHERE id = $1
       RETURNING id`,
      [id, tokenHash, expiresAt]
    );
    return result.rows[0] || null;
  },

  /**
   * Find a user with a valid, non-expired reset token.
   * Callers pass the SHA-256 hash, never the raw token.
   */
  async findByResetToken(tokenHash) {
    const result = await pool.query(
      `SELECT id, email, full_name, created_at, must_change_password, reset_token_expires, totp_secret_enc, totp_enabled
       FROM users
       WHERE reset_token = $1 AND reset_token_expires > NOW()`,
      [tokenHash]
    );
    return result.rows[0] || null;
  },

  /**
   * Finish a reset in one statement: swap the password hash, clear the token,
   * and drop any legacy temporary-password flag.
   */
  async completePasswordReset(id, passwordHash) {
    const result = await pool.query(
      `UPDATE users
       SET password_hash = $2, reset_token = NULL, reset_token_expires = NULL, must_change_password = false
       WHERE id = $1
       RETURNING id, email, full_name, created_at, must_change_password, reset_token_expires`,
      [id, passwordHash]
    );
    return result.rows[0] || null;
  },

  /**
   * Issue a temporary credential: rotate the hash, flag forced change, start
   * the validity window, and invalidate any pending reset link so exactly one
   * recovery channel is live at a time.
   */
  async setTemporaryPassword(id, passwordHash, expiresAt) {
    const result = await pool.query(
      `UPDATE users
       SET password_hash = $2, must_change_password = true, reset_token = NULL, reset_token_expires = $3
       WHERE id = $1
       RETURNING id`,
      [id, passwordHash, expiresAt]
    );
    return result.rows[0] || null;
  },
};

module.exports = userQuery;
