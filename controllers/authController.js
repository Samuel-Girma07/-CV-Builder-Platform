const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userQuery = require('../models/userQuery');
const profileQuery = require('../models/profileQuery');
const crypto = require('crypto');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const { encrypt, decrypt } = require('../utils/crypto');
const { sendResetEmail, sendTempPasswordEmail, isEmailConfigured } = require('../utils/email');

const SALT_ROUNDS = 12;
const TOKEN_EXPIRES_IN = '24h';
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
// One identical response for every outcome so the endpoint cannot be used to
// enumerate registered accounts.
const RESET_GENERIC_MESSAGE =
  'If that email address belongs to an account, a password reset link has been sent.';
const TEMP_PASSWORD_GENERIC_MESSAGE =
  'If that email address belongs to an account, a temporary password has been issued. Sign in with it within the hour to choose a new one.';

/* Unambiguous character sets (no 0/O/1/l/I) so a emailed credential can be
   retyped reliably. The generator guarantees at least one upper-case letter
   and one digit so every issued password satisfies the login policy. */
const TEMP_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const TEMP_LOWER = 'abcdefghijkmnpqrstuvwxyz';
const TEMP_DIGITS = '23456789';
const TEMP_ALL = TEMP_UPPER + TEMP_LOWER + TEMP_DIGITS;

function generateTemporaryPassword(length = 12) {
  const pick = (set) => set[crypto.randomInt(set.length)];
  const chars = [pick(TEMP_UPPER), pick(TEMP_LOWER), pick(TEMP_DIGITS)];
  while (chars.length < length) chars.push(pick(TEMP_ALL));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function hashResetToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function passwordPolicyError(newPassword) {
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return 'New password must be at least 8 characters.';
  }
  if (!/[A-Z]/.test(newPassword)) {
    return 'New password needs an uppercase letter.';
  }
  if (!/[0-9]/.test(newPassword)) {
    return 'New password needs a number.';
  }
  return null;
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    createdAt: user.created_at,
    mustChangePassword: user.must_change_password || false,
    resetTokenExpires: user.reset_token_expires || null,
    twoFactorEnabled: user.totp_enabled || false,
  };
}

/**
 * Verify a TOTP code against the user's stored encrypted seed. Returns false
 * when no seed exists or the ciphertext fails authentication (tampered).
 */
function verifyTotp(user, token) {
  if (!user || !user.totp_secret_enc) return { ok: false };
  let secret;
  try {
    secret = decrypt(user.totp_secret_enc);
  } catch (err) {
    return { ok: false };
  }
  const ok = authenticator.verify({ token: String(token || '').trim(), secret });
  return { ok };
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );
}

/* Unknown accounts skip the real bcrypt.compare, so response time would leak
   which emails exist. A comparison against an equally expensive dummy hash
   keeps both branches indistinguishable by timing. */
let dummyHashPromise = null;
async function equalizeLoginTiming(password) {
  if (!dummyHashPromise) {
    dummyHashPromise = bcrypt.hash('timing-equalizer-not-a-real-password', SALT_ROUNDS);
  }
  const hash = await dummyHashPromise;
  await bcrypt.compare(password, hash);
}

const authController = {
  async register(req, res, next) {
    try {
      const { fullName, email, password } = req.body;

      if (!fullName || !email || !password) {
        return res.status(400).json({ error: 'Full name, email, and password are required.' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format.' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }
      if (!/[A-Z]/.test(password)) {
        return res.status(400).json({ error: 'Password needs an uppercase letter.' });
      }
      if (!/[0-9]/.test(password)) {
        return res.status(400).json({ error: 'Password needs a number.' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existing = await userQuery.findByEmail(normalizedEmail);
      if (existing) {
        return res.status(409).json({ error: 'An account with that email already exists.' });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const pool = require('../config/db');
      let user;
      try {
        user = await pool.withTransaction(async (tx) => {
          const created = await userQuery.create(normalizedEmail, passwordHash, fullName.trim(), tx);
          await profileQuery.upsert(created.id, {
            personalInfo: {
              fullName: created.full_name,
              email: created.email,
            },
            careerPreferences: {},
            skills: [],
            projects: [],
            experience: [],
            education: [],
            certifications: [],
          }, tx);
          return created;
        });
      } catch (err) {
        if (err.code === '23505') {
          return res.status(409).json({ error: 'An account with that email already exists.' });
        }
        throw err;
      }

      return res.status(201).json({
        token: signToken(user),
        user: publicUser(user),
      });
    } catch (err) {
      return next(err);
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const user = await userQuery.findByEmail(email.toLowerCase().trim());
      if (!user) {
        await equalizeLoginTiming(password);
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const passwordsMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordsMatch) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      if (user.must_change_password) {
        if (user.reset_token_expires && new Date() > new Date(user.reset_token_expires)) {
          return res.status(401).json({ error: 'Temporary password has expired. Please request a new one.' });
        }
      }

      // Two-factor challenge: the password alone never yields a JWT when TOTP
      // is on. Step 2 re-posts credentials plus the 6-digit code.
      if (user.totp_enabled) {
        const provided = typeof req.body.token === 'string' ? req.body.token.trim() : '';
        if (!provided) {
          return res.json({ twoFactorRequired: true });
        }
        const { ok } = verifyTotp(user, provided);
        if (!ok) {
          return res.status(401).json({ error: 'Invalid two-factor code.' });
        }
      }

      return res.json({
        token: signToken(user),
        user: publicUser(user),
        requirePasswordChange: user.must_change_password || false,
      });
    } catch (err) {
      return next(err);
    }
  },

  me(req, res) {
    return res.json({ user: publicUser(req.user) });
  },

  async updateDetails(req, res, next) {
    try {
      const { fullName, email } = req.body;
      if (!fullName || !email) {
        return res.status(400).json({ error: 'Full name and email are required.' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format.' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      
      let user;
      try {
        user = await userQuery.updateDetails(req.user.id, normalizedEmail, fullName.trim());
      } catch (err) {
        if (err.code === '23505') {
          return res.status(409).json({ error: 'An account with that email already exists.' });
        }
        throw err;
      }
      
      if (!user) return res.status(404).json({ error: 'User not found.' });

      return res.json({
        token: signToken(user),
        user: publicUser(user)
      });
    } catch (err) {
      return next(err);
    }
  },

  async updatePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new passwords are required.' });
      }

      if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        return res.status(400).json({ error: 'New password must be at least 8 characters, include an uppercase letter and a number.' });
      }

      const user = await userQuery.findByEmail(req.user.email);
      if (!user) return res.status(404).json({ error: 'User not found.' });

      if (user.must_change_password && user.reset_token_expires && new Date() > new Date(user.reset_token_expires)) {
        return res.status(401).json({ error: 'Temporary password has expired. Please request a new one.' });
      }

      const passwordsMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!passwordsMatch) {
        return res.status(401).json({ error: 'Incorrect current password.' });
      }

      const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await userQuery.updatePassword(user.id, passwordHash);

      return res.json({ message: 'Password updated successfully.' });
    } catch (err) {
      return next(err);
    }
  },

  async updateDigestPreference(req, res, next) {
    try {
      const { digestOptIn } = req.body;
      if (typeof digestOptIn !== 'boolean') {
        return res.status(400).json({ error: 'digestOptIn must be true or false.' });
      }
      const updated = await userQuery.setDigestOptIn(req.user.id, digestOptIn);
      if (!updated) return res.status(404).json({ error: 'User not found.' });
      return res.json({ message: digestOptIn ? 'Weekly digest enabled.' : 'Weekly digest disabled.' });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * TOTP enrollment step 1: generate a seed, store it encrypted but DISABLED,
   * and hand back the otpauth URL + QR so the client can render it.
   */
  async startTotpEnroll(req, res, next) {
    try {
      const secret = authenticator.generateSecret();
      await userQuery.setTotpSecret(req.user.id, encrypt(secret));

      const account = encodeURIComponent(req.user.email);
      const service = encodeURIComponent('CV Builder Platform');
      const otpauthUrl = authenticator.keyuri(req.user.email || account, 'CV Builder Platform', secret);
      const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
      return res.json({ otpauthUrl, qrDataUrl });
    } catch (err) {
      return next(err);
    }
  },

  /** TOTP enrollment step 2: prove possession of the device before enabling. */
  async confirmTotpEnroll(req, res, next) {
    try {
      const user = await userQuery.findById(req.user.id);
      const { ok } = verifyTotp(user, req.body.token);
      if (!ok) {
        return res.status(400).json({ error: 'That code is not valid. Check your authenticator app and try again.' });
      }
      await userQuery.enableTotp(req.user.id);
      return res.json({ message: 'Two-factor authentication is now active.', twoFactorEnabled: true });
    } catch (err) {
      return next(err);
    }
  },

  /** Turning 2FA off requires the current password — the strongest factor held. */
  async disableTotp(req, res, next) {
    try {
      const { currentPassword } = req.body;
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to disable two-factor authentication.' });
      }
      const user = await userQuery.findByEmail(req.user.email);
      const match = user ? await bcrypt.compare(currentPassword, user.password_hash) : false;
      if (!match) {
        return res.status(401).json({ error: 'Incorrect current password.' });
      }
      await userQuery.clearTotp(req.user.id);
      return res.json({ message: 'Two-factor authentication disabled.', twoFactorEnabled: false });
    } catch (err) {
      return next(err);
    }
  },

  async deleteAccount(req, res, next) {
    try {
      await userQuery.deleteById(req.user.id);
      return res.json({ message: 'Account deleted successfully.' });
    } catch (err) {
      return next(err);
    }
  },

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required.' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const user = await userQuery.findByEmail(normalizedEmail);

      if (user) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashResetToken(rawToken);
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

        // Store only the hash; the current password keeps working until the
        // reset is completed, so a failed email can never lock anyone out.
        await userQuery.setResetToken(user.id, tokenHash, expiresAt);

        try {
          await sendResetEmail(user.email, rawToken);
        } catch (emailErr) {
          return res.status(502).json({
            error: 'We could not send the reset email right now. Please try again shortly.',
          });
        }

        if (!isEmailConfigured() && process.env.NODE_ENV !== 'production') {
          const base = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
          return res.json({
            message: RESET_GENERIC_MESSAGE,
            devResetLink: `${base.replace(/\/+$/, '')}/#/reset-password?token=${rawToken}`,
          });
        }
      }

      return res.json({ message: RESET_GENERIC_MESSAGE });
    } catch (err) {
      return next(err);
    }
  },

  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'A reset token is required.' });
      }

      const policyError = passwordPolicyError(newPassword);
      if (policyError) {
        return res.status(400).json({ error: policyError });
      }

      const user = await userQuery.findByResetToken(hashResetToken(token));
      if (!user) {
        return res.status(400).json({
          error: 'This reset link is invalid or has expired. Please request a new one.',
        });
      }

      const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      const updated = await userQuery.completePasswordReset(user.id, passwordHash);
      if (!updated) {
        return res.status(400).json({
          error: 'This reset link is invalid or has expired. Please request a new one.',
        });
      }

      return res.json({
        message: 'Password updated successfully. You are now signed in.',
        token: signToken(updated),
        user: publicUser(updated),
      });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * Issue a temporary password that forces a credential change on next login.
   * Public like forgot-password (rate limited) so an expired temporary
   * credential can always be replaced; every outcome shares one response.
   */
  async issueTempPassword(req, res, next) {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required.' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const user = await userQuery.findByEmail(normalizedEmail);

      if (user) {
        const tempPassword = generateTemporaryPassword();
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
        const previousHash = user.password_hash;

        await userQuery.setTemporaryPassword(
          user.id,
          await bcrypt.hash(tempPassword, SALT_ROUNDS),
          expiresAt
        );

        try {
          await sendTempPasswordEmail(user.email, tempPassword);
        } catch (emailErr) {
          // Roll the rotation back so the previous credential keeps working —
          // a failed email must never lock anyone out.
          await userQuery.updatePassword(user.id, previousHash).catch(() => {});
          return res.status(502).json({
            error: 'We could not send the temporary password right now. Please try again shortly.',
          });
        }

        if (!isEmailConfigured() && process.env.NODE_ENV !== 'production') {
          return res.json({
            message: TEMP_PASSWORD_GENERIC_MESSAGE,
            devTempPassword: tempPassword,
          });
        }
      }

      return res.json({ message: TEMP_PASSWORD_GENERIC_MESSAGE });
    } catch (err) {
      return next(err);
    }
  },

};

module.exports = authController;
