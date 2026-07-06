const interviewQuery = require('../models/interviewQuery');
const applicationQuery = require('../models/applicationQuery');

function validateId(idParam) {
  const num = Number(idParam);
  return Number.isInteger(num) && num > 0 ? num : null;
}

const interviewController = {
  async getByApplication(req, res, next) {
    try {
      const appId = validateId(req.params.appId);
      if (!appId) return res.status(400).json({ error: 'Invalid application ID.' });

      // Ensure user owns application
      const app = await applicationQuery.findById(appId, req.user.id);
      if (!app) return res.status(404).json({ error: 'Application not found.' });

      const interviews = await interviewQuery.findByApplicationId(appId, req.user.id);
      return res.json({ interviews });
    } catch (err) {
      return next(err);
    }
  },

  async create(req, res, next) {
    try {
      const appId = validateId(req.params.appId);
      if (!appId) return res.status(400).json({ error: 'Invalid application ID.' });

      const app = await applicationQuery.findById(appId, req.user.id);
      if (!app) return res.status(404).json({ error: 'Application not found.' });

      const { title, startTime, endTime, location, notes } = req.body;
      if (!title || !startTime || !endTime) {
        return res.status(400).json({ error: 'Title, start time, and end time are required.' });
      }

      if (new Date(startTime) >= new Date(endTime)) {
        return res.status(400).json({ error: 'Start time must be before end time.' });
      }

      const interview = await interviewQuery.create(
        req.user.id,
        appId,
        title,
        new Date(startTime),
        new Date(endTime),
        location || '',
        notes || ''
      );

      return res.status(201).json({ interview });
    } catch (err) {
      return next(err);
    }
  },

  async checkConflict(req, res, next) {
    try {
      const { startTime, endTime } = req.body;
      if (!startTime || !endTime) {
        return res.status(400).json({ error: 'start time and end time required' });
      }

      const s = new Date(startTime);
      const e = new Date(endTime);
      if (s >= e) return res.json({ hasConflict: false }); // Will be caught by create validation

      const conflict = await interviewQuery.checkConflict(req.user.id, s, e);
      return res.json({ hasConflict: !!conflict, conflict });
    } catch (err) {
      return next(err);
    }
  },

  async getIcs(req, res, next) {
    try {
      const id = validateId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid interview ID.' });

      const interview = await interviewQuery.findById(id, req.user.id);
      if (!interview) return res.status(404).json({ error: 'Interview not found.' });

      // Convert timestamp to ICS datetime format (YYYYMMDDTHHmmssZ)
      const formatDate = (date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      };

      const dtStart = formatDate(new Date(interview.start_time));
      const dtEnd = formatDate(new Date(interview.end_time));
      const dtStamp = formatDate(new Date(interview.created_at));
      
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//CV Builder//Interview Scheduler//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${interview.id}@cvbuilder.local`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${interview.title}`,
        `LOCATION:${interview.location || ''}`,
        `DESCRIPTION:${(interview.notes || '').replace(/\n/g, '\\n')}`,
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');

      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader('Content-Disposition', `attachment; filename="interview-${interview.id}.ics"`);
      res.send(ics);
    } catch (err) {
      return next(err);
    }
  }
};

module.exports = interviewController;
