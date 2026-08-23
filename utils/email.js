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
  // The reset token must NEVER be logged or echoed anywhere —
  // fail loud so operators notice delivery is not actually configured.
  logger.warn(`Email delivery is NOT configured (RESEND_API_KEY missing). Reset email to ${toEmail} was NOT sent.`);
  return false;
}

module.exports = {
  sendResetEmail,
  isEmailConfigured,
};
