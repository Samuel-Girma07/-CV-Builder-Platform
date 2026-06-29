const rateLimit = require('express-rate-limit');

// Rate limiting protects two sensitive surfaces:
//  - auth endpoints, against password brute-forcing and signup abuse
//  - AI endpoints, which call a paid third-party API and are costly to spam.

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // login/register attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 12, // AI-backed requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'You are sending AI requests too quickly. Please slow down.' },
});

module.exports = { authLimiter, aiLimiter };
