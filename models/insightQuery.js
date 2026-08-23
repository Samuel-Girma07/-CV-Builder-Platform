const pool = require('../config/db');

/*
  Insight queries. All aggregations read only user-owned, non-deleted rows.

  Trend convention: "recent" = created in the trailing 30 days, "prior" =
  the 30 days before that. Deltas are computed in JS so the SQL stays a
  single pass over the user's rows.
*/

const SKILL_GAP_SQL = `
  SELECT
    skill,
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS recent_count,
    COUNT(*) FILTER (WHERE created_at <  NOW() - INTERVAL '30 days')::int AS prior_count
  FROM (
    SELECT s.skill AS skill, a.created_at
    FROM applications a
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(a.missing_skills) = 'array' THEN a.missing_skills ELSE '[]'::jsonb END
    ) AS s(skill)
    WHERE a.user_id = $1 AND a.deleted_at IS NULL
  ) t
  GROUP BY skill
  ORDER BY (COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')
          + COUNT(*) FILTER (WHERE created_at <  NOW() - INTERVAL '30 days')) DESC,
           skill ASC
  LIMIT $2
`;

const OUTCOME_SPLIT_SQL = `
  WITH per_app AS (
    SELECT
      a.id,
      (a.tailored_cv_profile IS NOT NULL) AS tailored,
      (a.generated_cover_letter IS NOT NULL AND a.generated_cover_letter <> '') AS lettered,
      BOOL_OR(h.status IN ('Interviewing', 'Offered/Hired')) AS reached_interview
    FROM applications a
    LEFT JOIN application_status_history h ON h.application_id = a.id
    WHERE a.user_id = $1 AND a.deleted_at IS NULL
    GROUP BY a.id
  )
  SELECT
    COUNT(*)::int AS total,
    SUM(CASE WHEN tailored THEN 1 ELSE 0 END)::int AS tailored_total,
    SUM(CASE WHEN tailored AND reached_interview THEN 1 ELSE 0 END)::int AS tailored_interviewed,
    SUM(CASE WHEN NOT tailored THEN 1 ELSE 0 END)::int AS plain_total,
    SUM(CASE WHEN NOT tailored AND reached_interview THEN 1 ELSE 0 END)::int AS plain_interviewed,
    SUM(CASE WHEN lettered THEN 1 ELSE 0 END)::int AS letter_total,
    SUM(CASE WHEN lettered AND reached_interview THEN 1 ELSE 0 END)::int AS letter_interviewed,
    SUM(CASE WHEN NOT lettered THEN 1 ELSE 0 END)::int AS no_letter_total,
    SUM(CASE WHEN NOT lettered AND reached_interview THEN 1 ELSE 0 END)::int AS no_letter_interviewed
  FROM per_app
`;

const insightQuery = {
  /**
   * Top recurring missing skills across the user's scored applications.
   * @returns {Array<{skill, total, recentCount, priorCount, trend}>}
   *   trend: 'rising' | 'falling' | 'steady' comparing the two windows.
   */
  async getSkillGaps(userId, limit = 10) {
    const result = await pool.query(SKILL_GAP_SQL, [userId, limit]);
    return result.rows.map((row) => {
      const recentCount = Number(row.recent_count);
      const priorCount = Number(row.prior_count);
      let trend = 'steady';
      if (recentCount > priorCount) trend = 'rising';
      else if (recentCount < priorCount) trend = 'falling';
      return {
        skill: row.skill,
        total: Number(row.total),
        recentCount,
        priorCount,
        trend,
      };
    });
  },

  /**
   * One-pass split of interview reach for applications that did vs did not
   * use a platform feature (tailored CV, generated cover letter).
   */
  async getOutcomeSplit(userId) {
    const result = await pool.query(OUTCOME_SPLIT_SQL, [userId]);
    const row = result.rows[0] || {};
    const num = (v) => Number(v || 0);
    return {
      total: num(row.total),
      tailoredTotal: num(row.tailored_total),
      tailoredInterviewed: num(row.tailored_interviewed),
      plainTotal: num(row.plain_total),
      plainInterviewed: num(row.plain_interviewed),
      letterTotal: num(row.letter_total),
      letterInterviewed: num(row.letter_interviewed),
      noLetterTotal: num(row.no_letter_total),
      noLetterInterviewed: num(row.no_letter_interviewed),
    };
  },
};

module.exports = insightQuery;
