const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const { analyzePdfBuffer } = require('../utils/atsXray');
const { isPdfBuffer } = require('../config/upload');

const PDF_TICKET_TTL_SECONDS = 60;

function validateId(idParam) {
  const num = Number(idParam);
  return Number.isInteger(num) && num > 0 ? num : null;
}

function safeContentDispositionName(name) {
  const cleaned = String(name || 'cv.pdf')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || 'cv.pdf';
}

/**
 * PostgreSQL rejects JSON that contains Unicode null bytes (\u0000) and some
 * other unsupported escape sequences. This helper walks any value and strips
 * those characters from every string so the INSERT never fails.
 */
function sanitizeForPg(value) {
  if (typeof value === 'string') {
    // Remove null bytes and other control characters that PostgreSQL rejects
    // eslint-disable-next-line no-control-regex
    return value.replace(/\u0000/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeForPg);
  }
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitizeForPg(v);
    }
    return out;
  }
  return value;
}

const xrayController = {
  async uploadXray(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Please upload a PDF file.' });
      }

      const buffer = req.file.buffer;

      if (!isPdfBuffer(buffer)) {
        return res.status(400).json({ error: 'This file is not a valid PDF.' });
      }

      const fileName = req.file.originalname;
      const userId = req.user.id;

      // Run ATS X-Ray heuristic analysis
      const report = await analyzePdfBuffer(buffer);

      // Refuse anything that does not look like a CV; do not store it.
      if (!report.isCv) {
        return res.status(422).json({
          error: "This file doesn't look like a CV.",
          missing: report.missing || [],
        });
      }

      // Save to cv_versions — sanitise all strings first so PostgreSQL never
      // chokes on null bytes or other unsupported Unicode escape sequences that
      // pdf-parse can extract verbatim from certain PDF files.
      const safeReport = sanitizeForPg(report);
      const result = await pool.query(
        'INSERT INTO cv_versions (user_id, file_name, file_data, parsability_report) VALUES ($1, $2, $3, $4) RETURNING id',
        [userId, fileName, buffer, JSON.stringify(safeReport)]
      );

      return res.json({ id: result.rows[0].id, report });
    } catch (err) {
      return next(err);
    }
  },

  async issuePdfTicket(req, res, next) {
    try {
      const versionId = validateId(req.params.id);
      if (!versionId) return res.status(400).json({ error: 'Invalid CV version ID.' });

      const owned = await pool.query(
        'SELECT 1 FROM cv_versions WHERE id = $1 AND user_id = $2',
        [versionId, req.user.id]
      );
      if (owned.rows.length === 0) {
        return res.status(404).json({ error: 'CV version not found' });
      }

      const ticket = jwt.sign(
        { sub: req.user.id, vid: versionId, scope: 'xray-pdf' },
        process.env.JWT_SECRET,
        { expiresIn: PDF_TICKET_TTL_SECONDS }
      );

      return res.json({ ticket, expiresIn: PDF_TICKET_TTL_SECONDS });
    } catch (err) {
      return next(err);
    }
  },

  async getPdf(req, res, next) {
    try {
      const versionId = validateId(req.params.id);
      if (!versionId) return res.status(400).json({ error: 'Invalid CV version ID.' });

      let payload;
      try {
        payload = jwt.verify(String(req.query.ticket || ''), process.env.JWT_SECRET);
      } catch (err) {
        return res.status(401).json({ error: 'This preview link has expired. Reopen the scan to refresh it.' });
      }

      if (payload.scope !== 'xray-pdf' || Number(payload.vid) !== versionId) {
        return res.status(403).json({ error: 'This link is not valid for this document.' });
      }

      const result = await pool.query(
        'SELECT file_data, file_name FROM cv_versions WHERE id = $1 AND user_id = $2',
        [versionId, payload.sub]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'CV version not found' });
      }

      const fileData = result.rows[0].file_data;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${safeContentDispositionName(result.rows[0].file_name)}"`);
      return res.send(fileData);
    } catch (err) {
      return next(err);
    }
  },
  
  async listVersions(req, res, next) {
    try {
      const userId = req.user.id;
      const result = await pool.query(
        'SELECT id, file_name, uploaded_at, parsability_report FROM cv_versions WHERE user_id = $1 ORDER BY uploaded_at DESC',
        [userId]
      );
      
      return res.json({ versions: result.rows });
    } catch (err) {
      return next(err);
    }
  }
};

xrayController.safeContentDispositionName = safeContentDispositionName;

module.exports = xrayController;
