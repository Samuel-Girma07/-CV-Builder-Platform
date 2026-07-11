const nodemailer = require('nodemailer');
const { logger } = require('../middlewares/logger');

// Create a transporter using SMTP settings from .env if present
let transporter = null;
const isSmtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

if (isSmtpConfigured) {
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  
  // Robust secure check: auto-true for port 465, otherwise safely parse the environment variable
  const isSecure = port === 465 || (process.env.SMTP_SECURE && process.env.SMTP_SECURE.toLowerCase().trim() === 'true');

  logger.info(`[SMTP CONFIG] Host: ${process.env.SMTP_HOST}, Port: ${port}, Secure: ${isSecure}, User: ${process.env.SMTP_USER}`);

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: port,
    secure: isSecure,
    connectionTimeout: 10000, // 10 seconds timeout to prevent hanging
    greetingTimeout: 10000,   // 10 seconds timeout for SMTP greeting
    socketTimeout: 10000,     // 10 seconds timeout for inactive sockets
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Send temporary password email
 * @param {string} toEmail - Recipient email
 * @param {string} tempPassword - The temporary password
 * @returns {Promise<boolean>} - True if sent via SMTP, false otherwise
 */
async function sendResetEmail(toEmail, tempPassword) {
  const mailOptions = {
    from: process.env.SMTP_FROM || '"CV Builder Platform" <no-reply@cvbuilder.com>',
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
  };

  if (transporter) {
    try {
      logger.info(`Attempting to send password reset email to: ${toEmail}...`);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("SMTP operation timed out after 10 seconds (Promise.race)")), 10000)
      );

      const info = await Promise.race([
        transporter.sendMail(mailOptions),
        timeoutPromise
      ]);

      logger.info(`Password reset email sent successfully to: ${toEmail}`);
      console.log("Email sent successfully. Message ID:", info.messageId);
      return true;
    } catch (error) {
      console.error("NODEMAILER ERROR:", error);
      logger.error(`Error sending email via SMTP: ${error.message}`);
      // Throw error if SMTP is configured but fails, to avoid silently pretending it succeeded
      throw new Error(`Email delivery failed: ${error.message}`);
    }
  }

  // Fallback / Development mode
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
