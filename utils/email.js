const { Resend } = require('resend');
const { logger } = require('../middlewares/logger');

// Use Resend HTTP API (works on all cloud hosts - no SMTP port blocking)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function isEmailConfigured() {
  return Boolean(resend);
}

function buildResetLink(resetToken) {
  const base = (process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');
  return `${base}/#/reset-password?token=${encodeURIComponent(resetToken)}`;
}

/**
 * Send a password reset link via Resend HTTP API.
 * The raw token travels ONLY inside the email body; the database stores its
 * SHA-256 hash, and it must never be logged.
 * @param {string} toEmail - Recipient email
 * @param {string} resetToken - Raw single-use reset token
 * @returns {Promise<boolean>} - True if sent, false when no provider configured
 */
async function sendResetEmail(toEmail, resetToken) {
  if (resend) {
    const resetLink = buildResetLink(resetToken);
    logger.info(`Attempting to send password reset email to: ${toEmail}...`);
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM || 'CV Builder Platform <onboarding@resend.dev>',
        to: toEmail,
        subject: 'Reset Your Password - CV Builder Platform',
        text: `You requested a password reset. Open the link below within 1 hour to choose a new password:\n\n${resetLink}\n\nIf you didn't request this, you can safely ignore this email — your current password keeps working.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #4a5568; text-align: center;">Reset Your Password</h2>
            <p>You requested a password reset for your CV Builder Platform account.</p>
            <p>Click the button below within <strong>1 hour</strong> to choose a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #4a5568; color: #ffffff; padding: 12px 28px; border-radius: 6px; font-weight: bold; display: inline-block; text-decoration: none;">Choose a New Password</a>
            </div>
            <p style="color: #4a5568; word-break: break-all; font-size: 12px;">If the button doesn't work, copy this link into your browser:<br>${resetLink}</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            <p style="color: #a0aec0; font-size: 12px;">This link expires in 1 hour. If you didn't request a reset, ignore this email — your current password still works.</p>
          </div>
        `,
      });

      if (error) {
        logger.error(`RESEND API ERROR: ${JSON.stringify(error)}`);
        throw new Error(`Email delivery failed: ${error.message || JSON.stringify(error)}`);
      }

      logger.info(`Password reset email sent successfully to: ${toEmail}. ID: ${data.id}`);
      return true;
    } catch (err) {
      logger.error(`Error sending email via Resend: ${err.message}`);
      throw err;
    }
  }

  // Fallback / Development mode (no API key configured).
  // The plaintext credential must NEVER be logged or echoed anywhere.
  // In production this is an operator emergency, not a debug event.
  const message = `Email delivery is NOT configured (RESEND_API_KEY missing). Reset email to ${toEmail} was NOT sent.`;
  if (process.env.NODE_ENV === 'production') {
    logger.error(message);
  } else {
    logger.warn(message);
  }
  return false;
}

/**
 * Send a temporary password via Resend HTTP API.
 * The plaintext credential travels ONLY inside the email body and is never
 * logged; the database stores only its bcrypt hash.
 * @param {string} toEmail - Recipient email
 * @param {string} tempPassword - Plaintext temporary password
 * @returns {Promise<boolean>} - True if sent, false when no provider configured
 */
async function sendTempPasswordEmail(toEmail, tempPassword) {
  if (resend) {
    logger.info(`Attempting to send temporary password email to: ${toEmail}...`);
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM || 'CV Builder Platform <onboarding@resend.dev>',
        to: toEmail,
        subject: 'Your Temporary Password - CV Builder Platform',
        text: `A temporary password was issued for your account:\n\n${tempPassword}\n\nSign in with it within 1 hour — you will be required to choose a new password immediately. If you did not request this, contact support.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #4a5568; text-align: center;">Your Temporary Password</h2>
            <p>A temporary password was issued for your CV Builder Platform account.</p>
            <div style="text-align: center; margin: 30px 0;">
              <code style="background-color: #edf2f7; color: #2d3748; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 18px; letter-spacing: 1px;">${tempPassword}</code>
            </div>
            <p>Sign in with it within <strong>1 hour</strong> — you will be asked to choose a new password immediately.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            <p style="color: #a0aec0; font-size: 12px;">If you did not request a temporary password, contact support right away.</p>
          </div>
        `,
      });

      if (error) {
        logger.error(`RESEND API ERROR: ${JSON.stringify(error)}`);
        throw new Error(`Email delivery failed: ${error.message || JSON.stringify(error)}`);
      }

      logger.info(`Temporary password email sent successfully to: ${toEmail}. ID: ${data.id}`);
      return true;
    } catch (err) {
      logger.error(`Error sending email via Resend: ${err.message}`);
      throw err;
    }
  }

  // The plaintext credential must NEVER be logged or echoed anywhere.
  // In production this is an operator emergency, not a debug event.
  const message = `Email delivery is NOT configured (RESEND_API_KEY missing). Recovery email to ${toEmail} was NOT sent.`;
  if (process.env.NODE_ENV === 'production') {
    logger.error(message);
  } else {
    logger.warn(message);
  }
  return false;
}

/**
 * Follow-up reminder email for one application.
 * @returns {Promise<boolean>} true if sent, false when no provider configured
 */
async function sendReminderEmail(toEmail, { jobTitle, company, remindAt, message }) {
  if (resend) {
    const when = new Date(remindAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    logger.info(`Attempting to send reminder email to: ${toEmail}...`);
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM || 'CV Builder Platform <onboarding@resend.dev>',
        to: toEmail,
        subject: `Follow up on your ${company} application`,
        text: `Time to follow up on "${jobTitle}" at ${company} (scheduled for ${when}).\n\n${message || ''}\n\nKeep the momentum going — a short, polite nudge often moves applications forward.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color:#4a5568;">Follow-up reminder</h2>
            <p>Your reminder for <strong>${jobTitle}</strong> at <strong>${company}</strong> is due (${when}).</p>
            ${message ? `<p style="background:#f7fafc;padding:12px;border-left:3px solid #4a5568;">${message}</p>` : ''}
            <p>A short, polite nudge often moves applications forward.</p>
          </div>
        `,
      });
      if (error) {
        logger.error(`RESEND API ERROR: ${JSON.stringify(error)}`);
        throw new Error(`Email delivery failed: ${error.message || JSON.stringify(error)}`);
      }
      logger.info(`Reminder email sent to ${toEmail}. ID: ${data.id}`);
      return true;
    } catch (err) {
      logger.error(`Error sending reminder email via Resend: ${err.message}`);
      throw err;
    }
  }

  const notice = `Email delivery is NOT configured. Reminder email to ${toEmail} was NOT sent.`;
  if (process.env.NODE_ENV === 'production') logger.error(notice); else logger.warn(notice);
  return false;
}

/**
 * Weekly pipeline digest for one opted-in user.
 * @param {string} toEmail
 * @param {{applied:number,interviewing:number,offered:number,rejected:number,recent:number,pendingReminders:number}} stats
 */
async function sendDigestEmail(toEmail, stats) {
  if (resend) {
    logger.info(`Attempting to send weekly digest to: ${toEmail}...`);
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM || 'CV Builder Platform <onboarding@resend.dev>',
        to: toEmail,
        subject: 'Your weekly job-search digest',
        text: `This week you added ${stats.recent} application(s). Pipeline totals — Applied: ${stats.applied}, Interviewing: ${stats.interviewing}, Offered/Hired: ${stats.offered}, Rejected: ${stats.rejected}. Pending follow-up reminders: ${stats.pendingReminders}.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color:#4a5568;">Your week in review</h2>
            <p>You added <strong>${stats.recent}</strong> new application${stats.recent === 1 ? '' : 's'} this week.</p>
            <table style="border-collapse:collapse;margin:12px 0;">
              <tr><td style="padding:4px 12px 4px 0;color:#718096;">Applied</td><td><strong>${stats.applied}</strong></td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#718096;">Interviewing</td><td><strong>${stats.interviewing}</strong></td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#718096;">Offered/Hired</td><td><strong>${stats.offered}</strong></td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#718096;">Rejected</td><td><strong>${stats.rejected}</strong></td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#718096;">Pending reminders</td><td><strong>${stats.pendingReminders}</strong></td></tr>
            </table>
            <p style="color:#a0aec0;font-size:12px;">You are receiving this because weekly digests are enabled in your settings.</p>
          </div>
        `,
      });
      if (error) {
        logger.error(`RESEND API ERROR: ${JSON.stringify(error)}`);
        throw new Error(`Email delivery failed: ${error.message || JSON.stringify(error)}`);
      }
      logger.info(`Weekly digest sent to ${toEmail}. ID: ${data.id}`);
      return true;
    } catch (err) {
      logger.error(`Error sending digest via Resend: ${err.message}`);
      throw err;
    }
  }

  const notice = `Email delivery is NOT configured. Weekly digest to ${toEmail} was NOT sent.`;
  if (process.env.NODE_ENV === 'production') logger.error(notice); else logger.warn(notice);
  return false;
}

module.exports = {
  sendResetEmail,
  sendTempPasswordEmail,
  sendReminderEmail,
  sendDigestEmail,
  isEmailConfigured,
};
