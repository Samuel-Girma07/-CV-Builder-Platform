const pool = require('../config/db');

/* Strict allowlists — never interpolate raw user input into SQL */
const SORTABLE_COLUMNS = ['job_title', 'company', 'ats_match_score', 'created_at', 'status'];
const FILTERABLE_COLUMNS = ['job_title', 'company', 'status'];
const UPDATABLE_FIELDS = ['job_title', 'company', 'job_description', 'status', 'custom_fields'];

const applicationQuery = {
  /**
   * Create a new application row with job details.
   */
  async create(userId, jobTitle, company, jobDescription, channel = 'cold_apply', redFlagScore = 0, redFlags = []) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO applications (user_id, job_title, company, job_description, channel, status, red_flag_score, red_flags)
         VALUES ($1, $2, $3, $4, $5, 'Applied', $6, $7)
         RETURNING *`,
        [userId, jobTitle, company, jobDescription, channel, redFlagScore, JSON.stringify(redFlags)]
      );
      const app = result.rows[0];
      await client.query(
        `INSERT INTO application_status_history (application_id, status) VALUES ($1, 'Applied')`,
        [app.id]
      );
      await client.query('COMMIT');
      return app;
    } catch(e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  /**
   * Update ATS score and missing skills for an application.
   */
  async updateAtsScore(applicationId, atsMatchScore, missingSkills) {
    const result = await pool.query(
      `UPDATE applications
       SET ats_match_score = $2, missing_skills = $3
       WHERE id = $1
       RETURNING *`,
      [applicationId, atsMatchScore, JSON.stringify(missingSkills)]
    );
    return result.rows[0];
  },

  /**
   * Update the generated cover letter and tone, scoped to the owning user.
   */
  async updateCoverLetterForUser(applicationId, userId, selectedTone, generatedCoverLetter) {
    const result = await pool.query(
      `UPDATE applications
       SET selected_tone = $3, generated_cover_letter = $4
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [applicationId, userId, selectedTone, generatedCoverLetter]
    );
    return result.rows[0];
  },

  /**
   * Save a tailored CV profile for a specific application.
   */
  async updateTailoredCvForUser(applicationId, userId, tailoredCvProfile) {
    const result = await pool.query(
      `UPDATE applications
       SET tailored_cv_profile = $3
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [applicationId, userId, JSON.stringify(tailoredCvProfile)]
    );
    return result.rows[0];
  },

  /**
   * Save interview prep guide for a specific application.
   */
  async updateInterviewPrepForUser(applicationId, userId, interviewPrepGuide) {
    const result = await pool.query(
      `UPDATE applications
       SET interview_prep_guide = $3
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [applicationId, userId, JSON.stringify(interviewPrepGuide)]
    );
    return result.rows[0];
  },


  /**
   * Get all applications for a user, ordered by newest first.
   */
  async findAllByUserId(userId) {
    const result = await pool.query(
      `SELECT * FROM applications
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  },

  /**
   * Get a single application by ID (scoped to user).
   */
  async findById(applicationId, userId) {
    const result = await pool.query(
      `SELECT * FROM applications
       WHERE id = $1 AND user_id = $2`,
      [applicationId, userId]
    );
    return result.rows[0] || null;
  },

  /**
   * Get aggregate stats for a user's dashboard.
   */
  async getStats(userId) {
    const result = await pool.query(
      `SELECT
         COUNT(*)::int AS total_applications,
         COALESCE(ROUND(AVG(ats_match_score)), 0)::int AS avg_ats_score
       FROM applications
       WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0];
  },

  /**
   * Delete an application by ID (scoped to user).
   */
  async delete(applicationId, userId) {
    const result = await pool.query(
      `DELETE FROM applications
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [applicationId, userId]
    );
    return result.rows[0] || null;
  },

  /**
   * Get all applications with optional sorting and filtering.
   * Only columns on the allowlist can be used for sort/filter.
   */
  async findAllSorted(userId, { sort, order, filters } = {}) {
    const params = [userId];
    let where = 'WHERE user_id = $1';

    /* Apply column filters */
    if (filters && typeof filters === 'object') {
      for (const [col, value] of Object.entries(filters)) {
        if (FILTERABLE_COLUMNS.includes(col) && value) {
          params.push(`%${value}%`);
          where += ` AND ${col} ILIKE $${params.length}`;
        }
      }
    }

    /* Apply sorting */
    let orderClause = 'ORDER BY created_at DESC';
    if (sort && SORTABLE_COLUMNS.includes(sort)) {
      const dir = order === 'asc' ? 'ASC' : 'DESC';
      orderClause = `ORDER BY ${sort} ${dir}`;
    }

    const result = await pool.query(
      `SELECT * FROM applications ${where} ${orderClause}`,
      params
    );
    return result.rows;
  },

  /**
   * Partial update — only touches fields on the UPDATABLE allowlist.
   */
  async updatePartial(applicationId, userId, payload) {
    const setClauses = [];
    const params = [applicationId, userId];

    for (const [key, value] of Object.entries(payload)) {
      if (!UPDATABLE_FIELDS.includes(key)) continue;
      params.push(key === 'custom_fields' ? JSON.stringify(value) : value);
      if (key === 'custom_fields') {
        setClauses.push(`custom_fields = custom_fields || $${params.length}::jsonb`);
      } else {
        setClauses.push(`${key} = $${params.length}`);
      }
    }

    if (setClauses.length === 0) return null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE applications SET ${setClauses.join(', ')}
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        params
      );
      
      const app = result.rows[0];
      if (app && payload.status) {
        await client.query(
          `INSERT INTO application_status_history (application_id, status) VALUES ($1, $2)`,
          [app.id, app.status]
        );
      }
      await client.query('COMMIT');
      return app || null;
    } catch(e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  /**
   * Bulk status update.
   */
  async bulkUpdateStatus(userId, ids, status) {
    if (!ids.length) return [];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE applications SET status = $3
         WHERE user_id = $1 AND id = ANY($2::int[])
         RETURNING *`,
        [userId, ids, status]
      );
      
      if (result.rows.length > 0) {
        const historyValues = result.rows.map(r => `(${r.id}, '${status}')`).join(', ');
        await client.query(`INSERT INTO application_status_history (application_id, status) VALUES ${historyValues}`);
      }
      
      await client.query('COMMIT');
      return result.rows;
    } catch(e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  /**
   * Bulk delete.
   */
  async bulkDelete(userId, ids) {
    if (!ids.length) return [];
    const result = await pool.query(
      `DELETE FROM applications
       WHERE user_id = $1 AND id = ANY($2::int[])
       RETURNING id`,
      [userId, ids]
    );
    return result.rows;
  },
};

module.exports = applicationQuery;
