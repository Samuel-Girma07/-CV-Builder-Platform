const insightQuery = require('../models/insightQuery');

const MIN_SAMPLE = 3;

exports.getSkillGaps = async (req, res, next) => {
  try {
    // Below a tiny sample the radar is noise, so the client renders its
    // "score more applications" hint instead of misleading rankings.
    const gaps = await insightQuery.getSkillGaps(req.user.id);
    return res.json({ gaps, sampleOk: gaps.reduce((n, g) => n + g.total, 0) >= MIN_SAMPLE });
  } catch (err) {
    return next(err);
  }
};
