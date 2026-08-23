const pool = require('../config/db');

/**
 * Gather every owner-scoped record for the account export. Metadata-only for
 * stored PDFs (file bytes excluded) — the export is a portable data bundle,
 * not a backup of binaries.
 */
async function gatherAll(userId) {
  const [users, profiles, applications, statusHistory, interviews, interviewSessions,
    interviewMessages, reminders, contacts, activities, xrayMeta, profileVersions] = await Promise.all([
    pool.query(
      `SELECT id, email, full_name, created_at, must_change_password, reset_token_expires,
              digest_opt_in, totp_enabled FROM users WHERE id = $1`,
      [userId]
    ),
    pool.query(`SELECT * FROM profiles WHERE user_id = $1`, [userId]),
    pool.query(`SELECT * FROM applications WHERE user_id = $1 ORDER BY id`, [userId]),
    pool.query(
      `SELECT h.* FROM application_status_history h
       JOIN applications a ON a.id = h.application_id
       WHERE a.user_id = $1 ORDER BY h.id`,
      [userId]
    ),
    pool.query(`SELECT * FROM interviews WHERE user_id = $1 ORDER BY id`, [userId]),
    pool.query(`SELECT id, application_id, mode, status, question_count, score, summary, created_at, completed_at
                FROM interview_sessions WHERE user_id = $1 ORDER BY id`, [userId]),
    pool.query(
      `SELECT m.* FROM interview_messages m
       JOIN interview_sessions s ON s.id = m.session_id
       WHERE s.user_id = $1 ORDER BY m.id`,
      [userId]
    ),
    pool.query(`SELECT * FROM reminders WHERE user_id = $1 ORDER BY id`, [userId]),
    pool.query(`SELECT * FROM app_contacts WHERE user_id = $1 ORDER BY id`, [userId]),
    pool.query(`SELECT * FROM app_activities WHERE user_id = $1 ORDER BY id`, [userId]),
    pool.query(
      `SELECT id, file_name, parsability_report, uploaded_at FROM cv_versions
       WHERE user_id = $1 ORDER BY id`,
      [userId]
    ),
    pool.query(
      `SELECT id, parsed_json_data, trigger, restored_from, created_at FROM profile_versions
       WHERE user_id = $1 ORDER BY id`,
      [userId]
    ),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    user: users.rows[0] || null,
    profiles: profiles.rows,
    applications: applications.rows,
    applicationStatusHistory: statusHistory.rows,
    interviews: interviews.rows,
    interviewSessions: interviewSessions.rows,
    interviewMessages: interviewMessages.rows,
    reminders: reminders.rows,
    contacts: contacts.rows,
    activities: activities.rows,
    xrayScans: xrayMeta.rows,
    profileVersions: profileVersions.rows,
  };
}

module.exports = { gatherAll };
