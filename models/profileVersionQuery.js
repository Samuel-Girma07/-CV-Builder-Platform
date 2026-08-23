const pool = require('../config/db');

// Snapshots accumulate on every meaningful profile mutation, so retention
// mirrors cv_versions: the newest N survive, older ones are pruned.
const MAX_PROFILE_VERSIONS = 50;

const TRIGGERS = ['manual_save', 'ai_parse', 'ai_summary', 'restore'];

const profileVersionQuery = {
  MAX_PROFILE_VERSIONS,
  TRIGGERS,

  /**
   * Record a snapshot. Accepts an optional transaction client so callers can
   * bundle it atomically with the profile upsert that caused it.
   */
  async createSnapshot(client, userId, parsedJsonData, trigger = 'manual_save', restoredFrom = null) {
    const db = client || pool;
    if (!TRIGGERS.includes(trigger)) {
      throw new Error(`Unknown profile version trigger: ${trigger}`);
    }
    const result = await db.query(
      `INSERT INTO profile_versions (user_id, parsed_json_data, trigger, restored_from)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, trigger, restored_from, created_at`,
      [userId, JSON.stringify(parsedJsonData), trigger, restoredFrom]
    );
    return result.rows[0];
  },

  /** Prune beyond the newest MAX_PROFILE_VERSIONS for one user. */
  async prune(client, userId) {
    const db = client || pool;
    await db.query(
      `DELETE FROM profile_versions
       WHERE user_id = $1 AND id NOT IN (
         SELECT id FROM profile_versions WHERE user_id = $1
         ORDER BY created_at DESC, id DESC LIMIT $2
       )`,
      [userId, MAX_PROFILE_VERSIONS]
    );
  },

  /** Metadata listing — full payloads are fetched per-version on demand. */
  async listByUser(userId, limit = 25) {
    const result = await pool.query(
      `SELECT id, trigger, restored_from, created_at,
              (parsed_json_data ->> 'personalInfo' IS NOT NULL) AS has_data
       FROM profile_versions
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      [userId, Math.min(limit, 100)]
    );
    return result.rows;
  },

  /** Owner-scoped single fetch including the full payload. */
  async findById(versionId, userId) {
    const result = await pool.query(
      `SELECT id, user_id, parsed_json_data, trigger, restored_from, created_at
       FROM profile_versions
       WHERE id = $1 AND user_id = $2`,
      [versionId, userId]
    );
    return result.rows[0] || null;
  },
};

module.exports = profileVersionQuery;
