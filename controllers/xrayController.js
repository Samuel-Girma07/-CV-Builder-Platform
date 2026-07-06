const pool = require('../config/db');
const { analyzePdfBuffer } = require('../utils/atsXray');

const xrayController = {
  async uploadXray(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Please upload a PDF file.' });
      }

      const buffer = req.file.buffer;
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

      // Save to cv_versions
      const result = await pool.query(
        'INSERT INTO cv_versions (user_id, file_name, file_data, parsability_report) VALUES ($1, $2, $3, $4) RETURNING id',
        [userId, fileName, buffer, JSON.stringify(report)]
      );

      return res.json({ id: result.rows[0].id, report });
    } catch (err) {
      if (err.message === 'Only PDF files are allowed.') {
        return res.status(400).json({ error: err.message });
      }
      return next(err);
    }
  },

  async getPdf(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const result = await pool.query(
        'SELECT file_data, file_name FROM cv_versions WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'CV version not found' });
      }

      const fileData = result.rows[0].file_data;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${result.rows[0].file_name}"`);
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

module.exports = xrayController;
