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
};

module.exports = insightQuery;
