const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userQuery = require('../models/userQuery');
const profileQuery = require('../models/profileQuery');
const crypto = require('crypto');
const { sendResetEmail } = require('../utils/email');

const SALT_ROUNDS = 12;
const TOKEN_EXPIRES_IN = '24h';

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    createdAt: user.created_at,
    mustChangePassword: user.must_change_password || false,
    resetTokenExpires: user.reset_token_expires || null,
  };
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
      let user;
      try {
        user = await userQuery.create(normalizedEmail, passwordHash, fullName.trim());
      } catch (err) {
        if (err.code === '23505') {
          return res.status(409).json({ error: 'An account with that email already exists.' });
        }
        throw err;
      }

      await profileQuery.upsert(user.id, {
        personalInfo: {
          fullName: user.full_name,
          email: user.email,
        },
        careerPreferences: {},
        skills: [],
        projects: [],
        experience: [],
        education: [],
        certifications: [],
      });

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
      if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
      }

      const user = await userQuery.findByEmail(email.toLowerCase().trim());
      if (!user) {
        return res.status(404).json({ error: 'Email address not found in our system.' });
      }

      const tempPassword = crypto.randomBytes(4).toString('hex'); // 8 characters
      const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await userQuery.setTemporaryPassword(user.id, passwordHash, expiresAt);

      const emailSent = await sendResetEmail(user.email, tempPassword);

      const response = {
        message: 'A temporary password has been sent to your email address.',
      };

      return res.json(response);
    } catch (err) {
      return next(err);
    }
  },

};

module.exports = authController;
