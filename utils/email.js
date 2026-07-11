const { Resend } = require('resend');
const { logger } = require('../middlewares/logger');

// Use Resend HTTP API (works on all cloud hosts - no SMTP port blocking)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Send temporary password email via Resend HTTP API
 * @param {string} toEmail - Recipient email
 * @param {string} tempPassword - The temporary password
 * @returns {Promise<boolean>} - True if sent, false in dev mode
 */
async function sendResetEmail(toEmail, tempPassword) {
  if (resend) {
    logger.info(`Attempting to send password reset email to: ${toEmail}...`);
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM || 'CV Builder Platform <onboarding@resend.dev>',
        to: toEmail,
        subject: 'Reset Your Password - CV Builder Platform',
        text: `You requested a password reset. Your temporary password is:\n\n${tempPassword}\n\nPlease log in with this temporary password. You will be prompted to change it immediately. This temporary password is valid for 1 hour.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #4a5568; text-align: center;">Your Temporary Password</h2>
            <p>You requested to reset the password for your CV Builder Platform account.</p>
            <p>Your temporary password is:</p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="background-color: #edf2f7; color: #2d3748; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 20px; letter-spacing: 2px;">${tempPassword}</span>
            </div>
            <p style="color: #4a5568;">Please log in with this password. You will be prompted to create a new password immediately.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            <p style="color: #a0aec0; font-size: 12px;">This temporary password will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
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

  // Fallback / Development mode (no API key configured)
  logger.info('\n============================================================');
  logger.info('   [DEVELOPMENT/MOCK EMAIL NOTIFICATION]');
  logger.info(`   To: ${toEmail}`);
  logger.info(`   Subject: Reset Your Password`);
  logger.info(`   Temporary Password: ${tempPassword}`);
  logger.info('============================================================\n');
  return false;
}

module.exports = {
  sendResetEmail,
};
