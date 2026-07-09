const nodemailer = require('nodemailer');
const { logger } = require('../middlewares/logger');

// Create a transporter using SMTP settings from .env if present
let transporter = null;
const isSmtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

if (isSmtpConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Send password reset email
 * @param {string} toEmail - Recipient email
 * @param {string} resetLink - Link to reset password
 * @returns {Promise<boolean>} - True if sent via SMTP, false otherwise
 */
async function sendResetEmail(toEmail, resetLink) {
  const mailOptions = {
    from: process.env.SMTP_FROM || '"CV Builder Platform" <no-reply@cvbuilder.com>',
    to: toEmail,
    subject: 'Reset Your Password - CV Builder Platform',
    text: `You requested a password reset. Please click on the link below to reset your password:\n\n${resetLink}\n\nThis link is valid for 1 hour. If you did not request this, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4a5568; text-align: center;">Reset Your Password</h2>
        <p>You requested to reset the password for your CV Builder Platform account.</p>
        <p>Click the button below to choose a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #2b6cb0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #718096; font-size: 14px;">Or copy and paste this URL into your browser:</p>
        <p style="color: #2b6cb0; word-break: break-all; font-size: 14px;">${resetLink}</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
        <p style="color: #a0aec0; font-size: 12px;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  };

  if (transporter) {
    try {
      await transporter.sendMail(mailOptions);
      logger.info(`Password reset email sent successfully to: ${toEmail}`);
      return true;
    } catch (error) {
      logger.error(`Error sending email via SMTP: ${error.message}`);
      // Fallback to console logging
    }
  }

  // Fallback / Development mode
  logger.info('\n============================================================');
  logger.info('   [DEVELOPMENT/MOCK EMAIL NOTIFICATION]');
  logger.info(`   To: ${toEmail}`);
  logger.info(`   Subject: Reset Your Password`);
  logger.info(`   Reset Link: ${resetLink}`);
  logger.info('============================================================\n');
  return false;
}

module.exports = {
  sendResetEmail,
};
