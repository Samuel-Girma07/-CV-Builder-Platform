const exportQuery = require('../models/exportQuery');

/**
 * GDPR-style data portability: one authenticated request returns the entire
 * account as JSON. Credentials and TOTP seeds are never included.
 */
async function exportAccount(req, res, next) {
  try {
    const bundle = await exportQuery.gatherAll(req.user.id);

    if (!bundle.user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cv-builder-export-${new Date().toISOString().slice(0, 10)}.json"`
    );
    return res.json(bundle);
  } catch (err) {
    return next(err);
  }
}

module.exports = { exportAccount };
