const pool = require('../config/db');

const analyticsQuery = {
  /**
   * Get funnel metrics grouped by channel or overall
   * stages: Applied -> Interviewing -> Offered/Hired
   */
  async getFunnelData(userId, groupBy = null) {
    let groupByClause = '';
    let selectGrouping = '';
    
    // Whitelist groupBy to prevent SQL injection
    if (groupBy === 'channel') {
      selectGrouping = 'a.channel as group_key,';
      groupByClause = 'GROUP BY a.channel';
    } else {
      selectGrouping = "'overall' as group_key,";
    }

    const result = await pool.query(
      `SELECT 
         ${selectGrouping}
         COUNT(DISTINCT a.id) as total,
         COUNT(DISTINCT CASE WHEN h.status = 'Applied' THEN a.id END) as applied_count,
         COUNT(DISTINCT CASE WHEN h.status IN ('Interviewing', 'Offered/Hired') THEN a.id END) as interviewing_count,
         COUNT(DISTINCT CASE WHEN h.status = 'Offered/Hired' THEN a.id END) as offered_count
       FROM applications a
       LEFT JOIN application_status_history h ON a.id = h.application_id
       WHERE a.user_id = $1
       ${groupByClause}`,
      [userId]
    );

    // Calculate percentages
    return result.rows.map(row => {
      const applied = parseInt(row.applied_count, 10);
      const interviewing = parseInt(row.interviewing_count, 10);
      const offered = parseInt(row.offered_count, 10);
      
      return {
        groupKey: row.group_key,
        total: parseInt(row.total, 10),
        stages: [
          { name: 'Applied', count: applied, conversion: 100 },
          { name: 'Interviewing', count: interviewing, conversion: applied > 0 ? Math.round((interviewing / applied) * 100) : 0 },
          { name: 'Offered/Hired', count: offered, conversion: interviewing > 0 ? Math.round((offered / interviewing) * 100) : 0 }
        ]
      };
    });
  }
};

module.exports = analyticsQuery;
