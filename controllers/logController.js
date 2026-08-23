const logQuery = require('../models/logQuery');
const applicationQuery = require('../models/applicationQuery');
const pool = require('../config/db');

function validateApp(req, res) {
  const appId = logQuery.validateId(req.params.id);
  if (!appId) {
    res.status(400).json({ error: 'Invalid application ID.' });
    return null;
  }
  return appId;
}

async function assertOwned(userId, appId) {
  const app = await applicationQuery.findById(appId, userId);
  return Boolean(app);
}

const logController = {
  async listContacts(req, res, next) {
    try {
      const appId = validateApp(req, res);
      if (!appId) return;
      if (!(await assertOwned(req.user.id, appId))) {
        return res.status(404).json({ error: 'Application not found.' });
      }
      return res.json({ contacts: await logQuery.listContacts(req.user.id, appId) });
    } catch (err) {
      return next(err);
    }
  },

  async addContact(req, res, next) {
    try {
      const appId = validateApp(req, res);
      if (!appId) return;
      if (!(await assertOwned(req.user.id, appId))) {
        return res.status(404).json({ error: 'Application not found.' });
      }

      const { name, role, email, phone, notes } = req.body;
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 255) {
        return res.status(400).json({ error: 'Contact name is required (max 255 characters).' });
      }
      for (const [field, max] of [['role', 120], ['email', 255], ['phone', 60], ['notes', 2000]]) {
        const value = req.body[field];
        if (value !== undefined && (typeof value !== 'string' || value.length > max)) {
          return res.status(400).json({ error: `${field} must be text of at most ${max} characters.` });
        }
      }

      const contact = await pool.withTransaction((tx) =>
        logQuery.createContact(tx, req.user.id, appId, {
          name: name.trim(), role, email, phone, notes,
        })
      );
      return res.status(201).json({ contact });
    } catch (err) {
      return next(err);
    }
  },

  async deleteContact(req, res, next) {
    try {
      const contactId = logQuery.validateId(req.params.entryId);
      if (!contactId) return res.status(400).json({ error: 'Invalid contact ID.' });
      const deleted = await logQuery.deleteContact(req.user.id, contactId);
      if (!deleted) return res.status(404).json({ error: 'Contact not found.' });
      return res.json({ message: 'Contact deleted.', id: deleted.id });
    } catch (err) {
      return next(err);
    }
  },

  async listActivities(req, res, next) {
    try {
      const appId = validateApp(req, res);
      if (!appId) return;
      if (!(await assertOwned(req.user.id, appId))) {
        return res.status(404).json({ error: 'Application not found.' });
      }
      return res.json({ activities: await logQuery.listActivities(req.user.id, appId) });
    } catch (err) {
      return next(err);
    }
  },

  async addActivity(req, res, next) {
    try {
      const appId = validateApp(req, res);
      if (!appId) return;
      if (!(await assertOwned(req.user.id, appId))) {
        return res.status(404).json({ error: 'Application not found.' });
      }

      const { kind, content, occurredAt } = req.body;
      if (!logQuery.KINDS.includes(kind)) {
        return res.status(400).json({ error: `Kind must be one of: ${logQuery.KINDS.join(', ')}.` });
      }
      if (content !== undefined && (typeof content !== 'string' || content.length > logQuery.MAX_CONTENT_LENGTH)) {
        return res.status(400).json({ error: `Content must be text of at most ${logQuery.MAX_CONTENT_LENGTH} characters.` });
      }
      let when = new Date();
      if (occurredAt !== undefined && occurredAt !== null && occurredAt !== '') {
        when = new Date(occurredAt);
        if (Number.isNaN(when.getTime())) {
          return res.status(400).json({ error: 'occurredAt must be a valid date.' });
        }
      }

      const activity = await pool.withTransaction((tx) =>
        logQuery.createActivity(tx, req.user.id, appId, { kind, content, occurredAt: when })
      );
      return res.status(201).json({ activity });
    } catch (err) {
      return next(err);
    }
  },

  async deleteActivity(req, res, next) {
    try {
      const activityId = logQuery.validateId(req.params.entryId);
      if (!activityId) return res.status(400).json({ error: 'Invalid activity ID.' });
      const deleted = await logQuery.deleteActivity(req.user.id, activityId);
      if (!deleted) return res.status(404).json({ error: 'Activity not found.' });
      return res.json({ message: 'Activity deleted.', id: deleted.id });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = logController;
