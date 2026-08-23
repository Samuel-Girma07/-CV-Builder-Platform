const reminderQuery = require('../models/reminderQuery');
const applicationQuery = require('../models/applicationQuery');
const reminderWorker = require('../workers/reminders');

function validateId(idParam) {
  const num = Number(idParam);
  return Number.isInteger(num) && num > 0 ? num : null;
}

const reminderController = {
  /**
   * Schedule a follow-up for an application. The pg-boss job is enqueued in
   * the same request so the reminder fires even if the user never revisits.
   */
  async create(req, res, next) {
    try {
      const appId = validateId(req.params.id);
      if (!appId) return res.status(400).json({ error: 'Invalid application ID.' });

      const application = await applicationQuery.findById(appId, req.user.id);
      if (!application) return res.status(404).json({ error: 'Application not found.' });

      const { remindAt, message } = req.body;
      const when = new Date(remindAt);
      if (!remindAt || Number.isNaN(when.getTime())) {
        return res.status(400).json({ error: 'A valid remindAt date is required.' });
      }
      // Reminders land at least a minute out so they cannot fire mid-request.
      const safeWhen = when.getTime() < Date.now() + 60_000
        ? new Date(Date.now() + 60_000)
        : when;
      if (message !== undefined && typeof message !== 'string') {
        return res.status(400).json({ error: 'Message must be text.' });
      }

      const reminder = await reminderQuery.create(req.user.id, appId, safeWhen, message || '');
      await reminderWorker.enqueueReminder(reminder.id, safeWhen);

      return res.status(201).json({ reminder });
    } catch (err) {
      return next(err);
    }
  },

  async listForApplication(req, res, next) {
    try {
      const appId = validateId(req.params.id);
      if (!appId) return res.status(400).json({ error: 'Invalid application ID.' });
      const reminders = await reminderQuery.listForApplication(req.user.id, appId);
      return res.json({ reminders });
    } catch (err) {
      return next(err);
    }
  },

  /** Dismissal cancels nothing server-side except future sends: the worker's markSent guard skips non-pending rows. */
  async dismiss(req, res, next) {
    try {
      const id = validateId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid reminder ID.' });
      const dismissed = await reminderQuery.dismiss(req.user.id, id);
      if (!dismissed) {
        return res.status(404).json({ error: 'Pending reminder not found.' });
      }
      return res.json({ reminder: dismissed });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = reminderController;
